-- Viral Research Cache — stores Claude-generated (and later real-API) trending video
-- research results keyed by niche + keywords + platforms. Cache for 24h per combo so we
-- don't re-prompt Claude for every click. Used by /api/script-lab/trending.
-- Date: 2026-04-19

CREATE TABLE IF NOT EXISTS viral_research_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  niche text NOT NULL,
  keywords_hash text NOT NULL,     -- md5 of sorted, lowercased keywords CSV
  platforms_hash text NOT NULL,    -- md5 of sorted, lowercased platform CSV
  keywords text[] NOT NULL DEFAULT '{}',
  platforms text[] NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_viral_research_cache_lookup
  ON viral_research_cache(user_id, niche, keywords_hash, platforms_hash, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_viral_research_cache_expires
  ON viral_research_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_viral_research_cache_user_niche
  ON viral_research_cache(user_id, niche, expires_at);

ALTER TABLE viral_research_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own viral research cache" ON viral_research_cache;
CREATE POLICY "Users manage own viral research cache" ON viral_research_cache
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
