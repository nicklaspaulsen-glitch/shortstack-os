-- Autonomous Agent System — three new tables backing the agent command center,
-- the fully-autonomous pipeline loop, and the client communication hub.

-- ── 1. agent_task_queue ──────────────────────────────────────────────────────
-- The queue the autonomous loop reads from and writes to. Each row is one
-- discrete unit of agent work (scrape leads, send outreach, follow-up, gen
-- content, publish). Completed tasks are kept for 30 days as an audit trail.

CREATE TABLE IF NOT EXISTS public.agent_task_queue (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type      TEXT        NOT NULL,
    -- find_leads | qualify_lead | send_outreach | follow_up |
    -- generate_content | gen_video | publish | invoice_client | custom
  status         TEXT        NOT NULL DEFAULT 'queued',
    -- queued | running | completed | failed | cancelled | skipped
  priority       INT         NOT NULL DEFAULT 5, -- 1 = highest, 10 = lowest
  agent_key      TEXT,        -- which agent handles this (e.g. "Aria")
  payload        JSONB       DEFAULT '{}'::jsonb,  -- task-specific input
  result         JSONB       DEFAULT '{}'::jsonb,  -- output/summary
  error_message  TEXT,
  pipeline_id    UUID        REFERENCES public.lead_pipeline(id) ON DELETE SET NULL,
  scheduled_for  TIMESTAMPTZ DEFAULT NOW(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  duration_ms    INT,
  retry_count    INT         DEFAULT 0,
  max_retries    INT         DEFAULT 3,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.agent_task_queue_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_task_queue_updated_at ON public.agent_task_queue;
CREATE TRIGGER agent_task_queue_updated_at
  BEFORE UPDATE ON public.agent_task_queue
  FOR EACH ROW EXECUTE FUNCTION public.agent_task_queue_updated_at();

CREATE INDEX IF NOT EXISTS agent_task_queue_owner_status
  ON public.agent_task_queue (owner_id, status, priority, scheduled_for);
CREATE INDEX IF NOT EXISTS agent_task_queue_pipeline
  ON public.agent_task_queue (pipeline_id) WHERE pipeline_id IS NOT NULL;

ALTER TABLE public.agent_task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_task_queue_owner_select ON public.agent_task_queue
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY agent_task_queue_owner_insert ON public.agent_task_queue
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY agent_task_queue_owner_update ON public.agent_task_queue
  FOR UPDATE USING (owner_id = auth.uid());

-- Realtime: owners watch their own queue
ALTER TABLE public.agent_task_queue REPLICA IDENTITY FULL;


-- ── 2. client_work_requests ───────────────────────────────────────────────────
-- Client submits "I want more work" through the portal. AI generates a proposal;
-- agency reviews in 1 click; client pays; work starts.

CREATE TABLE IF NOT EXISTS public.client_work_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id            UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- What they need
  service_type         TEXT        NOT NULL DEFAULT 'other',
    -- social_media | video | ads | seo | email | website | branding | other
  brief                TEXT        NOT NULL,
  urgency              TEXT        NOT NULL DEFAULT 'standard',
    -- urgent | standard | flexible
  budget_hint          TEXT,
  -- AI-generated proposal
  proposal_text        TEXT,
  proposal_price       NUMERIC(10,2),
  proposal_deliverables JSONB      DEFAULT '[]'::jsonb, -- [{item, eta_days}]
  proposal_status      TEXT        NOT NULL DEFAULT 'pending',
    -- pending | generating | sent | accepted | declined | expired
  proposal_generated_at TIMESTAMPTZ,
  proposal_sent_at     TIMESTAMPTZ,
  proposal_expires_at  TIMESTAMPTZ,
  -- Response
  client_response_notes TEXT,
  responded_at         TIMESTAMPTZ,
  declined_reason      TEXT,
  -- Payment + delivery
  stripe_payment_link  TEXT,
  payment_amount       NUMERIC(10,2),
  paid_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  -- Meta
  source               TEXT        DEFAULT 'portal',  -- portal | agency_initiated
  notes                TEXT,  -- internal agency note
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.client_work_requests_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_work_requests_updated_at ON public.client_work_requests;
CREATE TRIGGER client_work_requests_updated_at
  BEFORE UPDATE ON public.client_work_requests
  FOR EACH ROW EXECUTE FUNCTION public.client_work_requests_updated_at();

CREATE INDEX IF NOT EXISTS client_work_requests_owner
  ON public.client_work_requests (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_work_requests_client
  ON public.client_work_requests (client_id, created_at DESC);

ALTER TABLE public.client_work_requests ENABLE ROW LEVEL SECURITY;

-- Agency owner sees all their requests
CREATE POLICY client_work_requests_owner_all ON public.client_work_requests
  FOR ALL USING (owner_id = auth.uid());


-- ── 3. client_announcements ───────────────────────────────────────────────────
-- Agency broadcasts updates, case studies, new service announcements to clients.
-- client_id = NULL means broadcast to ALL clients of that owner.

CREATE TABLE IF NOT EXISTS public.client_announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    UUID        REFERENCES public.clients(id) ON DELETE CASCADE, -- NULL = all
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'update',
    -- update | case_study | new_service | milestone | offer
  cta_label    TEXT,
  cta_url      TEXT,
  image_url    TEXT,
  pinned       BOOLEAN     DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_announcements_owner
  ON public.client_announcements (owner_id, published_at DESC);
CREATE INDEX IF NOT EXISTS client_announcements_client
  ON public.client_announcements (owner_id, client_id, published_at DESC);

ALTER TABLE public.client_announcements ENABLE ROW LEVEL SECURITY;

-- Agency owner manages all
CREATE POLICY client_announcements_owner_all ON public.client_announcements
  FOR ALL USING (owner_id = auth.uid());

-- Public portal access: anonymous reads for the specific client or broadcasts
-- (portal routes call with service client or validate client token separately)
CREATE POLICY client_announcements_portal_read ON public.client_announcements
  FOR SELECT USING (true); -- row-level scoping handled in the API via service client + client_id filter


-- ── 4. autonomous_loop_settings ──────────────────────────────────────────────
-- Per-owner toggle for the autonomous pipeline loop + tuning params.

CREATE TABLE IF NOT EXISTS public.autonomous_loop_settings (
  owner_id            UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled             BOOLEAN DEFAULT FALSE,
  -- Lead-find budget
  max_leads_per_run   INT     DEFAULT 20,
  -- Outreach cadence (days between touches)
  follow_up_day_2     INT     DEFAULT 3,
  follow_up_day_3     INT     DEFAULT 7,
  -- Content auto-gen
  auto_gen_content    BOOLEAN DEFAULT FALSE,
  auto_publish        BOOLEAN DEFAULT FALSE,
  -- Notification prefs
  notify_telegram     BOOLEAN DEFAULT TRUE,
  notify_email        BOOLEAN DEFAULT FALSE,
  -- Loop health
  last_run_at         TIMESTAMPTZ,
  last_run_result     JSONB   DEFAULT '{}'::jsonb,
  paused_until        TIMESTAMPTZ,
  pause_reason        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.autonomous_loop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY autonomous_loop_settings_owner_all ON public.autonomous_loop_settings
  FOR ALL USING (owner_id = auth.uid());
