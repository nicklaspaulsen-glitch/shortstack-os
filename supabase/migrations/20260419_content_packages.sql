-- Content Packages — "Drop & Go" AI auto-package storage
-- Date: 2026-04-19
-- Creates a dedicated table for AI-generated content packages produced by the
-- Content Hub Drop & Go uploader. Each row represents a single uploaded file
-- plus the multi-platform package (titles, descriptions, hashtags, best_times,
-- caption variations) Claude generated for it. Also adds an `ai_package` jsonb
-- column on content_scripts for the case where a script already exists and we
-- want to attach a fresh AI package to it.

-- ── content_packages table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  mime_type text,
  ai_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready',  -- processing | ready | failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_packages_user ON content_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_content_packages_client ON content_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_content_packages_created_at ON content_packages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_packages_status ON content_packages(status);

ALTER TABLE content_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own content packages" ON content_packages;
CREATE POLICY "Users manage own content packages" ON content_packages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_content_packages_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_packages_updated_at ON content_packages;
CREATE TRIGGER trg_content_packages_updated_at
  BEFORE UPDATE ON content_packages
  FOR EACH ROW EXECUTE FUNCTION update_content_packages_updated_at();

-- ── content_scripts: ai_package column for enrichment ─────────────────
ALTER TABLE content_scripts ADD COLUMN IF NOT EXISTS ai_package jsonb DEFAULT NULL;
