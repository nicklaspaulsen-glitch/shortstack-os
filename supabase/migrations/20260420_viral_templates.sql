-- Viral Content Analyzer — saved templates.
-- Each row is an extracted viral pattern scoped to the agency owner (user_id).
-- Users can apply the pattern to future generations or share within their team.

CREATE TABLE IF NOT EXISTS viral_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text,
  name text,
  pattern jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viral_templates_user
  ON viral_templates(user_id, created_at DESC);

ALTER TABLE viral_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own templates" ON viral_templates;
CREATE POLICY "own templates" ON viral_templates
  FOR ALL USING (user_id = auth.uid());
