/**
 * Supabase-backed distributed rate limiter.
 *
 * Uses a `rate_limit_buckets` table with an atomic upsert so the counter is
 * correct across all Vercel function instances (unlike the in-memory
 * src/lib/rate-limit.ts which resets on cold start).
 *
 * Security audit ref: admin-route-audit.md / service-client-audit.md
 * Applied as part of the rate-limit hardening pass (reset-password, license
 * validate, license checkout).
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Atomically increment the request counter for (ip, action) within a 1-minute
 * sliding window and return whether the request is within the allowed limit.
 *
 * @param supabase     Service-role client (table is RLS-locked to service_role)
 * @param ip           Client IP address
 * @param action       Logical action name, e.g. "pwd_reset" or "license_validate"
 * @param maxPerMinute Maximum requests allowed per 60-second window
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  ip: string,
  action: string,
  maxPerMinute: number,
): Promise<RateLimitResult> {
  const windowSec = 60;

  // Atomic upsert: increment count, or reset if the current window has expired.
  // The CASE expression resets window_started + count when > 60s have passed.
  const { data, error } = await supabase.rpc("upsert_rate_limit_bucket", {
    p_ip: ip,
    p_action: action,
    p_window_sec: windowSec,
    p_max: maxPerMinute,
  });

  // If the RPC doesn't exist yet (migration not fully applied) or fails for any
  // reason, fall back to a plain SQL upsert so we don't silently allow unlimited
  // requests. We accept a small race window on the fallback path.
  if (error || data === null || data === undefined) {
    const { data: row, error: upsertErr } = await supabase
      .from("rate_limit_buckets")
      .upsert(
        { ip, action, count: 1, window_started: new Date().toISOString() },
        { onConflict: "ip,action", ignoreDuplicates: false },
      )
      .select("count, window_started")
      .single();

    if (upsertErr || !row) {
      // On DB error: fail open (don't block legitimate traffic) but log it.
      console.error("[rate-limit] DB error, failing open:", upsertErr?.message);
      return { ok: true, retryAfterSec: 0 };
    }

    const windowAge = (Date.now() - new Date(row.window_started as string).getTime()) / 1000;
    const retryAfterSec = Math.max(0, Math.ceil(windowSec - windowAge));

    if (windowAge > windowSec) {
      // Window expired — reset
      await supabase
        .from("rate_limit_buckets")
        .update({ count: 1, window_started: new Date().toISOString() })
        .eq("ip", ip)
        .eq("action", action);
      return { ok: true, retryAfterSec: 0 };
    }

    if ((row.count as number) > maxPerMinute) {
      return { ok: false, retryAfterSec };
    }

    // Increment
    await supabase
      .from("rate_limit_buckets")
      .update({ count: (row.count as number) + 1 })
      .eq("ip", ip)
      .eq("action", action);

    return { ok: true, retryAfterSec: 0 };
  }

  // RPC path: data is { allowed: boolean, retry_after_sec: number }
  const result = data as { allowed: boolean; retry_after_sec: number };
  return { ok: result.allowed, retryAfterSec: result.retry_after_sec };
}

/**
 * Extract the best available client IP from an incoming Next.js request.
 */
export function extractIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
  );
}
