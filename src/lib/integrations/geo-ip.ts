/**
 * IP geolocation — ipapi.co (primary, 1k req/day) with ip-api.com fallback
 * (45 req/min). Both work without API keys at low volume.
 *
 * Used for:
 *   - Lead/contact enrichment on form submission (so the agency can see
 *     "Copenhagen, DK · 09:42 local time" next to a fresh lead).
 *   - Form submit analytics.
 *   - Outreach feed local-time-of-recipient display.
 *
 * CACHING:
 *   - In-memory Map (process-local) for sub-ms repeat lookups within a
 *     hot lambda.
 *   - Postgres `geo_ip_cache` table (7-day TTL) for cross-request and
 *     cross-lambda persistence. Service-role only.
 *
 * SOFT-FAIL:
 *   - Returns `null` on any failure. Never throws. Callers MUST treat
 *     null as "no enrichment available" and continue.
 *
 * PRIVACY:
 *   - Only stores aggregate-level fields (country, city, ISP, lat/lon at
 *     ~50km accuracy). No browser fingerprinting or device IDs.
 */

import { createServiceClient } from "@/lib/supabase/server";

const FETCH_TIMEOUT_MS = 5_000;
const MEMORY_TTL_MS = 60 * 60 * 1_000; // 1 hour for in-memory; DB cache is 7 days

export interface GeoLookup {
  ip: string;
  country_code: string;
  country_name: string;
  region: string | null;
  city: string | null;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  source: "ipapi.co" | "ip-api.com" | "cache";
}

interface MemoryCacheEntry {
  result: GeoLookup;
  cached_at: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

function isPrivateOrInvalidIp(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return true;
  // RFC1918 / loopback / link-local ranges — skip lookup for these.
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] || "0", 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // IPv6 ULA
  return false;
}

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface IpApiCoResponse {
  ip?: string;
  country_code?: string;
  country_name?: string;
  region?: string;
  city?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  org?: string;
  asn?: string;
  error?: boolean;
  reason?: string;
}

interface IpApiComResponse {
  status?: string;
  message?: string;
  query?: string;
  countryCode?: string;
  country?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
}

async function lookupIpApiCo(ip: string): Promise<GeoLookup | null> {
  const res = await timedFetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    headers: { "User-Agent": "ShortStack-OS/1.0" },
  });
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as IpApiCoResponse;
    if (json.error || !json.country_code) return null;
    return {
      ip,
      country_code: json.country_code,
      country_name: json.country_name || json.country_code,
      region: json.region || null,
      city: json.city || null,
      postal: json.postal || null,
      latitude: typeof json.latitude === "number" ? json.latitude : null,
      longitude: typeof json.longitude === "number" ? json.longitude : null,
      timezone: json.timezone || null,
      isp: json.org || null,
      source: "ipapi.co",
    };
  } catch {
    return null;
  }
}

async function lookupIpApiCom(ip: string): Promise<GeoLookup | null> {
  // ip-api.com is HTTP-only on the free tier — explicit http://. The hosted
  // Vercel runtime allows outbound HTTP.
  const res = await timedFetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,countryCode,country,regionName,city,zip,lat,lon,timezone,isp,org,as`,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as IpApiComResponse;
    if (json.status !== "success" || !json.countryCode) return null;
    return {
      ip,
      country_code: json.countryCode,
      country_name: json.country || json.countryCode,
      region: json.regionName || null,
      city: json.city || null,
      postal: json.zip || null,
      latitude: typeof json.lat === "number" ? json.lat : null,
      longitude: typeof json.lon === "number" ? json.lon : null,
      timezone: json.timezone || null,
      isp: json.isp || json.org || null,
      source: "ip-api.com",
    };
  } catch {
    return null;
  }
}

interface DbCacheRow {
  ip: string;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  source: string | null;
  expires_at: string;
}

async function readDbCache(ip: string): Promise<GeoLookup | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("geo_ip_cache")
      .select("ip, country_code, country_name, region, city, postal, latitude, longitude, timezone, isp, source, expires_at")
      .eq("ip", ip)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as DbCacheRow;
    // Honour the 7-day TTL — even though the index purges expired rows on
    // a cron, a stale read here would leak old data.
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    if (!row.country_code) return null;
    return {
      ip: row.ip,
      country_code: row.country_code,
      country_name: row.country_name || row.country_code,
      region: row.region,
      city: row.city,
      postal: row.postal,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      isp: row.isp,
      source: "cache",
    };
  } catch {
    return null;
  }
}

async function writeDbCache(lookup: GeoLookup): Promise<void> {
  try {
    const supabase = createServiceClient();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("geo_ip_cache")
      .upsert({
        ip: lookup.ip,
        country_code: lookup.country_code,
        country_name: lookup.country_name,
        region: lookup.region,
        city: lookup.city,
        postal: lookup.postal,
        latitude: lookup.latitude,
        longitude: lookup.longitude,
        timezone: lookup.timezone,
        isp: lookup.isp,
        source: lookup.source === "cache" ? "ipapi.co" : lookup.source,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
  } catch (err) {
    // Cache write failure is non-fatal — log but don't propagate.
    console.warn("[geo-ip] cache write failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Look up a single IP. Returns null on:
 *   - private/invalid IPs
 *   - all providers down
 *   - any unexpected error
 *
 * Layers consulted in order: in-memory cache → DB cache → ipapi.co →
 * ip-api.com. A successful provider hit populates both caches.
 */
export async function lookupIp(ip: string): Promise<GeoLookup | null> {
  if (isPrivateOrInvalidIp(ip)) return null;

  // 1. In-memory cache
  const mem = memoryCache.get(ip);
  if (mem && Date.now() - mem.cached_at < MEMORY_TTL_MS) {
    return mem.result;
  }

  // 2. DB cache
  const dbHit = await readDbCache(ip);
  if (dbHit) {
    memoryCache.set(ip, { result: dbHit, cached_at: Date.now() });
    return dbHit;
  }

  // 3. Primary provider
  let lookup = await lookupIpApiCo(ip);

  // 4. Fallback provider
  if (!lookup) {
    lookup = await lookupIpApiCom(ip);
  }

  if (!lookup) return null;

  // Backfill caches. DB write is fire-and-forget so we don't block the
  // caller on cache plumbing.
  memoryCache.set(ip, { result: lookup, cached_at: Date.now() });
  void writeDbCache(lookup);

  return lookup;
}

/**
 * Pull the caller's IP from request headers — handles the standard
 * `x-forwarded-for` (Vercel/Cloudflare) and `x-real-ip` paths.
 * Returns "unknown" if no header is present (caller will get null from
 * lookupIp).
 */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

/**
 * Test-only: clear the in-memory cache. Exported for vitest.
 */
export function __clearGeoMemoryCache(): void {
  memoryCache.clear();
}
