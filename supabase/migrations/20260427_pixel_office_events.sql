-- Pixel Agent Office — denormalised activity events
--
-- Surfaces a thin "what each pixel agent has done lately" stream so the
-- /dashboard/agent-office side panel can hydrate without joining 10
-- different domain tables on every click. Source-of-truth tables
-- (voice_calls, lead_scores, etc.) are still authoritative; this is a
-- read-optimised projection that producers append to whenever a notable
-- agent-attributable event happens.
--
-- Producer pattern (server-side only):
--   await supabase.from("agent_activity_events").insert({
--     agency_owner_id: ownerId,
--     agent_key: "echo",                 // see src/lib/pixel-office/agents.ts
--     event_type: "call_received",
--     summary: "Inbound call from Acme Co. — 3:47 elapsed",
--     ref_table: "voice_calls",
--     ref_id: call.id,
--     metadata: { duration: 227, lead_id: leadId },
--   });
--
-- Realtime: enabling supabase_realtime publication so the pixel office
-- canvas can subscribe to INSERTs and trigger live agent animations.

CREATE TABLE IF NOT EXISTS public.agent_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  ref_table text,
  ref_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_owner_recent
  ON public.agent_activity_events(agency_owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_by_agent
  ON public.agent_activity_events(agency_owner_id, agent_key, created_at DESC);

ALTER TABLE public.agent_activity_events ENABLE ROW LEVEL SECURITY;

-- Owner full access. Match by agency_owner_id (not auth.uid()) so the
-- agency owner sees every event their automations recorded.
DROP POLICY IF EXISTS "agent_events_owner" ON public.agent_activity_events;
CREATE POLICY "agent_events_owner" ON public.agent_activity_events
  FOR ALL USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Active team members of the agency get read access. Uses canonical
-- `member_profile_id` column (verified in 20260427_workspace_board.sql).
-- Suspended/revoked members fall through because of `status = 'active'`.
DROP POLICY IF EXISTS "agent_events_team_read" ON public.agent_activity_events;
CREATE POLICY "agent_events_team_read" ON public.agent_activity_events
  FOR SELECT USING (
    agency_owner_id IN (
      SELECT agency_owner_id FROM public.team_members
      WHERE member_profile_id = auth.uid() AND status = 'active'
    )
  );

-- Service role bypasses RLS — used by webhook/cron producers that
-- attribute events on behalf of the agency owner.

-- Add to realtime publication so the pixel office can subscribe to live
-- INSERTs. Wrapped in a DO block because re-adding to a publication
-- raises an error if the table is already there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_activity_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_events';
  END IF;
END $$;

COMMENT ON TABLE public.agent_activity_events IS
  'Denormalised activity stream for /dashboard/agent-office. Producers append rows on every notable event; the pixel office UI subscribes via realtime.';
