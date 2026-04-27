/**
 * Webhook event dispatch for the Public API.
 *
 * Internal callers fire events via `fireWebhookEvent({ userId, event, payload })`.
 * For each user-owned subscription that listens to that event, we enqueue a
 * `webhook_deliveries` row. The cron at `/api/cron/deliver-webhooks` picks up
 * pending rows, signs them with HMAC-SHA256 using the per-subscription
 * secret, POSTs to the user's URL, and retries with exponential backoff.
 *
 * Catalog of public events. Keep in sync with docs/PUBLIC_API.md.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export type WebhookEvent =
  | "lead.created"
  | "lead.updated"
  | "lead.deleted"
  | "deal.created"
  | "deal.updated"
  | "deal.stage_changed"
  | "deal.won"
  | "deal.lost"
  | "contact.created"
  | "contact.updated"
  | "email.sent"
  | "email.opened"
  | "email.clicked"
  | "email.replied"
  | "form.submitted"
  | "appointment.booked";

export const WEBHOOK_EVENTS: ReadonlyArray<WebhookEvent> = [
  "lead.created",
  "lead.updated",
  "lead.deleted",
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "contact.created",
  "contact.updated",
  "email.sent",
  "email.opened",
  "email.clicked",
  "email.replied",
  "form.submitted",
  "appointment.booked",
];

interface FireOptions {
  /** Service-role supabase client (caller already has one). */
  supabase: SupabaseClient;
  /** Owner of the subscription set to fire against. */
  userId: string;
  /** Event name (must match WebhookEvent). */
  event: WebhookEvent;
  /** Arbitrary JSON payload. Will be serialized + signed. */
  payload: Record<string, unknown>;
}

interface SubscriptionRow {
  id: string;
  events: string[];
}

/**
 * Enqueue a delivery row per matching active subscription. Fire-and-forget
 * from the caller's perspective — does not block on actual HTTP delivery.
 *
 * Errors are logged but never thrown to the caller; webhook delivery must
 * never break a user-facing API response.
 */
export async function fireWebhookEvent(opts: FireOptions): Promise<void> {
  const { supabase, userId, event, payload } = opts;
  try {
    const { data: subs, error } = await supabase
      .from("api_webhooks")
      .select("id, events")
      .eq("user_id", userId)
      .eq("active", true);

    if (error) {
      console.error("[webhook-events] subscription lookup failed", error);
      return;
    }

    const matching = (subs as SubscriptionRow[] | null)?.filter((s) =>
      Array.isArray(s.events) && s.events.includes(event),
    ) ?? [];

    if (matching.length === 0) return;

    const enriched = {
      event,
      delivered_at: new Date().toISOString(),
      data: payload,
    };

    const rows = matching.map((s) => ({
      webhook_id: s.id,
      user_id: userId,
      event,
      payload: enriched,
    }));

    const { error: insertErr } = await supabase
      .from("webhook_deliveries")
      .insert(rows);

    if (insertErr) {
      console.error("[webhook-events] failed to enqueue deliveries", insertErr);
    }
  } catch (err) {
    console.error("[webhook-events] fireWebhookEvent threw", err);
  }
}

/**
 * Sign a webhook payload with HMAC-SHA256 using the subscription's secret.
 * Returns the hex digest that should be sent in `x-shortstack-signature`.
 */
export function signWebhookPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Compute the next attempt timestamp for a delivery attempt.
 * Exponential backoff capped at 6 attempts: 1m, 5m, 30m, 2h, 12h, 24h.
 */
export function computeNextAttempt(attemptCount: number): Date {
  const delaysMinutes = [1, 5, 30, 120, 720, 1440];
  const idx = Math.min(attemptCount, delaysMinutes.length - 1);
  return new Date(Date.now() + delaysMinutes[idx] * 60_000);
}

/** True when no further retries should be attempted. */
export function isPermanentFailure(attemptCount: number): boolean {
  return attemptCount >= 6;
}
