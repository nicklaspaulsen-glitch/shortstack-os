-- Vertical SaaS Templates — Phase 1
-- Pre-configured ShortStack OS templates for niches (Real Estate, Coaches, E-commerce).
-- Templates are stored in code (src/lib/verticals/*.ts) but apply-history is tracked here.
--
-- Applied to production via Supabase MCP on 2026-04-27.
-- Kept here so local resets / branch restores stay in sync.

-- ── vertical_templates: minimal registry table (templates live in code) ──
-- We keep a row per vertical for analytics/preview-image lookups, but the
-- actual content_json (modules, scripts, etc.) lives in src/lib/verticals.
CREATE TABLE IF NOT EXISTS public.vertical_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL UNIQUE CHECK (vertical IN ('real_estate','coaches','ecommerce')),
  display_name text NOT NULL,
  description text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_image text,
  is_global boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vertical_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'vertical_templates_read' AND polrelid = 'public.vertical_templates'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY "vertical_templates_read" ON public.vertical_templates FOR SELECT USING (true)';
  END IF;
END $$;

-- ── vertical_applies: tracks which user applied which vertical, with module list ──
CREATE TABLE IF NOT EXISTS public.vertical_applies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vertical text NOT NULL CHECK (vertical IN ('real_estate','coaches','ecommerce')),
  applied_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vertical_applies_user
  ON public.vertical_applies (user_id, applied_at DESC);

ALTER TABLE public.vertical_applies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'vertical_applies_own' AND polrelid = 'public.vertical_applies'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY "vertical_applies_own" ON public.vertical_applies FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- Seed registry rows. content_json kept empty here — real content lives in code
-- and is served via /api/verticals (which merges DB row + in-code content).
INSERT INTO public.vertical_templates (vertical, display_name, description, preview_image, is_global)
VALUES
  ('real_estate', 'Real Estate Agencies', 'FSBO outreach, listing alerts, mortgage pre-approval funnels, and a 10-module Real Estate Lead-Gen Mastery course — pre-configured for real estate agency owners.', null, true),
  ('coaches',     'Coaches & Consultants', 'Free discovery call funnels, accountability check-ins, milestone sequences, and an 8-module Coaching Business Foundations course.', null, true),
  ('ecommerce',   'E-commerce Brands', 'Welcome series, cart abandonment, post-purchase upsell, win-back sequences, and a 10-module DTC Brand Growth Playbook course.', null, true)
ON CONFLICT (vertical) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description = EXCLUDED.description;
