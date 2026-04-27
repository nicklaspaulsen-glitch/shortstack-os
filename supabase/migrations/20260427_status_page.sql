-- Status page tier — public incident timeline + private health snapshots.
-- Replaces Statuspage.io (~$29/mo). Adds two tables:
--
--   incidents               — manually-authored incident posts shown on the
--                             public /status/[ownerSlug] page. Owner CRUDs
--                             their own; public anon SELECTs only the active
--                             + recently-resolved (<7d) rows.
--
--   system_health_snapshots — automated 15-min cron snapshots of subsystem
--                             health (db/auth/storage/cron + last cron heartbeat
--                             + Vercel deploy state). Owner-only read; only
--                             the service role inserts.
--
-- All tables ENABLE ROW LEVEL SECURITY. Public page uses the anon Supabase
-- key with the public-read policy; admin UI uses createServerSupabase()
-- (RLS enforces ownership); cron writer uses createServiceClient() (bypasses RLS).

-- ─────────────────────────────────────────────────────────────────────────
-- incidents
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  severity text NOT NULL CHECK (severity IN ('investigating','identified','monitoring','resolved')),
  affected_components text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_owner_started
  ON public.incidents(owner_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_resolved_at
  ON public.incidents(resolved_at)
  WHERE resolved_at IS NULL;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Owner can do everything to their own incidents
DROP POLICY IF EXISTS "incidents_owner_all" ON public.incidents;
CREATE POLICY "incidents_owner_all" ON public.incidents
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Public read for currently-active or recently-resolved (<7 days)
-- incidents. The /status/[ownerSlug] page uses the anon key — this policy
-- is what makes the page work without a logged-in user. The 7-day window
-- keeps the recent-incidents list short without losing context for anyone
-- reading the page within a week of an outage.
DROP POLICY IF EXISTS "incidents_public_read" ON public.incidents;
CREATE POLICY "incidents_public_read" ON public.incidents
  FOR SELECT TO anon USING (
    resolved_at IS NULL OR resolved_at > now() - interval '7 days'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- system_health_snapshots
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  db_ok boolean NOT NULL DEFAULT true,
  auth_ok boolean NOT NULL DEFAULT true,
  storage_ok boolean NOT NULL DEFAULT true,
  cron_ok boolean NOT NULL DEFAULT true,
  last_cron_at timestamptz,
  vercel_deploy_status text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_owner_snapshot
  ON public.system_health_snapshots(owner_id, snapshot_at DESC);

ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

-- Owner-only read. The public page does NOT read snapshots directly —
-- it computes its uptime grid from the incidents table, which is the
-- canonical "user-visible outage" record. Snapshots are an internal
-- diagnostics surface for the admin /dashboard/admin/status page.
DROP POLICY IF EXISTS "snapshots_owner_read" ON public.system_health_snapshots;
CREATE POLICY "snapshots_owner_read" ON public.system_health_snapshots
  FOR SELECT USING (owner_id = auth.uid());

-- Service-role only write. The 15-min cron uses createServiceClient(),
-- which bypasses RLS — this policy is here so an authenticated user
-- with the anon key explicitly cannot insert snapshots (no INSERT policy
-- + RLS on means the request is denied).

-- ─────────────────────────────────────────────────────────────────────────
-- Helper view: active_incidents (used by both admin + public pages)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.active_incidents AS
SELECT * FROM public.incidents WHERE resolved_at IS NULL;

GRANT SELECT ON public.active_incidents TO anon, authenticated;
