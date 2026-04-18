import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRateLimit } from "@/lib/plan-config";
import { getUserUsageLimits, effectiveDailyCap, type UsageKind } from "@/lib/usage-limits";

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

/**
 * Check a daily usage cap for a given kind (tokens, videos, thumbnails, emails).
 * Respects the user's custom cap (profiles.onboarding_preferences.usage_limits)
 * when set and positive; otherwise falls back to the plan-level cap passed in.
 *
 * Returns null when allowed, or a 429 NextResponse when the cap is exceeded.
 */
export async function checkDailyUsageCap(
  userId: string,
  kind: UsageKind,
  planFallbackCap: number,
  currentUsed: number
): Promise<NextResponse | null> {
  const userLimits = await getUserUsageLimits(userId);
  const cap = effectiveDailyCap(kind, userLimits, planFallbackCap);
  if (cap <= 0) return null; // 0 / missing cap = unlimited
  if (currentUsed < cap) return null;
  return NextResponse.json(
    {
      error: `Daily ${kind} limit reached (${currentUsed}/${cap}). Adjust your limit in Settings → Usage Limits.`,
      kind,
      used: currentUsed,
      cap,
    },
    { status: 429 }
  );
}
