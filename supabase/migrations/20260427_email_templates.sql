-- Branded welcome email + per-agency getting-started doc (Apr 27)
--
-- Two related tables:
--   1. email_templates — per-agency overrides for transactional emails (welcome,
--      team invite, trial signup, magic link, password reset). Defaults ship
--      pre-filled in code (`src/lib/email-templates/defaults.ts`); a row only
--      exists once an agency has customized the template.
--   2. getting_started_docs — per-agency public-facing onboarding doc, served
--      at /getting-started/[ownerSlug]. Rows are anon-readable when
--      `is_public = true`; everything else is owner-scoped.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'client_welcome',
    'team_invite',
    'trial_signup',
    'magic_link',
    'password_reset'
  )),
  subject text NOT NULL,
  preview_text text,
  html_body text NOT NULL,
  plain_body text NOT NULL,
  cta_label text,
  cta_url_template text,
  is_default boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_owner_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_owner_kind
  ON public.email_templates(agency_owner_id, kind);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_owner" ON public.email_templates;
CREATE POLICY "email_templates_owner" ON public.email_templates
  FOR ALL USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Per-agency getting-started doc content. Stored as portable Markdown sections
-- so the editor can be a friendly form and the renderer is straightforward.
CREATE TABLE IF NOT EXISTS public.getting_started_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL DEFAULT 'main',
  hero_title text NOT NULL,
  hero_subtitle text,
  hero_video_url text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_email text,
  is_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_getting_started_owner
  ON public.getting_started_docs(agency_owner_id);

ALTER TABLE public.getting_started_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "getting_started_owner" ON public.getting_started_docs;
CREATE POLICY "getting_started_owner" ON public.getting_started_docs
  FOR ALL USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Public read for /getting-started/[ownerSlug] page (uses anon key).
DROP POLICY IF EXISTS "getting_started_public_read" ON public.getting_started_docs;
CREATE POLICY "getting_started_public_read" ON public.getting_started_docs
  FOR SELECT TO anon
  USING (is_public = true);

-- Auto-bump updated_at on any change.
CREATE OR REPLACE FUNCTION public.email_templates_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_touch ON public.email_templates;
CREATE TRIGGER trg_email_templates_touch
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.email_templates_touch_updated_at();

DROP TRIGGER IF EXISTS trg_getting_started_touch ON public.getting_started_docs;
CREATE TRIGGER trg_getting_started_touch
  BEFORE UPDATE ON public.getting_started_docs
  FOR EACH ROW EXECUTE FUNCTION public.email_templates_touch_updated_at();
