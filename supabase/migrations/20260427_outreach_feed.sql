-- Outreach Feed — outcome cache
--
-- The Unified Outreach Feed aggregates voice_calls, outreach_log, and
-- messages into a single chat-bubble timeline per contact. Each event
-- gets an AI-generated outcome label ("interested" / "objection" / etc).
-- Re-prompting Claude on every page render would be expensive, so we
-- cache the outcome in this lightweight denormalized table.
--
-- Populated lazily by `src/lib/outreach/aggregator.ts` (writes
-- outcome='unknown' rows for events it sees) and `/api/outreach/classify-batch`
-- (cron-driven worker that LLM-classifies the unknown rows and updates
-- the outcome + summary).
--
-- Lookup key: (channel, source_id) — covers voice_calls.id, outreach_log.id,
-- and messages.id. RLS scopes to agency_owner_id so admins see only their
-- own cache rows. The portal API joins through clients/leads.client_id
-- (agency-level filter) so a client portal user sees outcomes on their
-- own conversations only.

CREATE TABLE IF NOT EXISTS public.outreach_outcome_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('voice_call','email','sms','dm')),
  source_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('interested','objection','no_answer','booked','replied','voicemail','bounced','unknown')),
  summary text NOT NULL DEFAULT '',
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_outcome_cache_unique UNIQUE (channel, source_id)
);

CREATE INDEX IF NOT EXISTS idx_outcome_cache_owner
  ON public.outreach_outcome_cache(agency_owner_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_outcome_cache_unknown
  ON public.outreach_outcome_cache(agency_owner_id, computed_at)
  WHERE outcome = 'unknown';

ALTER TABLE public.outreach_outcome_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outcome_owner_all" ON public.outreach_outcome_cache;
CREATE POLICY "outcome_owner_all" ON public.outreach_outcome_cache
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Read-mark cache: tracks which timeline events the agency owner has
-- already seen so the conversation list can show an unread count.
-- A row exists per (agency_owner_id, contact_kind, contact_id) tuple.
CREATE TABLE IF NOT EXISTS public.outreach_thread_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_kind text NOT NULL CHECK (contact_kind IN ('lead','client')),
  contact_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_thread_reads_unique UNIQUE (agency_owner_id, contact_kind, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_reads_owner
  ON public.outreach_thread_reads(agency_owner_id, last_read_at DESC);

ALTER TABLE public.outreach_thread_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_reads_owner_all" ON public.outreach_thread_reads;
CREATE POLICY "thread_reads_owner_all" ON public.outreach_thread_reads
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Cached AI summary at the top of the thread ("Warm prospect; last contact
-- 3d ago; suggested action: send case study"). 24h TTL — recomputed on
-- read if older. Keyed by (agency_owner_id, contact_kind, contact_id).
CREATE TABLE IF NOT EXISTS public.outreach_thread_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_kind text NOT NULL CHECK (contact_kind IN ('lead','client')),
  contact_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  suggested_action text NOT NULL DEFAULT '',
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_thread_summaries_unique UNIQUE (agency_owner_id, contact_kind, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_summaries_owner
  ON public.outreach_thread_summaries(agency_owner_id, computed_at DESC);

ALTER TABLE public.outreach_thread_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_summaries_owner_all" ON public.outreach_thread_summaries;
CREATE POLICY "thread_summaries_owner_all" ON public.outreach_thread_summaries
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());
