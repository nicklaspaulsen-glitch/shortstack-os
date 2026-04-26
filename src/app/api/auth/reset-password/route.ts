/**
 * Security fixes (service-client-audit.md — HIGH):
 *
 * 1. Replaced createServiceClient() with createServerSupabase() for the
 *    resetPasswordForEmail call. The service-role key was overprivileged here
 *    — password reset only needs the anon-key Supabase Auth API endpoint,
 *    not RLS bypass capability.
 *
 * 2. Replaced the in-memory rate limiter (src/lib/rate-limit.ts) with the
 *    Supabase-backed checkRateLimit() helper. The in-memory limiter reset on
 *    every cold start, providing no meaningful protection on serverless.
 *    The new helper writes atomically to rate_limit_buckets (service_role
 *    access, RLS locked) so counts survive across function instances.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, extractIp } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const normalizedEmail = String(email).trim().toLowerCase();
  const ip = extractIp(request);

  // Supabase-backed rate limits: per-email 3/min, per-IP 10/min.
  // Service client required because rate_limit_buckets is locked to service_role.
  const rateLimitClient = createServiceClient();
  const [perEmail, perIp] = await Promise.all([
    checkRateLimit(rateLimitClient, `email:${normalizedEmail}`, "pwd_reset", 3),
    checkRateLimit(rateLimitClient, `ip:${ip}`, "pwd_reset", 10),
  ]);
  if (!perEmail.ok || !perIp.ok) {
    const retryAfter = Math.max(perEmail.retryAfterSec, perIp.retryAfterSec);
    // Codex round-3 catch: message used to say "Try again in an hour"
    // but the limiter is per-minute. Now reflects the real Retry-After.
    const minutes = Math.ceil(retryAfter / 60);
    return NextResponse.json(
      {
        error:
          retryAfter > 0
            ? `Too many password reset requests. Try again in ${minutes <= 1 ? "a minute" : `${minutes} minutes`}.`
            : "Too many password reset requests. Try again shortly.",
      },
      {
        status: 429,
        headers: retryAfter > 0 ? { "Retry-After": String(retryAfter) } : {},
      },
    );
  }

  // Use the anon-key client — resetPasswordForEmail does not need service_role.
  const supabase = createServerSupabase();

  // Fire-and-forget: never leak whether the email exists in the user table.
  await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/login?reset=true`,
  });

  // Always return a generic success so callers can't enumerate valid emails.
  return NextResponse.json({ success: true });
}
