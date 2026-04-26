-- Phase 1: Course / Membership Builder
-- This migration is IDEMPOTENT and captures the schema currently live in
-- production for courses + modules + lessons + enrollments + progress.
-- Re-running it is a no-op.
--
-- Tables already present in `jkttomvrfhomhthetqhh` were created via earlier
-- ad-hoc applies; this file makes them reproducible from source control.
--
-- See docs/ghl-parity-2026-04.md (HIGH severity gap closed).

-- ── courses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  thumbnail_url text,
  price         numeric DEFAULT 0,
  is_free       boolean DEFAULT false,
  status        text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  access_type   text DEFAULT 'lifetime' CHECK (access_type IN ('lifetime','subscription','drip')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'own' AND polrelid = 'public.courses'::regclass) THEN
    EXECUTE 'CREATE POLICY "own" ON public.courses FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid())';
  END IF;
END$$;

-- ── course_modules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  sort_order      integer DEFAULT 0,
  is_free_preview boolean DEFAULT false
);
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'own' AND polrelid = 'public.course_modules'::regclass) THEN
    EXECUTE $POL$CREATE POLICY "own" ON public.course_modules FOR ALL USING (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid())) WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid()))$POL$;
  END IF;
END$$;

-- ── course_lessons ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        uuid REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title            text NOT NULL,
  content_type     text DEFAULT 'video' CHECK (content_type IN ('video','text','quiz','file')),
  content_url      text,
  content_body     text,
  duration_seconds integer,
  sort_order       integer DEFAULT 0,
  is_free_preview  boolean DEFAULT false,
  drip_delay_days  integer DEFAULT 0
);
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'own' AND polrelid = 'public.course_lessons'::regclass) THEN
    EXECUTE $POL$CREATE POLICY "own" ON public.course_lessons FOR ALL USING (module_id IN (SELECT cm.id FROM public.course_modules cm JOIN public.courses c ON cm.course_id = c.id WHERE c.profile_id = auth.uid())) WITH CHECK (module_id IN (SELECT cm.id FROM public.course_modules cm JOIN public.courses c ON cm.course_id = c.id WHERE c.profile_id = auth.uid()))$POL$;
  END IF;
END$$;

-- ── course_enrollments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  enrolled_at       timestamptz DEFAULT now(),
  expires_at        timestamptz,
  progress          jsonb DEFAULT '{}'::jsonb,
  progress_percent  integer NOT NULL DEFAULT 0,
  last_accessed_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS course_enrollments_course_client_key
  ON public.course_enrollments(course_id, client_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course
  ON public.course_enrollments(course_id);
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'own' AND polrelid = 'public.course_enrollments'::regclass) THEN
    EXECUTE $POL$CREATE POLICY "own" ON public.course_enrollments FOR ALL USING (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid())) WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid()))$POL$;
  END IF;
END$$;

-- ── course_progress ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  lesson_id     uuid REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS course_progress_unique
  ON public.course_progress(course_id, client_id, lesson_id);
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'own' AND polrelid = 'public.course_progress'::regclass) THEN
    EXECUTE $POL$CREATE POLICY "own" ON public.course_progress FOR ALL USING (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid())) WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE profile_id = auth.uid()))$POL$;
  END IF;
END$$;

-- Helpful supporting indexes
CREATE INDEX IF NOT EXISTS idx_modules_course   ON public.course_modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module   ON public.course_lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_profile  ON public.courses(profile_id, status);
