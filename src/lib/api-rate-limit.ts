import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRateLimit } from "@/lib/plan-config";

/**
 * Check AI rate limit for a user. Returns null if allowed,
 * or a 429 NextResponse if rate-limited.
 *
 * Usage in any API route:
 *   const limited = checkAiRateLimit(user.id, profile?.plan_tier);
 *   if (limited) return limited;
 */
export function checkAiRateLimit(
  userId: string,
  planTier?: string | null
): NextResponse | null {
  const maxPerMin = getAiRateLimit(planTier);
  const result = rateLimit(`ai:${userId}`, maxPerMin);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a moment and try again.",
        retry_after_ms: result.resetAt - Date.now(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // allowed
}
