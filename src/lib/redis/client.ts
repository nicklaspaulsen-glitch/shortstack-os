/**
 * Lazy Upstash Redis singleton.
 *
 * Required env vars (from upstash.com console -> REST API):
 *   UPSTASH_REDIS_REST_URL=https://...upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=AX...
 *
 * Soft-fail: if either env var is absent the module exports `null` so
 * callers can skip rate limiting without throwing.
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
let _initialized = false;

/**
 * Returns a shared Redis client, or null if the env vars are not set.
 * Safe to call from Edge runtime (Next.js middleware).
 */
export function getRedisClient(): Redis | null {
  if (_initialized) return _redis;
  _initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Soft-fail: rate limiting is a no-op when Redis is not configured.
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

