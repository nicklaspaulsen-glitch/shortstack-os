-- Outreach quality v1: email + phone validation cache + news triggers.
--
-- Adds two tables that protect cold-outreach quality:
--   1. contact_validations — per-(channel,target) result of email/phone API
--      checks; cached so we don't re-burn quota on the same address inside
--      a 14-day window.
--   2. news_triggers — fresh-news hits per lead used for warm-signal badges
--      and a +10 lead-score bump in the scoring engine.
--
-- Both tables are RLS-scoped to the agency owner. Service-role cron writes
-- still work because the cron uses createServiceClient() which bypasses RLS.

-- ── contact_validations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  target text NOT NULL,
  status text NOT NULL CHECK (status IN ('valid', 'risky', 'invalid', 'unknown', 'skipped')),
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_owner_id, channel, target)
);

CREATE INDEX IF NOT EXISTS idx_validations_recent
  ON public.contact_validations(agency_owner_id, validated_at DESC);

CREATE INDEX IF NOT EXISTS idx_validations_status
  ON public.contact_validations(agency_owner_id, channel, status);

ALTER TABLE public.contact_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validations_owner" ON public.contact_validations;
CREATE POLICY "validations_owner"
  ON public.contact_validations
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- ── news_triggers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  company text NOT NULL,
  headline text NOT NULL,
  url text NOT NULL,
  published_at timestamptz NOT NULL,
  source text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('funding', 'hiring', 'product_launch', 'acquisition', 'news_general')),
  summary text NOT NULL DEFAULT '',
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, url)
);

CREATE INDEX IF NOT EXISTS idx_news_triggers_lead
  ON public.news_triggers(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_triggers_unack
  ON public.news_triggers(agency_owner_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_triggers_recent
  ON public.news_triggers(agency_owner_id, published_at DESC);

ALTER TABLE public.news_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_owner" ON public.news_triggers;
CREATE POLICY "news_owner"
  ON public.news_triggers
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());
