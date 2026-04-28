-- Apr 28: SECURITY MIGRATION — close cross-tenant admin/founder OR-escape.
--
-- The Apr 26 "tighten_leads_outreach_content_rls_team_scoped" migration
-- added per-owner scoping but left an `OR (profiles.role IN ('admin',
-- 'founder'))` clause on every policy. That clause grants ANY admin or
-- founder user FOR ALL access across ALL tenants — wide-open footgun
-- once whitelabel_saas_mode lets multiple agencies share the platform.
--
-- ShortStack OS today is single-tenant (2 admins, both internal). Once
-- a second agency signs up under whitelabel mode and gets `founder`,
-- they would immediately read every other agency's leads / content /
-- follow-ups. Closing the escape now while it's still single-tenant.
--
-- Keep the team_member scoped branch so genuine multi-seat access
-- continues to work. Service role bypasses RLS — internal admin tools
-- that legitimately need cross-tenant reads should use the service
-- client (createServiceClient) explicitly.
--
-- This file is the source-of-truth mirror; the migration was applied
-- via the Supabase MCP `apply_migration` as
-- `tighten_admin_founder_rls_escape_2026_04_28` on 2026-04-28.

-- ── leads ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leads_admin_team" ON leads;

CREATE POLICY "leads_owner_or_team" ON leads FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_profile_id = auth.uid()
        AND tm.agency_owner_id = leads.user_id
        AND tm.status = 'active'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_profile_id = auth.uid()
        AND tm.agency_owner_id = leads.user_id
        AND tm.status = 'active'
    )
  );

-- ── content_calendar ──────────────────────────────────────────────
DROP POLICY IF EXISTS "content_calendar_admin_team" ON content_calendar;

CREATE POLICY "content_calendar_owner_or_team" ON content_calendar FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = content_calendar.client_id
        AND (
          c.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = c.profile_id
              AND tm.status = 'active'
          )
        )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = content_calendar.client_id
        AND (
          c.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = c.profile_id
              AND tm.status = 'active'
          )
        )
    )
  );

-- ── content_scripts ───────────────────────────────────────────────
DROP POLICY IF EXISTS "content_scripts_admin_team" ON content_scripts;

CREATE POLICY "content_scripts_owner_or_team" ON content_scripts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = content_scripts.client_id
        AND (
          c.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = c.profile_id
              AND tm.status = 'active'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = content_scripts.client_id
        AND (
          c.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = c.profile_id
              AND tm.status = 'active'
          )
        )
    )
  );

-- ── follow_up_queue ───────────────────────────────────────────────
DROP POLICY IF EXISTS "followup_admin_team" ON follow_up_queue;

CREATE POLICY "followup_owner_or_team" ON follow_up_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = follow_up_queue.lead_id
        AND (
          l.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = l.user_id
              AND tm.status = 'active'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = follow_up_queue.lead_id
        AND (
          l.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.member_profile_id = auth.uid()
              AND tm.agency_owner_id = l.user_id
              AND tm.status = 'active'
          )
        )
    )
  );
