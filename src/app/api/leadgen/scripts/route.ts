import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { sendDM as zernioDM } from "@/lib/services/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/scripts
 *
 * Two-phase endpoint:
 *
 * Phase 1 — Ask: Send the opening DM asking what videos the lead wants.
 *   Body: { lead_id, phase: "ask" }
 *   Returns: the message sent
 *
 * Phase 2 — Generate: Lead replied with their video ideas; AI generates scripts.
 *   Body: { lead_id, phase: "generate", inbound_message? }
 *   Returns: { scripts: ScriptItem[] }
 *
 * Phase 3 — Reply: Lead replied to a generated script (feedback/approval).
 *   Body: { lead_id, phase: "reply", inbound_message }
 *   Returns: updated scripts or approval confirmation
 *
 * Auth: session bearer OR x-webhook-key + owner_id
 */

interface ScriptItem {
  id: string;
  type: "long_form" | "short_form" | "ad";
  title: string;
  hook: string;
  script: string;
  duration_estimate: string;  // e.g. "8-12 min" or "45-60 sec"
  platform: string;           // youtube|instagram|tiktok|all
  status: "draft" | "approved" | "revision_requested";
}

const SCRIPT_ASK_MESSAGE = `Nice! Now let's figure out what videos we're making for you 🎬

Tell me:
1. What long-form videos do you want? (YouTube-style, 8–15 min) — give me 1–3 ideas
2. What short-form clips? (Reels/TikTok, 30–90 sec) — give me 1–3 ideas
3. Any specific style you like? (e.g. talking head, voiceover, b-roll heavy, etc.)

Just describe your ideas in plain text — I'll write full scripts from them!`;

const SCRIPT_SYSTEM = `You are a professional video scriptwriter for a content agency.
Based on the client's video ideas, generate complete, production-ready scripts.

For LONG-FORM videos (8–15 min YouTube):
- Hook (first 30 seconds — pattern interrupt, bold claim, or question)
- Intro (who you are, what this video covers — 60 seconds)
- Main content (5–7 sections with clear headers)
- CTA (like/subscribe/comment prompt)

For SHORT-FORM videos (30–90 sec Reels/TikTok/Shorts):
- Hook line (first 3 seconds — captivating opening)
- Core content (main value, fast-paced)
- CTA (follow, DM, link in bio)

Output as a JSON array:
[
  {
    "id": "s1",
    "type": "long_form",
    "title": "Video title",
    "hook": "Opening hook sentence",
    "script": "Full script with [SECTION] headers...",
    "duration_estimate": "10-14 min",
    "platform": "youtube",
    "status": "draft"
  },
  ...
]

Be specific to the client's niche and pain points. Make scripts sound natural and conversational.`;

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

  const { lead_id, phase, inbound_message } = body as {
    lead_id: string;
    phase: "ask" | "generate" | "reply";
    inbound_message?: string;
    owner_id?: string;
  };

  if (!lead_id || !phase) return NextResponse.json({ error: "lead_id and phase required" }, { status: 400 });
  if (!["ask", "generate", "reply"].includes(phase)) {
    return NextResponse.json({ error: "phase must be ask|generate|reply" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, stage, message_history, lead_info, scripts, script_brief, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // ── Phase 1: Ask ──────────────────────────────────────────────────────────
  if (phase === "ask") {
    const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];
    const newHistory = [...history, { role: "assistant", content: SCRIPT_ASK_MESSAGE, ts: new Date().toISOString() }];

    await supabase.from("lead_pipeline").update({
      stage: "scripting",
      message_history: newHistory,
    }).eq("id", lead_id);

    await sendDM(row.platform, row.handle, SCRIPT_ASK_MESSAGE);

    return NextResponse.json({ ok: true, stage: "scripting", message: SCRIPT_ASK_MESSAGE });
  }

  // ── Phase 2: Generate ─────────────────────────────────────────────────────
  if (phase === "generate") {
    const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];

    // Add inbound message to history if provided
    const updatedHistory = inbound_message
      ? [...history, { role: "user", content: inbound_message, ts: new Date().toISOString() }]
      : history;

    const leadContext = JSON.stringify(row.lead_info || {});
    const userPrompt = inbound_message
      ? `Client's video ideas:\n${inbound_message}\n\nClient context (pain points, niche): ${leadContext}`
      : `Based on the conversation:\n${history.filter((m) => m.role === "user").map((m) => m.content).join("\n")}\n\nClient context: ${leadContext}`;

    const result = await callLLMTraced({
      taskType: "generation_long",
      systemPrompt: SCRIPT_SYSTEM,
      userPrompt,
      maxTokens: 4000,
      forceModel: "claude-sonnet-4-5",
      surface: "leadgen_scripts",
      subject: { kind: "lead", id: lead_id, agencyOwnerId: ownerId },
      humanize: false,
    });

    let scripts: ScriptItem[] = [];
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        scripts = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("[leadgen/scripts] JSON parse failed, using raw");
        scripts = [];
      }
    }

    const confirmMsg = `I've written ${scripts.length} script${scripts.length !== 1 ? "s" : ""} for you! 📝\n\n${scripts.map((s, i) => `${i + 1}. **${s.title}** (${s.type === "long_form" ? "Long-form" : "Short-form"}, ~${s.duration_estimate})`).join("\n")}\n\nCheck them in your portal: https://app.shortstack.work\n\nLet me know if you want any changes!`;

    const finalHistory = [
      ...updatedHistory,
      { role: "assistant", content: confirmMsg, ts: new Date().toISOString() },
    ];

    await supabase.from("lead_pipeline").update({
      scripts,
      message_history: finalHistory,
      last_reply_at: new Date().toISOString(),
    }).eq("id", lead_id);

    await sendDM(row.platform, row.handle, confirmMsg);

    // Notify via Telegram
    await notifyTelegram(
      `📝 Scripts generated for ${row.handle}!\n${scripts.length} scripts ready for review.`,
    );

    return NextResponse.json({ ok: true, stage: "scripting", scripts });
  }

  // ── Phase 3: Reply (feedback on scripts) ─────────────────────────────────
  if (phase === "reply" && inbound_message) {
    const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];
    const updatedHistory = [...history, { role: "user", content: inbound_message, ts: new Date().toISOString() }];

    // Detect approval
    const isApproval = /\b(looks? good|perfect|approved?|love it|great|let'?s? go|yes please|go ahead)\b/i.test(inbound_message);

    let reply: string;
    let newStage = "scripting";

    if (isApproval) {
      reply = "Amazing! Scripts locked in 🎉 I'll start on the video editing now — you'll get a preview soon!";
      newStage = "editing";

      await supabase.from("lead_pipeline").update({
        stage: "editing",
        scripts_approved: true,
        message_history: [...updatedHistory, { role: "assistant", content: reply, ts: new Date().toISOString() }],
        last_reply_at: new Date().toISOString(),
      }).eq("id", lead_id);

      await notifyTelegram(`✅ Scripts approved by ${row.handle}! Moving to editing.`);
    } else {
      // Revision requested — acknowledge and note
      reply = "Got it! I'll revise that and send you an update in the portal shortly 🙏";
      await supabase.from("lead_pipeline").update({
        message_history: [...updatedHistory, { role: "assistant", content: reply, ts: new Date().toISOString() }],
        last_reply_at: new Date().toISOString(),
        notes: `Script revision requested: ${inbound_message}`,
      }).eq("id", lead_id);
    }

    await sendDM(row.platform, row.handle, reply);

    return NextResponse.json({ ok: true, stage: newStage, reply, approved: isApproval });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

async function sendDM(platform: string, handle: string, message: string): Promise<void> {
  const result = await zernioDM({ platform, handle, message });
  if (!result.ok) console.error("[leadgen/scripts] Zernio send failed:", result.error);
}

async function notifyTelegram(msg: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  }).catch(() => {});
}
