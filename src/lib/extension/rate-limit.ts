/**
 * Simple in-memory sliding-window rate limiter for extension routes.
 *
 * SECURITY: /api/extension/chat proxies Anthropic with our server-side key,
 * so without a rate limit a compromised token could burn through credits.
 * We cap per-user requests here as a cheap first line of defense.
 *
 * Note: this is an in-memory limiter — it resets on server restart and is
 * not shared across Vercel serverless instances. That's acceptable for
 * now (each instance still enforces a cap) but should move to Redis/KV
 * when the extension graduates beyond single-instance hosting.
 */

type Bucket = { timestamps: number[] };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Drop timestamps outside the window.
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterSec: 0,
  };
}
