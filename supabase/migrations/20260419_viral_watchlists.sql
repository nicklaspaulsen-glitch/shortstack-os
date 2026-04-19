-- Viral Watchlists — saved niche+keywords+platforms combos that the daily viral-scan
-- cron refreshes. Powers Viral Research Phase 3 (Trinity): scheduled trend scans +
-- watchlist UI inside Script Lab → Trending tab.
-- Date: 2026-04-19

CREATE TABLE IF NOT EXISTS viral_watchlists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  niche           text NOT NULL,
  keywords        text[] NOT NULL DEFAULT '{}',
  platforms       text[] NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  alert_on_new    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_scanned_at timestamptz
);

-- Fast lookup for the cron worker (only scans active watchlists)
CREATE INDEX IF NOT EXISTS idx_viral_watchlists_user_active
  ON viral_watchlists(user_id, active);

-- Used when the cron picks up "oldest-scanned-first" batches
CREATE INDEX IF NOT EXISTS idx_viral_watchlists_active_last_scanned
  ON viral_watchlists(active, last_scanned_at NULLS FIRST);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_viral_watchlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS viral_watchlists_updated_at ON viral_watchlists;
CREATE TRIGGER viral_watchlists_updated_at
  BEFORE UPDATE ON viral_watchlists
  FOR EACH ROW EXECUTE FUNCTION update_viral_watchlists_updated_at();

-- RLS: users can only access their own watchlists
ALTER TABLE viral_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own viral watchlists" ON viral_watchlists;
CREATE POLICY "Users manage own viral watchlists" ON viral_watchlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
