-- ════════════════════════════════════════════════════════════════════
-- Course progress tracking for the student-facing portal viewer.
--
-- - course_progress: one row per (client, lesson) marking lesson completion.
--   This sits alongside the `course_enrollments.progress` JSON blob, but
--   gives us a fast queryable shape for completion heatmaps and for
--   computing completion % across modules.
--
-- - course_enrollments already exists from b749e84 (course_id, client_id,
--   enrolled_at, expires_at, progress jsonb). We add `progress_percent`
--   (int 0–100) as a denormalized cache so the listing page can render
--   per-course progress without loading every lesson.
--
-- Access model: all course tables are already RLS'd to the course owner
-- (courses.profile_id = auth.uid()). The portal APIs use the service
-- client after verifyClientAccess, so these policies don't block portal
-- writes. We add a read policy on course_progress that mirrors the
-- existing pattern (owner-scoped).
-- ════════════════════════════════════════════════════════════════════

-- ─── course_progress ──────────────────────────────────────────────
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, lesson_id)
);

create index if not exists course_progress_client_course_idx
  on public.course_progress (client_id, course_id);

create index if not exists course_progress_lesson_idx
  on public.course_progress (lesson_id);

alter table public.course_progress enable row level security;

-- Owner-scoped policy (agency owner can read/write completion for any
-- of their clients). Portal writes go through service client after
-- verifyClientAccess, bypassing RLS.
drop policy if exists "own" on public.course_progress;
create policy "own" on public.course_progress
  for all
  using (
    course_id in (
      select id from public.courses where profile_id = auth.uid()
    )
  )
  with check (
    course_id in (
      select id from public.courses where profile_id = auth.uid()
    )
  );

-- ─── course_enrollments.progress_percent ──────────────────────────
alter table public.course_enrollments
  add column if not exists progress_percent integer not null default 0;

-- Useful for listing page ordering (most-active courses first)
alter table public.course_enrollments
  add column if not exists last_accessed_at timestamptz;

create index if not exists course_enrollments_client_idx
  on public.course_enrollments (client_id);

create index if not exists course_enrollments_course_client_idx
  on public.course_enrollments (course_id, client_id);
