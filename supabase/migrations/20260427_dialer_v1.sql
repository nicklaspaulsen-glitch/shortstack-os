-- Dialer v1 — Power dialer + manual SMS + manual DM
-- Extends voice_calls with manual-mode tracking (disposition + notes)
-- Adds sms_templates and sms_bulk_jobs for the manual SMS console.
--
-- Applied to production via Supabase MCP on 2026-04-27.
-- Kept here so local resets / branch restores stay in sync.

ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','manual'));
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS disposition text CHECK (disposition IN ('connected','voicemail','no_answer','wrong_number','do_not_call','other'));
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS manual_notes text;

CREATE INDEX IF NOT EXISTS idx_voice_calls_profile_mode_started
  ON voice_calls(profile_id, mode, started_at DESC);

-- SMS templates table for the manual SMS console
CREATE TABLE IF NOT EXISTS sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_templates_user ON sms_templates(user_id, created_at DESC);
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_templates_own" ON sms_templates;
CREATE POLICY "sms_templates_own" ON sms_templates FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Bulk SMS jobs for throttled bulk sends
CREATE TABLE IF NOT EXISTS sms_bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES sms_templates(id) ON DELETE SET NULL,
  recipients jsonb NOT NULL,
  total_count int NOT NULL,
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  throttle_ms int DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sms_bulk_jobs_user ON sms_bulk_jobs(user_id, created_at DESC);
ALTER TABLE sms_bulk_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_bulk_jobs_own" ON sms_bulk_jobs;
CREATE POLICY "sms_bulk_jobs_own" ON sms_bulk_jobs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
