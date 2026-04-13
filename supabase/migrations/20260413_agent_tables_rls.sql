-- ============================================
-- Agent RLS Hardening (applied 2026-04-13)
-- Fix permissive policies, add admin access, add missing columns.
-- Tables agent_workspace, agent_tasks, custom_agents already existed.
-- ============================================

-- ── agent_workspace: add admin read access ──────────────────────
CREATE POLICY "agent_workspace_admin" ON agent_workspace FOR SELECT
  USING (get_user_role(auth.uid()) = 'admin');

-- ── agent_tasks: add missing result column + admin policy ───────
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS result TEXT;

CREATE POLICY "agent_tasks_admin" ON agent_tasks FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── custom_agents: replace permissive policies with proper ones ─
DROP POLICY IF EXISTS "Authenticated users can manage custom_agents" ON custom_agents;
DROP POLICY IF EXISTS "Authenticated users can read custom_agents" ON custom_agents;

-- Users see only their own spawned agents (spawned_by is text, cast uid)
CREATE POLICY "custom_agents_own" ON custom_agents FOR ALL
  USING (spawned_by = auth.uid()::text)
  WITH CHECK (spawned_by = auth.uid()::text);

CREATE POLICY "custom_agents_admin" ON custom_agents FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── trinity_log: add columns for per-client activity logging ────
ALTER TABLE trinity_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE trinity_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE trinity_log ADD COLUMN IF NOT EXISTS agent TEXT;

CREATE INDEX IF NOT EXISTS idx_trinity_log_user ON trinity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_trinity_log_agent ON trinity_log(agent);

CREATE POLICY "trinity_log_own" ON trinity_log FOR SELECT
  USING (user_id = auth.uid());
