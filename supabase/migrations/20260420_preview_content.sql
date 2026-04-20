-- Preview content library — real viral thumbnails + CC0 video clips that
-- power the RollingPreview marquee on every tool landing page.
--
-- Thumbnails point at ytimg.com public CDN URLs (no rehosting; same legal
-- posture as /api/thumbnail/recreate). Video clips reference public CC0
-- MP4 CDNs (pixabay, coverr, etc.) — again, not rehosted.
--
-- The table is READ-ONLY for regular users; seeded by server-side scripts
-- or the admin UI. We expose SELECT to all authenticated callers so
-- every tool page can surface the same curated library.

CREATE TABLE IF NOT EXISTS preview_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool text NOT NULL,
  kind text NOT NULL,
  media_url text NOT NULL,
  title text,
  tag text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preview_content_tool
  ON preview_content(tool, is_active, sort_order);

ALTER TABLE preview_content ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read — this is gallery-style curated content.
DROP POLICY IF EXISTS "read preview content" ON preview_content;
CREATE POLICY "read preview content" ON preview_content
  FOR SELECT USING (true);

-- Writes only via service role (seeder script / admin) — no user-side
-- INSERT/UPDATE/DELETE policy, so RLS blocks it by default.
