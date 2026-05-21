-- Page-level AI training configuration per agency owner.
-- Lets users save their preferred creator style + custom instructions
-- for each feature page (social, websites, ads, email, etc.).
-- The stored config is read by API routes and injected into system prompts.

CREATE TABLE IF NOT EXISTS page_training_configs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- page_key maps to PageContext in creator-styles.ts
  -- examples: 'social', 'websites', 'ads', 'email', 'proposals',
  --           'crm-followup', 'weekly-plan', 'ai-video', 'script', 'thumbnail'
  page_key        TEXT        NOT NULL,
  -- Preferred creator archetype from CREATOR_STYLES (id field)
  creator_style_id TEXT,
  -- Free-form extra instructions injected after creator style DNA
  custom_instructions TEXT,
  -- Default tone override ('professional', 'casual', 'bold', etc.)
  tone            TEXT,
  -- Up to 5 example outputs the AI should emulate
  example_outputs TEXT[]      DEFAULT '{}',
  -- Topics or themes to prioritise for this feature
  focus_topics    TEXT[]      DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, page_key)
);

-- RLS: each owner can only read/write their own config rows
ALTER TABLE page_training_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage page_training_configs"
  ON page_training_configs
  FOR ALL
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Index for fast per-owner lookups
CREATE INDEX IF NOT EXISTS page_training_configs_owner_page
  ON page_training_configs (owner_id, page_key);

-- Auto-refresh updated_at
CREATE OR REPLACE FUNCTION update_page_training_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_page_training_configs_updated_at
  BEFORE UPDATE ON page_training_configs
  FOR EACH ROW EXECUTE FUNCTION update_page_training_configs_updated_at();
