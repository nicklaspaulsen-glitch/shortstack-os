-- Migration: Campaign assignment columns on leads table
-- Date: 2026-04-18
-- Adds the ability to link a lead to an outreach campaign + schedule,
-- so the scraper's "Push to campaign" flow can persist assignments.

-- ── Leads table: campaign linkage ───────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_campaign_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_schedule text;       -- once | daily | every_other_day | weekdays | custom
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_assigned_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_start_at   timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_team_member_id uuid;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_campaign ON leads(assigned_campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);

-- ── Content calendar: engagement_data for Content Plan Hub ──────────
-- The Content Plan Hub expects each content_calendar row to have an
-- engagement_data jsonb column. Add it if missing so the API can read
-- likes/comments/shares/views/top_comment consistently.
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS engagement_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
