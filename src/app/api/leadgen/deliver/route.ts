import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/deliver
 *
 * Marks a lead's pipeline as delivered and sends a final DM with the deliverables.
 * Transitions to stage=delivered.
 *
 * Called by n8n after:
 *   1. Payment confirmed (Stripe webhook updates payment_received_at)
 *   2. Videos/thumbnails are ready
 *
 * Auth: session bearer OR x-webhook-key + owner_id
 *
 * Body:
 *   lead_id          string   — lead_pipeline.id
 *   deliverable_urls string[] — public URLs to the finished files
 *   delivery_message? string  — custom message (AI generates one if omitted)
 *   owner_id?        string   — for webhook auth
 */

const DEFAULT_DELIVERY_MESSAGE = (name: string, urls: string[]) => [
  `Hey ${name}! Everything is done and ready for you 🎉`,
  ``,
  `Here are your deliverables:`,
  ...urls.map((u, i) => `${i + 1}. ${u}`),
  ``,
  `All files are also available in your client portal.`,
  ``,
  `Let me know what you think — and when you're ready for the next batch, just message me! 🚀`,
].join("\n");

export async function POST(request: NextRequest) {
  const webhookKey = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  let ownerId: string | null = null;
  let body: Record<string, unknown>;

  if (webhookKey && expectedKey && secureCompare(webhookKey, expectedKey)) {
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

  const {
    lead_id,
    deliverable_urls = [],
    delivery_message,
  } = body as {
    lead_id: string;
    deliverable_urls?: string[];
    delivery_message?: string;
    owner_id?: string;
  };

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, display_name, stage, owner_id, message_history")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const name = row.display_name ?? row.handle;
  const finalMessage = delivery_message ?? DEFAULT_DELIVERY_MESSAGE(name, deliverable_urls);

  // Append to conversation history
  const history = (row.message_history as Array<{ role: string; content: string; ts: string }>) || [];
  const newHistory = [...history, { role: "assistant", content: finalMessage, ts: new Date().toISOString() }];

  const { error: updateErr } = await supabase.from("lead_pipeline").update({
    stage: "delivered",
    delivered_at: new Date().toISOString(),
    delivery_notes: deliverable_urls.join("\n"),
    message_history: newHistory,
  }).eq("id", lead_id);

  if (updateErr) {
    console.error("[leadgen/deliver] DB update failed:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Send delivery DM via Zernio
  const dmResult = await zernioDM({ platform: row.platform, handle: row.handle, message: finalMessage });
  if (!dmResult.ok) {
    console.error("[leadgen/deliver] Zernio DM send failed:", dmResult.error);
  }

  // Trinity log
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Deliverables sent to ${name} (${row.platform})`,
    status: "completed",
    user_id: ownerId,
    result: { lead_id, deliverable_urls },
  });

  // Telegram
  await notifyTelegram(`✅ Work delivered to ${name}!\n${deliverable_urls.length} file(s) sent via DM.`);

  // Schedule re-engagement task 3 days from now to close the "rinse and repeat" loop
  try {
    const reengageAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("agent_task_queue").insert({
      owner_id: ownerId,
      task_type: "reengage",
      agent_key: "content-pipeline",
      priority: 30, // low priority, not urgent
      payload: { lead_id },
      pipeline_id: lead_id,
      status: "queued",
      scheduled_for: reengageAt,
    });
  } catch (err) {
    // Re-engagement scheduling is non-critical
    console.warn("[leadgen/deliver] Failed to schedule re-engagement:", err);
  }

  return NextResponse.json({
    ok: true,
    stage: "delivered",
    message: finalMessage,
    deliverable_urls,
  });
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
