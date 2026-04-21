import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { handleGHLCallWebhook } from "@/lib/services/cold-calling";

// DEPRECATED Apr 21 — Legacy GHL inbound webhook. Retained only so any
// lingering GHL workflows pointing at this URL don't 404 during cutover.
// Verified via shared secret in query param or header. All payloads are
// logged to trinity_log and no further action is taken.
// TODO: delete once no external system posts here anymore.
export async function POST(request: NextRequest) {
  // Verify webhook authenticity via shared secret
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("x-webhook-key");
  const expectedKey = process.env.GHL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

  if (!expectedKey || !key || key !== expectedKey) {
    return NextResponse.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  const supabase = createServiceClient();

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Handle different GHL webhook types
  const type = payload.type || payload.event;

  if (type === "CallCompleted" || type === "call.completed") {
    await handleGHLCallWebhook(supabase, payload);
  }

  return NextResponse.json({ ok: true });
}
