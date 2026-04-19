-- Storyboards — AI-generated shot-by-shot visual breakdowns of scripts
-- Date: 2026-04-19
-- Created by Script Lab's "Generate Storyboard" feature. Each row represents
-- a single storyboard tied optionally to a script row (trinity_log or
-- content_scripts — script_id is a free-form uuid, not FK enforced, so we can
-- reference either source or external scripts).

CREATE TABLE IF NOT EXISTS storyboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  script_id uuid,
  format text NOT NULL, -- ugc | ad | motion_graphics | talking_head | product_demo | explainer | cinematic | podcast_clip
  platform text,
  total_duration_sec integer,
  shots jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storyboards_user ON storyboards(user_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_script ON storyboards(script_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_format ON storyboards(format);
CREATE INDEX IF NOT EXISTS idx_storyboards_created_at ON storyboards(created_at DESC);

ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own storyboards" ON storyboards;
CREATE POLICY "Users manage own storyboards" ON storyboards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_storyboards_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_storyboards_updated_at ON storyboards;
CREATE TRIGGER trg_storyboards_updated_at
  BEFORE UPDATE ON storyboards
  FOR EACH ROW EXECUTE FUNCTION update_storyboards_updated_at();
