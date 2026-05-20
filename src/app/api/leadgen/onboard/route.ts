import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/onboard
 *
 * After a deal is closed, the AI collects platform credentials/logins from the
 * lead via DM conversation. Called by n8n on each inbound reply during the
 * onboarding stage.
 *
 * Auth: session bearer OR x-webhook-key + owner_id
 *
 * Body:
 *   lead_id           string   — lead_pipeline.id
 *   inbound_message?  string   — latest message from the lead (if this is
 *                               a reply; omit to send the opening ask)
 *   mark_complete?    boolean  — force-mark onboarding complete (manual override)
 *   owner_id?         string   — required if using webhook auth
 */

const ONBOARDING_SYSTEM = `You are a friendly agency onboarding assistant collecting access credentials
from a new client via Instagram DM. Be conversational, brief (3 sentences max per message),
and friendly. You are collecting:
1. Their Instagram username (you probably already have it)
2. Whether they want to connect Meta Ads Manager (yes/no — just need their email for an invite)
3. Whether they want to connect TikTok for Business (yes/no)
4. Their preferred working email/contact

Extract whatever they provide. When you have all required info OR the client says they're done,
output a JSON block at the end of your message like:
<collected>{"instagram_username":"...","meta_ads_email":"...","tiktok_connected":false,"contact_email":"..."}</collected>
If not enough info yet, omit the block and just send a friendly follow-up question.`;

const OPENING_MESSAGE = `Hey! Now that we're working together, I just need a few quick things to get your account set up 🙌

1. We'll use your @handle for posts (already have it)
2. Do you want to connect your Meta Ads account? If yes, just drop your email and I'll send an invite
3. TikTok for Business — want to link it? Just say yes/no
4. Best email to reach you on?

You can answer all at once or one by one, totally fine!`;

export async function POST(request: NextRequest) {
  const webhookKey = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  let ownerId: string | null = null;
  let body: Record<string, unknown>;

  if (webhookKey && expectedKey && webhookKey === expectedKey) {
    body = await request.json();
    ownerId = (body.owner_id as string) ?? null;
    if (!ownerId) return NextResponse.json({ error: "owner_id required for webhook auth" }, { status: 400 });
  } else {
    const authSupabase = createServerSupabase();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    ownerId = user.id;
    body = await request.json();
  }

  const { lead_id, inbound_message, mark_complete } = body as {
    lead_id: string;
    inbound_message?: string;
    mark_complete?: boolean;
    owner_id?: string;
  };

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, stage, message_history, onboarding_data, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Manual complete override
  if (mark_complete) {
    await supabase.from("lead_pipeline").update({
      stage: "scripting",
      onboarding_complete: true,
    }).eq("id", lead_id);
    return NextResponse.json({ ok: true, stage: "scripting", complete: true });
  }

  // If no inbound message → send opening message
  if (!inbound_message) {
    // Transition to onboarding
    const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];
    const newHistory = [...history, { role: "assistant", content: OPENING_MESSAGE, ts: new Date().toISOString() }];

    await supabase.from("lead_pipeline").update({
      stage: "onboarding",
      message_history: newHistory,
    }).eq("id", lead_id);

    // Fire DM via Zernio
    await sendDM(row.platform, row.handle, OPENING_MESSAGE);

    return NextResponse.json({ ok: true, stage: "onboarding", message: OPENING_MESSAGE });
  }

  // Process inbound reply through AI
  const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];
  const updatedHistory = [
    ...history,
    { role: "user", content: inbound_message, ts: new Date().toISOString() },
  ];

  const conversationText = updatedHistory
    .map((m) => `${m.role === "user" ? "Lead" : "Assistant"}: ${m.content}`)
    .join("\n");

  const result = await callLLMTraced({
    taskType: "agentic_reasoning",
    systemPrompt: ONBOARDING_SYSTEM,
    userPrompt: `Conversation so far:\n${conversationText}\n\nCurrent onboarding data collected: ${JSON.stringify(row.onboarding_data)}`,
    maxTokens: 300,
    forceModel: "claude-haiku-4-5",
    surface: "leadgen_onboard",
    subject: { kind: "lead", id: lead_id, agencyOwnerId: ownerId },
    humanize: true,
    channel: "dm",
  });

  const aiReply = result.text;

  // Extract <collected> block if present
  let onboardingData = row.onboarding_data as Record<string, unknown> || {};
  let complete = false;
  const collectedMatch = aiReply.match(/<collected>([\s\S]*?)<\/collected>/);
  if (collectedMatch) {
    try {
      const parsed = JSON.parse(collectedMatch[1]);
      onboardingData = { ...onboardingData, ...parsed };
      complete = true;
    } catch { /* ignore parse errors */ }
  }

  // Clean reply — strip the <collected> block from what we send to the lead
  const cleanReply = aiReply.replace(/<collected>[\s\S]*?<\/collected>/g, "").trim();

  const finalHistory = [...updatedHistory, { role: "assistant", content: cleanReply, ts: new Date().toISOString() }];

  const updatePayload: Record<string, unknown> = {
    message_history: finalHistory,
    onboarding_data: onboardingData,
    last_reply_at: new Date().toISOString(),
  };
  if (complete) {
    updatePayload.stage = "scripting";
    updatePayload.onboarding_complete = true;
  }

  await supabase.from("lead_pipeline").update(updatePayload).eq("id", lead_id);

  // Send reply via Zernio
  if (cleanReply) await sendDM(row.platform, row.handle, cleanReply);

  return NextResponse.json({
    ok: true,
    stage: complete ? "scripting" : "onboarding",
    complete,
    reply: cleanReply,
    onboarding_data: onboardingData,
  });
}

async function sendDM(platform: string, handle: string, message: string): Promise<void> {
  const zernioKey = process.env.ZERNIO_API_KEY;
  if (!zernioKey) return;

  try {
    await fetch("https://api.zernio.com/v1/dm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": zernioKey },
      body: JSON.stringify({ platform, handle, message }),
    });
  } catch (err) {
    console.error("[leadgen/onboard] Zernio DM send failed:", err);
  }
}
