-- Geo-IP lookup cache.
--
-- Used by src/lib/integrations/geo-ip.ts to cache IP -> location lookups.
-- The free-tier ipapi.co quota is 1000/day; without this cache a busy
-- form-submit page would burn that in minutes during a campaign.
--
-- Cache is global (not per-tenant) — the geo data for an IP is the same
-- regardless of which agency saw it. RLS is enabled with NO policies, so
-- only the service role can read/write. Library calls use createServiceClient().
--
-- TTL: 7 days. Rows past expires_at are ignored on read and can be purged
-- by a future cleanup cron (idx_geo_cache_expires supports the WHERE clause).
--
-- Privacy: only stores aggregate-level data (country/city/ISP) — no
-- browser fingerprints, no device IDs, no per-tenant scoping.

CREATE TABLE IF NOT EXISTS public.geo_ip_cache (
  ip text PRIMARY KEY,
  country_code text,
  country_name text,
  region text,
  city text,
  postal text,
  latitude double precision,
  longitude double precision,
  timezone text,
  isp text,
  source text NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_geo_cache_expires ON public.geo_ip_cache(expires_at);

-- Service-role only. No policies → RLS denies everyone except service role.
ALTER TABLE public.geo_ip_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.geo_ip_cache IS
  'Global IP geolocation cache (7-day TTL). Service-role only. See src/lib/integrations/geo-ip.ts.';
