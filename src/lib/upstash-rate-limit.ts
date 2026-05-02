/**
 * Distributed rate-limit helper backed by Upstash Redis.
 *
 * Soft-fail contract: if UPSTASH_REDIS_REST_URL / TOKEN are not set,
 * every call returns { success: true } so the app keeps working.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "@/lib/redis/client";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  reset: number;
}

/** No-op result used when Redis is not configured. */
const SOFT_FAIL_RESULT: RateLimitResult = {
  success: true,
  limit: 0,
  remaining: 0,
  reset: 0,
};

// Cache one Ratelimit instance per (limit, window) tuple so we don't
// re-construct on every request.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, window: string): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = `${limit}:${window}`;
  if (limiterCache.has(key)) return limiterCache.get(key)!;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window as `${number} ${"s" | "m" | "h" | "d"}`),
    analytics: false,
  });
  limiterCache.set(key, limiter);
  return limiter;
}

/**
 * Check the distributed rate limit for an identifier (usually IP + route).
 *
 * @param identifier - Unique key, e.g. `"ip:1.2.3.4:auth"`
 * @param limit      - Max requests per window (default 60)
 * @param window     - Sliding window duration, e.g. `"1 m"` or `"30 s"` (default "1 m")
 */
export async function rateLimit(
  identifier: string,
  limit = 60,
  window = "1 m"
): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, window);
  if (!limiter) return SOFT_FAIL_RESULT;

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: Math.floor(result.reset / 1000), // convert ms → seconds
    };
  } catch {
    // Redis unreachable — soft-fail, don't block traffic.
    console.warn("[upstash-rate-limit] Redis call failed — soft-failing open");
    return SOFT_FAIL_RESULT;
  }
}
