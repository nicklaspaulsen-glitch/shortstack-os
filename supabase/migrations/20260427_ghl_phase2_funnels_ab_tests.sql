-- Phase 2: Funnel public surface + A/B Testing
-- Idempotent. Extends existing funnels schema with public-facing columns
-- (slug, page_doc) so the funnel can be served at /f/[slug]/[step] without
-- exposing internal IDs, and creates the A/B testing tables.
--
-- Already applied to project jkttomvrfhomhthetqhh on 2026-04-27.

-- ── funnels: add slug for public-facing URL ─────────────────────────────
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.funnels
SET slug = lower(regexp_replace(coalesce(name, 'funnel-' || substr(id::text, 1, 8)), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funnels_slug_unique ON public.funnels(slug) WHERE slug IS NOT NULL;

-- ── funnel_steps: add slug + page_doc for public step pages ────────────
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS page_doc jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS next_step_id uuid REFERENCES public.funnel_steps(id) ON DELETE SET NULL;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.funnel_steps
SET slug = lower(regexp_replace(coalesce(title, step_type, 'step-' || substr(id::text, 1, 8)), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funnel_steps_funnel_slug_unique ON public.funnel_steps(funnel_id, slug) WHERE slug IS NOT NULL;

-- ── public read for published funnels: SELECT-only, status='published' ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'funnels_public_read' AND polrelid = 'public.funnels'::regclass) THEN
    EXECUTE 'CREATE POLICY "funnels_public_read" ON public.funnels FOR SELECT USING (status = ''published'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'funnel_steps_public_read' AND polrelid = 'public.funnel_steps'::regclass) THEN
    EXECUTE 'CREATE POLICY "funnel_steps_public_read" ON public.funnel_steps FOR SELECT USING (funnel_id IN (SELECT id FROM public.funnels WHERE status = ''published''))';
  END IF;
END$$;

-- ── funnel_analytics: allow public INSERT for view tracking ─────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'funnel_analytics_public_insert' AND polrelid = 'public.funnel_analytics'::regclass) THEN
    EXECUTE 'CREATE POLICY "funnel_analytics_public_insert" ON public.funnel_analytics FOR INSERT WITH CHECK (true)';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_funnel_analytics_funnel_event
  ON public.funnel_analytics(funnel_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_analytics_step_event
  ON public.funnel_analytics(step_id, event_type);

-- ── ab_tests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_type          text NOT NULL CHECK (parent_type IN ('landing_page','funnel_step','email')),
  parent_id            uuid NOT NULL,
  name                 text NOT NULL,
  status               text NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','completed')),
  winner_variant_id    uuid,
  traffic_split        jsonb DEFAULT '{}'::jsonb,
  started_at           timestamptz DEFAULT now(),
  ended_at             timestamptz
);
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ab_tests_own' AND polrelid = 'public.ab_tests'::regclass) THEN
    EXECUTE 'CREATE POLICY "ab_tests_own" ON public.ab_tests FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_ab_tests_parent ON public.ab_tests(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_user ON public.ab_tests(user_id, status);

-- ── ab_variants ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ab_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id       uuid NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_key   text NOT NULL,
  content       jsonb NOT NULL,
  views         integer NOT NULL DEFAULT 0,
  conversions   integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(test_id, variant_key)
);
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ab_variants_own' AND polrelid = 'public.ab_variants'::regclass) THEN
    EXECUTE 'CREATE POLICY "ab_variants_own" ON public.ab_variants FOR ALL USING (test_id IN (SELECT id FROM public.ab_tests WHERE user_id = auth.uid())) WITH CHECK (test_id IN (SELECT id FROM public.ab_tests WHERE user_id = auth.uid()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ab_variants_public_read' AND polrelid = 'public.ab_variants'::regclass) THEN
    EXECUTE 'CREATE POLICY "ab_variants_public_read" ON public.ab_variants FOR SELECT USING (test_id IN (SELECT id FROM public.ab_tests WHERE status = ''running''))';
  END IF;
END$$;
