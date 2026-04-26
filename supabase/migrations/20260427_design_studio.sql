-- Design Studio v1 migration
-- Applied via Supabase MCP apply_migration (design_studio_v1)
-- This file is kept for reference / local dev replay.

CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  width int NOT NULL,
  height int NOT NULL,
  doc jsonb NOT NULL DEFAULT '{}',
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_global bool NOT NULL DEFAULT false,
  category text NOT NULL,
  name text NOT NULL,
  doc jsonb NOT NULL,
  preview_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  design_id uuid NULL REFERENCES designs(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('upload','flux','rembg','upscale')),
  prompt text,
  r2_key text NOT NULL,
  mime text NOT NULL,
  width int,
  height int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  op text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  runpod_id text,
  params jsonb,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designs_select_own" ON designs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "designs_insert_own" ON designs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "designs_update_own" ON designs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "designs_delete_own" ON designs FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "templates_select" ON design_templates FOR SELECT USING (is_global = true OR owner_id = auth.uid());
CREATE POLICY "templates_insert_own" ON design_templates FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "templates_update_own" ON design_templates FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "templates_delete_own" ON design_templates FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "assets_select_own" ON design_assets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assets_insert_own" ON design_assets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assets_update_own" ON design_assets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "assets_delete_own" ON design_assets FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "jobs_select_own" ON design_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "jobs_insert_own" ON design_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "jobs_update_own" ON design_jobs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "jobs_delete_own" ON design_jobs FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_designs_client ON designs(client_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_user ON design_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_design_jobs_design ON design_jobs(design_id);
CREATE INDEX IF NOT EXISTS idx_design_jobs_status ON design_jobs(status);
