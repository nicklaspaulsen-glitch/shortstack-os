-- Apr 28: SECURITY MIGRATION — close cross-tenant outreach_log leak.
--
-- The original schema.sql shipped with:
--   CREATE POLICY "outreach_admin_team" ON outreach_log FOR ALL
--     USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));
--
-- That lets ANY admin or team_member read EVERY outreach_log row across
-- ALL agencies. There is no ownership predicate. Caught while auditing
-- src/lib/outreach/aggregator.ts loadSourceRows() — the outreach_log
-- query relies entirely on this policy and gets unfiltered rows back.
--
-- Fix:
--   1. Add `user_id` column to outreach_log (denormalized from leads.user_id).
--   2. Backfill from existing leads rows.
--   3. Trigger auto-fills user_id from lead_id on future inserts so we
--      don't have to chase down 23 callsites.
--   4. Replace the FOR ALL policy with:
--      - admins/team_members read their own agency rows (parent_agency_id
--        for team_members)
--      - service role bypasses everything (existing behavior)
--
-- The column is nullable so existing INSERT callers that omit it still
-- succeed. The trigger backfills before the row hits storage. Rows that
-- still end up with user_id=NULL (orphan leads) are invisible to clients
-- — that's the intended outcome.

BEGIN;

-- ── Schema ────────────────────────────────────────────────────────
ALTER TABLE outreach_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill from leads.user_id (the canonical owner).
UPDATE outreach_log o
SET user_id = l.user_id
FROM leads l
WHERE o.lead_id = l.id
  AND o.user_id IS NULL
  AND l.user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_log_user_id ON outreach_log(user_id);

-- ── Trigger: auto-fill user_id on insert from lead_id ─────────────
CREATE OR REPLACE FUNCTION outreach_log_fill_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_outreach_log_fill_user_id ON outreach_log;
CREATE TRIGGER trg_outreach_log_fill_user_id
  BEFORE INSERT ON outreach_log
  FOR EACH ROW EXECUTE FUNCTION outreach_log_fill_user_id();

-- ── RLS — replace the wide-open policy ────────────────────────────
DROP POLICY IF EXISTS "outreach_admin_team" ON outreach_log;

-- Admins / agencies see their own rows.
CREATE POLICY "outreach_owner" ON outreach_log FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      -- Team members see rows owned by their parent agency, gated by an
      -- active row in team_members (matches the helper in
      -- src/lib/security/require-owned-client.ts).
      SELECT 1 FROM profiles p
      LEFT JOIN team_members tm
        ON tm.member_profile_id = p.id
       AND tm.agency_owner_id   = p.parent_agency_id
       AND tm.status = 'active'
      WHERE p.id = auth.uid()
        AND p.role = 'team_member'
        AND p.parent_agency_id = outreach_log.user_id
        AND tm.id IS NOT NULL
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN team_members tm
        ON tm.member_profile_id = p.id
       AND tm.agency_owner_id   = p.parent_agency_id
       AND tm.status = 'active'
      WHERE p.id = auth.uid()
        AND p.role = 'team_member'
        AND p.parent_agency_id = outreach_log.user_id
        AND tm.id IS NOT NULL
    )
  );

COMMIT;
