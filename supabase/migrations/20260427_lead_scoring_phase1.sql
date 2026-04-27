-- Lead Scoring Phase 1: AI-powered 0-100 scoring
-- Adds grade column, updated-at timestamp, signal-breakdown jsonb, and event log table.
-- Preserves the existing score / score_breakdown / score_reasoning / score_computed_at columns.

-- 1) Add new columns (idempotent)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_grade text DEFAULT 'cold'
    CHECK (score_grade IN ('cold','warm','hot','customer'));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_signals jsonb DEFAULT '{}'::jsonb;

-- Constrain the existing score column without dropping current data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_score_range_chk' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_score_range_chk
      CHECK (score IS NULL OR (score >= 0 AND score <= 100));
  END IF;
END $$;

-- 2) Index for fast hot-lead listing per agency owner
CREATE INDEX IF NOT EXISTS idx_leads_score
  ON public.leads(user_id, score DESC NULLS LAST)
  WHERE score IS NOT NULL AND score > 0;

CREATE INDEX IF NOT EXISTS idx_leads_score_grade
  ON public.leads(user_id, score_grade)
  WHERE score_grade IN ('hot','warm');

-- 3) lead_score_events: history of recompute runs and signal hits
CREATE TABLE IF NOT EXISTS public.lead_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_value numeric DEFAULT 0,
  prior_score int,
  new_score int,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_score_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_score_events_owner_select" ON public.lead_score_events;
CREATE POLICY "lead_score_events_owner_select"
  ON public.lead_score_events
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lead_score_events_owner_insert" ON public.lead_score_events;
CREATE POLICY "lead_score_events_owner_insert"
  ON public.lead_score_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lead_score_events_lead
  ON public.lead_score_events(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_score_events_user
  ON public.lead_score_events(user_id, created_at DESC);
