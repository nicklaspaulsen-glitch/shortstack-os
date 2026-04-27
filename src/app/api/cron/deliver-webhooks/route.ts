/**
 * Outbound webhook delivery cron.
 *
 * Picks up to N pending or retry-due deliveries, signs them with HMAC-SHA256
 * using the per-subscription secret, POSTs to the user's URL, and updates
 * the row to delivered/retrying/failed.
 *
 * Runs every minute via Vercel Cron. Caller auth: x-vercel-cron header
 * (auto-injected) or Authorization: Bearer ${CRON_SECRET}.
 *
 * Backoff schedule: see computeNextAttempt() in webhook-events.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeNextAttempt,
  isPermanentFailure,
  signWebhookPayload,
} from "@/lib/api/webhook-events";

export const maxDuration = 60;

interface DeliveryRow {
  id: string;
  webhook_id: string;
  user_id: string;
  event: string;
  payload: unknown;
  attempt_count: number;
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  active: boolean;
}

const BATCH_SIZE = 25;

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization");
  const hasBearer = auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: deliveries, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, user_id, event, payload, attempt_count")
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[deliver-webhooks] fetch failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Cache webhook rows so we don't refetch per delivery.
  const webhookIds = Array.from(
    new Set((deliveries as DeliveryRow[]).map((d) => d.webhook_id)),
  );
  const { data: webhooks } = await supabase
    .from("api_webhooks")
    .select("id, url, secret, active")
    .in("id", webhookIds);
  const webhookMap = new Map<string, WebhookRow>(
    (webhooks ?? []).map((w) => [(w as WebhookRow).id, w as WebhookRow]),
  );

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  let skipped = 0;

  for (const d of deliveries as DeliveryRow[]) {
    const webhook = webhookMap.get(d.webhook_id);
    if (!webhook || !webhook.active) {
      // Subscription inactive or missing — mark failed, no retry.
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          last_error: webhook ? "subscription inactive" : "subscription missing",
          attempt_count: d.attempt_count + 1,
        })
        .eq("id", d.id);
      skipped++;
      continue;
    }

    const body = JSON.stringify(d.payload);
    const signature = signWebhookPayload(webhook.secret, body);

    let responseStatus = 0;
    let errorMessage: string | null = null;
    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ShortStack-Webhooks/1.0",
          "x-shortstack-signature": signature,
          "x-shortstack-event": d.event,
          "x-shortstack-delivery-id": d.id,
        },
        body,
        // Vercel Edge fetch defaults are fine; native HTTP timeout will trip
        // around 30s if the user URL hangs.
        signal: AbortSignal.timeout(15_000),
      });
      responseStatus = res.status;
      if (!res.ok) {
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const isSuccess = !errorMessage && responseStatus >= 200 && responseStatus < 300;

    if (isSuccess) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempt_count: d.attempt_count + 1,
          response_status: responseStatus,
          delivered_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", d.id);
      delivered++;
      continue;
    }

    const nextAttempts = d.attempt_count + 1;
    if (isPermanentFailure(nextAttempts)) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          attempt_count: nextAttempts,
          response_status: responseStatus || null,
          last_error: errorMessage,
        })
        .eq("id", d.id);
      failed++;
    } else {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "retrying",
          attempt_count: nextAttempts,
          response_status: responseStatus || null,
          next_attempt_at: computeNextAttempt(nextAttempts).toISOString(),
          last_error: errorMessage,
        })
        .eq("id", d.id);
      retrying++;
    }
  }

  return NextResponse.json({
    processed: deliveries.length,
    delivered,
    retrying,
    failed,
    skipped,
  });
}
