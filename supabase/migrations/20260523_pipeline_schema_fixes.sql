-- Fix three schema gaps discovered during autonomous pipeline activation:
--
-- 1. lead_pipeline.stage CHECK missing "payment_received" and "converted"
--    - payment_received: stripe-leadgen webhook sets this on checkout.session.completed
--    - converted: qualify route guards on it, pipeline UI displays it
--
-- 2. lead_pipeline.platform CHECK missing "google_places"
--    - find_leads handler inserts with platform: "google_places"
--
-- 3. autonomous_loop_settings missing "metadata" JSONB column
--    - find_leads handler reads metadata.target_niche + metadata.target_location
--    - Without it, lead discovery defaults to "local business" in "United States"

-- ── 1. Expand the stage CHECK constraint ────────────────────────────────────
ALTER TABLE public.lead_pipeline
  DROP CONSTRAINT IF EXISTS lead_pipeline_stage_check;

ALTER TABLE public.lead_pipeline
  ADD CONSTRAINT lead_pipeline_stage_check CHECK (stage IN (
    'outreach_pending','outreach_sent','replied','qualifying',
    'qualified','content_ready',
    'closed','onboarding','scripting','editing',
    'payment_sent','payment_received','delivered',
    'converted','dead'
  ));

-- ── 2. Expand the platform CHECK constraint ─────────────────────────────────
ALTER TABLE public.lead_pipeline
  DROP CONSTRAINT IF EXISTS lead_pipeline_platform_check;

ALTER TABLE public.lead_pipeline
  ADD CONSTRAINT lead_pipeline_platform_check CHECK (platform IN (
    'instagram','telegram','facebook','tiktok','twitter','x',
    'whatsapp','linkedin','google_places','email','other'
  ));

-- ── 3. Add metadata column to autonomous_loop_settings ──────────────────────
-- Stores per-owner config like target_niche, target_location, preferred platforms.
ALTER TABLE public.autonomous_loop_settings
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.autonomous_loop_settings.metadata IS
  'Per-owner config: {target_niche, target_location, preferred_platforms, ...}';
