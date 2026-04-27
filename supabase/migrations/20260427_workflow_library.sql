-- Workflow Library — Apr 27
--
-- Three things in one migration so /install + scheduled-wait + ai-drafted
-- emails all have a home:
--
--   1. workflows.installed_from_template_id — track which templates are popular
--      and (later) help upgrade in-place when a template ships v2.
--   2. workflow_waits — rows for delayed continuations (the cron picks these up
--      and resumes the workflow). Without this the `wait` and `wait_until`
--      action handlers degrade to "we tried" with no real schedule.
--   3. email_drafts — staging table for AI-drafted emails the owner reviews
--      before sending. The `ai.draft_email` action writes here.
--
-- All RLS uses (auth.uid() = user_id). Service role bypasses for cron + webhook.

-- ── 1. installed_from_template_id ────────────────────────────────────────

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS installed_from_template_id text;

CREATE INDEX IF NOT EXISTS idx_workflows_installed_from
  ON public.workflows(installed_from_template_id)
  WHERE installed_from_template_id IS NOT NULL;

-- ── 2. workflow_waits — delayed-step queue ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_waits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  run_id uuid,
  wake_at timestamptz NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','firing','completed','failed','canceled')),
  resumed_at timestamptz,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_waits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_waits_own" ON public.workflow_waits;
CREATE POLICY "workflow_waits_own" ON public.workflow_waits FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workflow_waits_due_idx
  ON public.workflow_waits(wake_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS workflow_waits_run_idx
  ON public.workflow_waits(run_id)
  WHERE run_id IS NOT NULL;

-- ── 3. email_drafts — AI-drafted-but-not-sent emails ─────────────────────

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','sent')),
  reviewed_at timestamptz,
  sent_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_drafts_own" ON public.email_drafts;
CREATE POLICY "email_drafts_own" ON public.email_drafts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS email_drafts_pending_idx
  ON public.email_drafts(user_id, created_at DESC)
  WHERE status = 'pending_review';
