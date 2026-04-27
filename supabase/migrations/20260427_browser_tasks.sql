-- Browser Worker — autonomous AI agents that drive a real browser via Playwright + Claude tool-calling.
--
-- Two tables:
--   browser_tasks            — every task run (one_off + recurring instances).
--   browser_task_templates   — reusable goal templates with {{var}} placeholders.
--
-- Both RLS-protected by agency_owner_id = auth.uid(). Service-role only bypasses
-- RLS for the cron runner.

CREATE TABLE IF NOT EXISTS public.browser_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  goal text NOT NULL,
  start_url text,
  schedule_kind text NOT NULL DEFAULT 'one_off' CHECK (schedule_kind IN ('one_off','daily','weekly','monthly','on_event')),
  schedule_cron text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  result_text text,
  result_data jsonb,
  steps_taken int NOT NULL DEFAULT 0,
  max_steps int NOT NULL DEFAULT 30,
  total_cost_usd numeric NOT NULL DEFAULT 0,
  run_mode text NOT NULL DEFAULT 'local_headless',
  recordings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_browser_tasks_owner_recent
  ON public.browser_tasks(agency_owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_browser_tasks_status
  ON public.browser_tasks(status)
  WHERE status IN ('queued','running');

CREATE INDEX IF NOT EXISTS idx_browser_tasks_scheduled
  ON public.browser_tasks(schedule_kind, status)
  WHERE schedule_kind != 'one_off';

ALTER TABLE public.browser_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "browser_tasks_owner" ON public.browser_tasks;
CREATE POLICY "browser_tasks_owner" ON public.browser_tasks
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());

-- ─── Reusable templates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.browser_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  goal_template text NOT NULL,
  start_url text,
  default_max_steps int NOT NULL DEFAULT 30,
  category text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_browser_task_templates_owner
  ON public.browser_task_templates(agency_owner_id, created_at DESC);

ALTER TABLE public.browser_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "browser_templates_owner" ON public.browser_task_templates;
CREATE POLICY "browser_templates_owner" ON public.browser_task_templates
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());

COMMENT ON TABLE public.browser_tasks IS
  'AI Browser Worker tasks. Each row = one human-stated goal driven by Claude via Playwright. recordings[] stores per-step screenshot R2 keys + tool calls.';
COMMENT ON TABLE public.browser_task_templates IS
  'Reusable goal templates for the browser worker. Mustache-style {{var}} placeholders filled at run time.';
