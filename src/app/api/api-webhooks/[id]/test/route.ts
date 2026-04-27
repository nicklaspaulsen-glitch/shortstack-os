/**
 * POST /api/api-webhooks/{id}/test
 *
 * Enqueue a synthetic webhook delivery for the dashboard "Send test" button.
 * The actual HTTP POST happens via the cron processor — same path as production.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: webhook, error: lookupErr } = await supabase
    .from("api_webhooks")
    .select("id, events, active")
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const event = "lead.created"; // pick a representative event for the test
  const { error: insertErr } = await service.from("webhook_deliveries").insert({
    webhook_id: webhook.id,
    user_id: user.id,
    event,
    payload: {
      event,
      delivered_at: new Date().toISOString(),
      data: {
        test: true,
        message: "Test delivery from ShortStack OS dashboard",
      },
    },
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    note: "Test delivery enqueued. The cron will dispatch within the next minute.",
  });
}
