import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/leadgen/qualify
 *
 * Inbound message handler for the AI qualification agent. Called when a lead
 * replies to our voice DM (via Zernio webhook → this endpoint).
 *
 * The AI asks up to 5 qualification questions to collect:
 *   - Full name
 *   - Business type / niche
 *   - Main challenge (content / ads / leads)
 *   - Approximate monthly budget
 *   - Whether they can send files/assets
 *
 * When enough info is collected, it marks stage=qualified and fires
 * content generation automatically.
 *
 * Auth: WEBHOOK_SECRET (same as inbound webhook, called from Zernio handler).
 *
 * Body:
 *   lead_id   — lead_pipeline.id
 *   message   — text the lead just sent
 *   attachments? — [{url, type, filename}]
 */
interface QualifyBody {
  lead_id: string;
  message: string;
  attachments?: Array<{ url: string; type?: string; filename?: string }>;
}

type ServiceNeed = 'video_editing' | 'ads_management' | 'content_creation';

interface LeadInfo {
  name?: string;
  business_type?: string;
  niche?: string;
  challenge?: string;
  budget?: string;
  goals?: string;
  contact_email?: string;
  has_files?: boolean;
  service_needs?: ServiceNeed[];
}

interface MessageEntry {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
}

/** Returns true when we have enough info to generate content. */
function isQualified(info: LeadInfo): boolean {
  const hasName = Boolean(info.name);
  const hasBusiness = Boolean(info.business_type || info.niche);
  const hasChallenge = Boolean(info.challenge || info.goals);
  return hasName && hasBusiness && hasChallenge;
}

export async function POST(request: NextRequest) {
  // Auth
  const key =
    request.headers.get("x-webhook-key") ||
    new URL(request.url).searchParams.get("key");
  const expectedKey = process.env.WEBHOOK_SECRET;
  if (!expectedKey) {
    return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (!key || !secureCompare(key, expectedKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: QualifyBody;
  try {
    body = (await request.json()) as QualifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lead_id, message, attachments = [] } = body;
  if (!lead_id || !message?.trim()) {
    return NextResponse.json({ error: "lead_id and message required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch lead with history and current info
  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select("id, owner_id, platform, handle, stage, lead_info, message_history, outreach_text")
    .eq("id", lead_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Don't re-qualify dead or already converted leads
  if (lead.stage === "dead" || lead.stage === "converted") {
    return NextResponse.json({ ok: true, skipped: true, reason: `lead_stage_${lead.stage}` });
  }

  // Get owner profile for personalisation
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", lead.owner_id)
    .maybeSingle();

  const agencyName = ownerProfile?.agency_name || ownerProfile?.full_name || "our agency";

  // Build conversation context for the AI
  const history: MessageEntry[] = Array.isArray(lead.message_history)
    ? (lead.message_history as MessageEntry[])
    : [];

  // Append incoming user message
  const userEntry: MessageEntry = {
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  };

  // If there are attachments, add a note
  if (attachments.length > 0) {
    userEntry.content +=
      `\n[Attachments: ${attachments.map((a) => a.filename || a.url).join(", ")}]`;
  }

  const updatedHistory = [...history, userEntry];

  const currentInfo: LeadInfo =
    typeof lead.lead_info === "object" && lead.lead_info !== null
      ? (lead.lead_info as LeadInfo)
      : {};

  // Build conversation history string for the AI prompt
  const conversationText = updatedHistory
    .map((m) => `${m.role === "assistant" ? "You" : "Lead"}: ${m.content}`)
    .join("\n");

  // Determine turn number (how many times the lead has replied)
  const userTurns = updatedHistory.filter((m) => m.role === "user").length;

  const systemPrompt = `You are a friendly, concise sales qualification assistant for ${agencyName}.
Your job is to qualify potential clients who replied to our voice outreach about ads and content creation services.

GOAL: Collect these 5 pieces of information naturally through conversation:
1. Their full name
2. What type of business they run (e.g. "e-commerce store", "personal trainer", "restaurant")
3. Their main challenge (more leads, better content, running ads, etc.)
4. Rough monthly marketing budget (just a range: under $500, $500-2k, $2k-5k, $5k+)
5. Whether they have brand assets to share (logo, product photos, existing content)

RULES:
- Be warm, conversational, and short. 1-3 sentences max per response.
- Ask ONE question at a time. Never ask multiple questions at once.
- If they volunteer info unprompted, acknowledge it and move to the next missing piece.
- If this is their first reply (turn 1), just warmly greet them and ask their name.
- If you have all 5 pieces of info, say: "Amazing! Give me a moment and I'll put together some content ideas specifically for your business." Then output: QUALIFIED
- If the lead seems uninterested or says no, output: DEAD
- If the lead asks to speak to a real person, output: ESCALATE

Current info collected so far:
${JSON.stringify(currentInfo, null, 2)}

This is turn ${userTurns} of the conversation.`;

  const userPrompt = `Conversation so far:\n${conversationText}\n\nGenerate your next response. If generating a reply, output ONLY the message text (no labels, no formatting). If the lead is qualified/dead/escalate, output just that keyword on its own line after the reply.`;

  let aiReply: string;
  let extractedInfo: Partial<LeadInfo> = {};
  let newStage = lead.stage as string;

  try {
    const result = await callLLMTraced({
      taskType: "agentic_reasoning",
      systemPrompt,
      userPrompt,
      maxTokens: 400,
      forceModel: "claude-haiku-4-5",
      surface: "leadgen_qualify",
      subject: { kind: "lead", id: lead_id, agencyOwnerId: lead.owner_id },
      humanize: false,
    });

    const raw = (typeof result === "string" ? result : result.text || "").trim();

    // Check for special tokens
    const upperRaw = raw.toUpperCase();
    if (upperRaw.includes("QUALIFIED")) {
      newStage = "qualified";
      aiReply = raw.replace(/QUALIFIED/gi, "").trim();
      if (!aiReply) {
        aiReply = "Amazing! Give me a moment and I'll put together some content ideas specifically for your business. 🚀";
      }
    } else if (upperRaw.includes("DEAD")) {
      newStage = "dead";
      aiReply = raw.replace(/DEAD/gi, "").trim();
      if (!aiReply) {
        aiReply = "No problem at all! If you ever change your mind, feel free to reach out. 😊";
      }
    } else if (upperRaw.includes("ESCALATE")) {
      newStage = "qualified"; // escalate means we have interest — forward to human
      aiReply = raw.replace(/ESCALATE/gi, "").trim();
      if (!aiReply) {
        aiReply = "Of course! I'll have someone from the team reach out to you directly. Stay tuned!";
      }
      extractedInfo.goals = "Wants to speak to a human";
    } else {
      aiReply = raw;
      if (lead.stage === "replied" || lead.stage === "outreach_sent") {
        newStage = "qualifying";
      }
    }

    // Extract information from the conversation using a second fast call
    if (userTurns >= 2) {
      const extractPrompt = `From this conversation, extract any of these fields if mentioned:
name, business_type, niche, challenge, budget, goals, contact_email, service_needs

For service_needs, classify the lead's challenge/goals into an array of one or more:
- "video_editing" — they need video editing, content repurposing, short-form clips, reels
- "ads_management" — they need help running ads, ad campaigns, paid media, Facebook/Instagram/TikTok ads
- "content_creation" — they need content strategy, social media content, thumbnails, graphics

Conversation:
${conversationText}

Output ONLY valid JSON with only the fields you can confidently identify from the text. Empty object if nothing new.`;

      try {
        const extractResult = await callLLMTraced({
          taskType: "extraction",
          systemPrompt: "You extract structured data from conversations. Output only valid JSON, nothing else.",
          userPrompt: extractPrompt,
          maxTokens: 200,
          forceModel: "claude-haiku-4-5",
          surface: "leadgen_extract",
          subject: { kind: "lead", id: lead_id, agencyOwnerId: lead.owner_id },
          humanize: false,
        });
        const extractText = typeof extractResult === "string"
          ? extractResult
          : (extractResult.text || "");
        const jsonMatch = extractText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedInfo = { ...extractedInfo, ...(JSON.parse(jsonMatch[0]) as Partial<LeadInfo>) };
        }
      } catch {
        // extraction failure is non-critical
      }
    }
  } catch (err) {
    const reason = "ai_error";
    console.error("[leadgen/qualify] AI call failed:", reason);
    return NextResponse.json({ error: `AI qualification failed: ${reason}` }, { status: 500 });
  }

  // Append AI reply to history
  const assistantEntry: MessageEntry = {
    role: "assistant",
    content: aiReply,
    timestamp: new Date().toISOString(),
  };
  const finalHistory = [...updatedHistory, assistantEntry];

  // Merge extracted info with existing
  const mergedInfo: LeadInfo = { ...currentInfo, ...extractedInfo };

  // Also check qualification status based on merged info
  if (isQualified(mergedInfo) && newStage !== "dead") {
    newStage = "qualified";
  }

  // Persist updates
  await supabase
    .from("lead_pipeline")
    .update({
      stage: newStage,
      message_history: finalHistory,
      lead_info: mergedInfo,
      last_reply_at: new Date().toISOString(),
      display_name: mergedInfo.name || lead.handle,
    })
    .eq("id", lead_id);

  // Auto-send the AI reply to the lead via DM
  if (aiReply && lead.platform && lead.handle) {
    const dmResult = await zernioDM({
      platform: lead.platform,
      handle: lead.handle,
      message: aiReply,
    });
    if (!dmResult.ok) {
      console.error("[leadgen/qualify] auto-reply DM send failed:", dmResult.error);
    }
  }

  // If just qualified, fire payment link — lead must pay before content work starts.
  // Fire-and-forget so this doesn't block the response.
  if (newStage === "qualified" && lead.stage !== "qualified") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
    fetch(`${appUrl}/api/leadgen/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-key": process.env.WEBHOOK_SECRET || "",
      },
      body: JSON.stringify({
        lead_id,
        owner_id: lead.owner_id,
        amount: Number(process.env.LEADGEN_DEFAULT_PRICE) || 500,
        currency: "usd",
      }),
    }).catch((err) =>
      console.warn("[leadgen/qualify] payment trigger failed:", err),
    );
  }

  return NextResponse.json({
    ok: true,
    reply: aiReply,
    stage: newStage,
    lead_info: mergedInfo,
    qualified: newStage === "qualified",
  });
}
