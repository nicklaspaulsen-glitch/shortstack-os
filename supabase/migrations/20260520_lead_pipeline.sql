-- Lead Pipeline table — backing store for the autonomous outreach-to-delivery funnel.
-- Stages (in order):
--   outreach_pending → outreach_sent → replied → qualifying → qualified
--   → content_ready → closed → onboarding → scripting → editing
--   → payment_sent → delivered
-- Dead-end: dead (lead went cold or opted out)

CREATE TABLE IF NOT EXISTS public.lead_pipeline (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Lead identity
  lead_id               UUID    REFERENCES public.leads(id) ON DELETE SET NULL,
  platform              TEXT    NOT NULL DEFAULT 'instagram', -- instagram|tiktok|linkedin|twitter
  handle                TEXT    NOT NULL,
  display_name          TEXT,
  profile_url           TEXT,
  profile_pic_url       TEXT,
  -- Pipeline state
  stage                 TEXT    NOT NULL DEFAULT 'outreach_pending'
                                CHECK (stage IN (
                                  'outreach_pending','outreach_sent','replied','qualifying',
                                  'qualified','content_ready',
                                  'closed','onboarding','scripting','editing',
                                  'payment_sent','delivered','dead'
                                )),
  -- Voice outreach
  voice_message_url     TEXT,
  outreach_sent_at      TIMESTAMPTZ,
  -- Conversation
  last_reply_at         TIMESTAMPTZ,
  message_history       JSONB   DEFAULT '[]'::jsonb, -- [{role, content, ts}]
  -- Qualification data
  lead_info             JSONB   DEFAULT '{}'::jsonb,  -- {pain_points, platform_issues, budget_hint, ...}
  -- Generated content (for content_ready stage)
  generated_content     JSONB   DEFAULT '{}'::jsonb,  -- {brief, ad_copy, email_subject, captions, hook_ideas}
  -- Deal close
  closed_at             TIMESTAMPTZ,
  deal_value_estimate   NUMERIC(10,2),
  meeting_requested     BOOLEAN DEFAULT FALSE,
  meeting_scheduled_at  TIMESTAMPTZ,
  -- Onboarding (platform logins collected)
  onboarding_data       JSONB   DEFAULT '{}'::jsonb,  -- {instagram_username, meta_ads_connected, tiktok_connected, ...}
  onboarding_complete   BOOLEAN DEFAULT FALSE,
  -- Scripts
  script_brief          JSONB   DEFAULT '{}'::jsonb,  -- {long_form_topics, short_form_topics, style_notes}
  scripts               JSONB   DEFAULT '[]'::jsonb,  -- [{type, title, script, duration_estimate, status}]
  scripts_approved      BOOLEAN DEFAULT FALSE,
  -- Video editing
  video_job_ids         JSONB   DEFAULT '[]'::jsonb,  -- [{job_id, type, status, output_url}]
  -- Thumbnails / ads
  thumbnail_job_ids     JSONB   DEFAULT '[]'::jsonb,  -- [{job_id, type, status, output_url}]
  -- Payment
  stripe_payment_link   TEXT,
  stripe_payment_intent TEXT,
  payment_amount        NUMERIC(10,2),
  payment_sent_at       TIMESTAMPTZ,
  payment_received_at   TIMESTAMPTZ,
  -- Delivery
  delivered_at          TIMESTAMPTZ,
  delivery_notes        TEXT,
  -- Files attached to this lead
  files                 JSONB   DEFAULT '[]'::jsonb,  -- [{name, url, type, size, uploaded_at}]
  -- Free-form notes
  notes                 TEXT,
  -- Telegram notification tracking
  last_tg_notif_at      TIMESTAMPTZ,
  tg_notif_type         TEXT,  -- agreed|meeting|closed|payment_received
  -- n8n run tracking
  n8n_run_id            TEXT,
  n8n_last_step         TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Update trigger
CREATE OR REPLACE FUNCTION public.lead_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_pipeline_updated_at ON public.lead_pipeline;
CREATE TRIGGER lead_pipeline_updated_at
  BEFORE UPDATE ON public.lead_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.lead_pipeline_updated_at();

-- Index on owner + stage for fast kanban queries
CREATE INDEX IF NOT EXISTS lead_pipeline_owner_stage  ON public.lead_pipeline (owner_id, stage);
CREATE INDEX IF NOT EXISTS lead_pipeline_owner_updated ON public.lead_pipeline (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS lead_pipeline_handle        ON public.lead_pipeline (owner_id, platform, handle);

-- Files table (denormalized for file-manager queries)
CREATE TABLE IF NOT EXISTS public.lead_pipeline_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID        NOT NULL REFERENCES public.lead_pipeline(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  file_url      TEXT        NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_pipeline_files_pipeline ON public.lead_pipeline_files (pipeline_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.lead_pipeline       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pipeline_files ENABLE ROW LEVEL SECURITY;

-- Owners see their own rows
CREATE POLICY lead_pipeline_owner_select ON public.lead_pipeline
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY lead_pipeline_owner_insert ON public.lead_pipeline
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY lead_pipeline_owner_update ON public.lead_pipeline
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY lead_pipeline_owner_delete ON public.lead_pipeline
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY lead_pipeline_files_owner_select ON public.lead_pipeline_files
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY lead_pipeline_files_owner_insert ON public.lead_pipeline_files
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY lead_pipeline_files_owner_delete ON public.lead_pipeline_files
  FOR DELETE USING (owner_id = auth.uid());

-- Realtime: owners subscribe to their own pipeline updates
ALTER TABLE public.lead_pipeline REPLICA IDENTITY FULL;
