/**
 * Simple in-memory rate limiter for serverless.
 * Each Vercel function instance maintains its own bucket map.
 * Not distributed — upgrade to Upstash Redis for perfect accuracy.
 * Provides baseline protection against abuse and cost runaway.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Clean stale buckets every 60s to prevent memory leak
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  buckets.forEach((bucket, key) => {
    if (now > bucket.resetAt) buckets.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * @param key - Unique identifier (e.g. `ai:${userId}`)
 * @param maxRequests - Max requests allowed in the window. -1 = unlimited.
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 min)
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60_000
): RateLimitResult {
  // -1 means unlimited
  if (maxRequests === -1) {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return {
    allowed: true,
    remaining: maxRequests - bucket.count,
    resetAt: bucket.resetAt,
  };
}
