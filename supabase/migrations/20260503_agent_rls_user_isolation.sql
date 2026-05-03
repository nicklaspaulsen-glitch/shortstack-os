-- ============================================================
-- Agent Table RLS — Per-User Isolation (2026-05-03)
-- ============================================================
-- The 2026-04-13 hardening migration added admin-read policies
-- but left agent_workspace and agent_tasks without per-user
-- isolation.  trinity_log had a SELECT-only policy added but
-- no INSERT policy for future user-context writes.
--
-- This migration adds:
--   • ENABLE ROW LEVEL SECURITY on all three tables (idempotent)
--   • agent_workspace_own  — users see / mutate only their rows
--   • agent_tasks_own      — users see / mutate only their rows
--   • trinity_log_insert   — users can insert their own log rows
--   • trinity_log_update   — users can update their own log rows
--
-- Note: All current writes go through createServiceClient() which
-- bypasses RLS.  These policies add DB-level defence-in-depth and
-- allow future migration to user-context clients.
-- ============================================================

-- ── Enable RLS (safe to run even if already enabled) ─────────────
ALTER TABLE IF EXISTS public.agent_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trinity_log     ENABLE ROW LEVEL SECURITY;

-- ── agent_workspace ──────────────────────────────────────────────
DROP POLICY IF EXISTS "agent_workspace_own" ON public.agent_workspace;
CREATE POLICY "agent_workspace_own" ON public.agent_workspace
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Keep existing admin read policy; make it cover ALL operations too.
DROP POLICY IF EXISTS "agent_workspace_admin" ON public.agent_workspace;
CREATE POLICY "agent_workspace_admin" ON public.agent_workspace
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── agent_tasks ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "agent_tasks_own" ON public.agent_tasks;
CREATE POLICY "agent_tasks_own" ON public.agent_tasks
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Upgrade existing admin policy from ALL (already set) — drop/recreate
-- so the definition is consistent with the workspace pattern above.
DROP POLICY IF EXISTS "agent_tasks_admin" ON public.agent_tasks;
CREATE POLICY "agent_tasks_admin" ON public.agent_tasks
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── trinity_log ───────────────────────────────────────────────────
-- SELECT policy already exists from 20260413_agent_tables_rls.sql.
-- Add INSERT + UPDATE so user-context clients can write their rows.

DROP POLICY IF EXISTS "trinity_log_insert" ON public.trinity_log;
CREATE POLICY "trinity_log_insert" ON public.trinity_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trinity_log_update" ON public.trinity_log;
CREATE POLICY "trinity_log_update" ON public.trinity_log
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trinity_log_admin" ON public.trinity_log;
CREATE POLICY "trinity_log_admin" ON public.trinity_log
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');
