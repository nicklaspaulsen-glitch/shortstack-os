// Webhook idempotency helper — claim/complete model.
//
// Provider webhooks (Stripe, Resend, Twilio, Telegram, Zapier, GHL) ALL retry
// on non-2xx responses. Stripe specifically can replay an event for up to 3
// days. Without dedup at the handler level, retries cause real money bugs:
//   - Double-credit bonus_tokens on /billing/webhook
//   - Domain auto-purchase fires twice on a single Stripe checkout
//   - Resend events re-fire workflow triggers on every retry
//   - Telegram updates re-run autopilot (7 cron endpoints) per retry
//
// Round 1 of this helper inserted (provider, event_id) BEFORE the work ran.
// Codex round-1 review caught the bug: if the handler throws partway through,
// Stripe retries would hit the dedup row and short-circuit to 200 OK,
// permanently dropping the unfinished work. Fixed in v2 (this file) with a
// claim/complete model:
//
//   1. claimEvent() — INSERT with status='processing'. If row exists and is
//      'done' → return ALREADY_DONE. If row exists and is 'processing' but
//      stale (>5 min), reclaim. If row exists and is fresh 'processing'
//      → return IN_FLIGHT (another worker has it).
//   2. Handler runs the actual work.
//   3. completeEvent() — UPDATE status='done'. Now retries see ALREADY_DONE.
//   4. Handler error → leave the row as 'processing'. Provider will retry
//      after timeout, hit the stale-claim branch, and we'll re-run.
//
// Usage:
//
//   const claim = await claimEvent(supabase, "stripe", event.id);
//   if (claim === "already_done") return NextResponse.json({ ok: true, deduped: true });
//   if (claim === "in_flight")    return NextResponse.json({ ok: true, in_flight: true });
//   try {
//     // ... handler logic
//     await completeEvent(supabase, "stripe", event.id);
//   } catch (err) {
//     // Don't markComplete — leave the row as 'processing' so retry can pick it up.
//     throw err;
//   }
//
// Backed by the `processed_events(provider, event_id, status, attempts)` table.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimResult = "fresh" | "already_done" | "in_flight";

/** How long a 'processing' row is considered live before another worker
 *  can reclaim it. Stripe's longest single-attempt timeout is ~30s; 5 min
 *  is generous safety margin. */
const STALE_CLAIM_AGE_MS = 5 * 60 * 1000;

/**
 * Try to claim an event for processing. Atomic via Postgres unique
 * constraint on (provider, event_id).
 *
 * Returns:
 *   - "fresh"        → caller should run the handler then call completeEvent
 *   - "already_done" → caller should return 200 dedup (work already done)
 *   - "in_flight"    → another worker is processing this event; caller
 *                      should return 200 to ack the retry without acting
 */
export async function claimEvent(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<ClaimResult> {
  if (!eventId) {
    console.warn(
      `[idempotency] missing event_id for provider=${provider} — handler will run without dedup`,
    );
    return "fresh";
  }

  // Try to claim with a fresh INSERT. If conflict, fall through to lookup.
  const { error: insErr } = await supabase
    .from("processed_events")
    .insert({ provider, event_id: eventId, status: "processing", attempts: 1 });
  if (!insErr) return "fresh";

  // 23505 = unique violation = row already exists. Look up its state.
  if (insErr.code !== "23505") {
    console.error(
      `[idempotency] insert error for provider=${provider} event=${eventId}:`,
      insErr.message,
    );
    // Fail-open: better to risk a duplicate than silently drop.
    return "fresh";
  }

  const { data: existing } = await supabase
    .from("processed_events")
    .select("status, processed_at, attempts")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!existing) return "fresh"; // race — let handler run

  if (existing.status === "done") return "already_done";

  // status === 'processing' — check if it's stale (handler crashed)
  const oldTimestamp = existing.processed_at as string;
  const claimedAt = new Date(oldTimestamp).getTime();
  const ageMs = Date.now() - claimedAt;
  if (ageMs > STALE_CLAIM_AGE_MS) {
    // Reclaim with compare-and-swap on processed_at. Two simultaneous
    // retries arriving 5+ min after the original claim must NOT both
    // win — that would double-process the webhook. The CAS guard
    // (`status='processing' AND processed_at=oldTimestamp`) means only
    // one worker's UPDATE matches a row; the other gets 0 rows and
    // returns in_flight/already_done.
    const { data: updated, error: updErr } = await supabase
      .from("processed_events")
      .update({
        processed_at: new Date().toISOString(),
        attempts: (existing.attempts || 1) + 1,
      })
      .eq("provider", provider)
      .eq("event_id", eventId)
      .eq("status", "processing")
      .eq("processed_at", oldTimestamp) // CAS — only the worker that read this exact timestamp wins
      .select("event_id");

    if (updErr) {
      console.error("[idempotency] reclaim CAS failed:", updErr.message);
      // Safer to assume someone else has it than to risk double-processing.
      return "in_flight";
    }

    if (!updated || updated.length === 0) {
      // Lost the CAS race. Re-read to figure out who won and how.
      const { data: refreshed } = await supabase
        .from("processed_events")
        .select("status")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .maybeSingle();
      if (refreshed?.status === "done") return "already_done";
      return "in_flight";
    }

    return "fresh"; // we won the CAS reclaim
  }

  // Fresh claim by another worker — let them finish. Return 200 to ack the
  // retry without doing the work twice.
  return "in_flight";
}

/**
 * Mark an event as successfully processed. Call AFTER the handler's work
 * has succeeded. Subsequent retries will see status='done' and short-circuit.
 */
export async function completeEvent(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<void> {
  if (!eventId) return;
  const { error } = await supabase
    .from("processed_events")
    .update({ status: "done" })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) {
    console.error(
      `[idempotency] complete error for provider=${provider} event=${eventId}:`,
      error.message,
    );
  }
}

/**
 * Convenience: combines claim + early-return JSON. Returns the response
 * the handler should return on dedup, or null if handler should proceed.
 *
 * Pair with completeEvent() at the end of successful handler logic:
 *
 *   const dedup = await checkAndShortCircuit(svc, "stripe", event.id);
 *   if (dedup) return NextResponse.json(dedup);
 *   // ... handler ...
 *   await completeEvent(svc, "stripe", event.id);
 */
export async function checkAndShortCircuit(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<{ ok: true; deduped: boolean; in_flight?: boolean; provider: string; event_id: string } | null> {
  const claim = await claimEvent(supabase, provider, eventId);
  if (claim === "already_done") {
    return { ok: true as const, deduped: true, provider, event_id: eventId };
  }
  if (claim === "in_flight") {
    return { ok: true as const, deduped: true, in_flight: true, provider, event_id: eventId };
  }
  return null;
}

/**
 * Back-compat shim. Kept so existing callers that imported the old name
 * keep compiling. Prefer claimEvent + completeEvent in new code.
 *
 * @deprecated use claimEvent + completeEvent for the correct claim/complete model.
 */
export async function alreadyProcessed(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<boolean> {
  const claim = await claimEvent(supabase, provider, eventId);
  return claim === "already_done";
}
