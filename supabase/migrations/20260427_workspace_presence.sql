-- Ephemeral presence — tracks "who is viewing the whiteboard right now."
-- Rows older than 5 minutes are considered stale; the cleanup cron prunes them.
-- We could use Supabase Realtime presence channels for this, BUT having
-- a table lets us also surface "last seen 5 min ago" history for the
-- "team activity feed" sidebar without a separate store.
CREATE TABLE IF NOT EXISTS public.workspace_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  surface text NOT NULL,                       -- e.g. "whiteboard", "board", "files/<folder>"
  context jsonb NOT NULL DEFAULT '{}'::jsonb,  -- e.g. {"client_id":"...","task_id":"..."}
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, surface)
);

CREATE INDEX IF NOT EXISTS idx_presence_owner_recent
  ON public.workspace_presence(agency_owner_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_last_seen
  ON public.workspace_presence(last_seen_at DESC);

ALTER TABLE public.workspace_presence ENABLE ROW LEVEL SECURITY;

-- Agency owners can do everything for their own agency presence rows.
DROP POLICY IF EXISTS "presence_owner_all" ON public.workspace_presence;
CREATE POLICY "presence_owner_all" ON public.workspace_presence
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());

-- Team members can read presence for the agency they belong to.
-- NOTE: team_members uses `member_profile_id` (not `profile_id`) — see
-- supabase/migrations/20260417_team_members.sql.
DROP POLICY IF EXISTS "presence_team_read" ON public.workspace_presence;
CREATE POLICY "presence_team_read" ON public.workspace_presence
  FOR SELECT USING (
    agency_owner_id IN (
      SELECT agency_owner_id FROM public.team_members
      WHERE member_profile_id = auth.uid() AND status = 'active'
    )
  );

-- Anyone authenticated can write their own heartbeat (the API route enforces
-- agency_owner_id mapping when inserting).
DROP POLICY IF EXISTS "presence_self_write" ON public.workspace_presence;
CREATE POLICY "presence_self_write" ON public.workspace_presence
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "presence_self_update" ON public.workspace_presence;
CREATE POLICY "presence_self_update" ON public.workspace_presence
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "presence_self_delete" ON public.workspace_presence;
CREATE POLICY "presence_self_delete" ON public.workspace_presence
  FOR DELETE USING (profile_id = auth.uid());
