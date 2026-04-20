-- AI Auto-Edit Engine — preference learning loop.
-- Logs every accept/reject decision the user makes on an auto-edit
-- suggestion, so the suggestion engine can replay recent decisions
-- back to Claude as a few-shot hint (no ML training needed).

CREATE TABLE IF NOT EXISTS ai_edit_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edit_type text NOT NULL,
  input_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_edit_feedback_user
  ON ai_edit_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_edit_feedback_type
  ON ai_edit_feedback(user_id, edit_type, created_at DESC);

-- RLS
ALTER TABLE ai_edit_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own" ON ai_edit_feedback;
CREATE POLICY "users see own" ON ai_edit_feedback
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users insert own" ON ai_edit_feedback;
CREATE POLICY "users insert own" ON ai_edit_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());
