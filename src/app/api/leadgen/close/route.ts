import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/close
 *
 * Called by n8n (or the AI qualify loop) when the AI detects the lead has
 * agreed to work together (or wants a meeting before committing).
 *
 * Auth: session bearer OR x-webhook-key header (for n8n server-to-server calls).
 *
 * Body:
 *   lead_id        string   — lead_pipeline.id
 *   outcome        "agreed" | "meeting_requested" | "closed"
 *   deal_notes?    string   — summary of what was agreed
 *   deal_value?    number   — estimated deal value (EUR/USD)
 *   notify_telegram? boolean — send Telegram alert (default true)
 */

const TELEGRAM_MESSAGES: Record<string, string> = {
  agreed: "🤝 Lead agreed to work together!",
  meeting_requested: "📅 Lead wants a meeting before committing.",
  closed: "💰 Deal CLOSED in DMs!",
};

export async function POST(request: NextRequest) {
  // Auth — session or webhook key
  const webhookKey = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  let ownerId: string | null = null;

  if (webhookKey && expectedKey && webhookKey === expectedKey) {
    // n8n server-to-server — owner id must be in the body
    const raw = await request.json();
    ownerId = raw.owner_id ?? null;
    if (!ownerId) {
      return NextResponse.json({ error: "owner_id required for webhook auth" }, { status: 400 });
    }
    return handleClose(raw, ownerId);
  }

  // Session auth
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  ownerId = user.id;

  const body = await request.json();
  return handleClose(body, ownerId);
}

async function handleClose(
  body: Record<string, unknown>,
  ownerId: string,
): Promise<NextResponse> {
  const { lead_id, outcome, deal_notes, deal_value, notify_telegram = true } = body as {
    lead_id: string;
    outcome: "agreed" | "meeting_requested" | "closed";
    deal_notes?: string;
    deal_value?: number;
    notify_telegram?: boolean;
  };

  if (!lead_id || !outcome) {
    return NextResponse.json({ error: "lead_id and outcome required" }, { status: 400 });
  }
  if (!["agreed", "meeting_requested", "closed"].includes(outcome)) {
    return NextResponse.json({ error: "outcome must be agreed|meeting_requested|closed" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Ownership guard
  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, display_name, stage, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Lead not found or not owned by caller" }, { status: 404 });
  }

  // Determine new stage
  const newStage = outcome === "meeting_requested" ? "qualified" : "closed";
  const updatePayload: Record<string, unknown> = {
    stage: newStage,
    notes: deal_notes ?? row.stage,
    last_tg_notif_at: new Date().toISOString(),
    tg_notif_type: outcome,
  };
  if (outcome === "closed" || outcome === "agreed") {
    updatePayload.closed_at = new Date().toISOString();
    if (deal_value) updatePayload.deal_value_estimate = deal_value;
  }
  if (outcome === "meeting_requested") {
    updatePayload.meeting_requested = true;
  }

  const { error: updateErr } = await supabase
    .from("lead_pipeline")
    .update(updatePayload)
    .eq("id", lead_id);

  if (updateErr) {
    console.error("[leadgen/close] DB update failed:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Trinity log
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Leadgen: ${outcome} — ${row.display_name ?? row.handle} (${row.platform})`,
    status: "completed",
    result: { lead_id, outcome, deal_notes, deal_value },
  });

  // Telegram notification
  if (notify_telegram) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      const name = row.display_name ?? row.handle;
      const msg = [
        TELEGRAM_MESSAGES[outcome],
        `👤 ${name} on ${row.platform}`,
        deal_value ? `💵 Est. value: $${deal_value}` : null,
        deal_notes ? `📝 ${deal_notes}` : null,
      ].filter(Boolean).join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    lead_id,
    outcome,
    new_stage: newStage,
    telegram_sent: notify_telegram,
  });
}
