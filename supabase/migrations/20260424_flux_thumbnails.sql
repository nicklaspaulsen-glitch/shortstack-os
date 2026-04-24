-- ─────────────────────────────────────────────────────────────────
-- FLUX.1 thumbnail backend upgrade — Apr 24 2026
--
-- Scope:
--   1. Ensure `generated_images.model` has a sensible default + backfill
--      the constraint so rows written by the new flux-client include the
--      model id ("flux-dev", "flux-schnell", "legacy").
--   2. Optional tracking table `flux_generation_jobs` for async/bulk
--      pipelines that don't write to `generated_images` directly
--      (e.g. batch thumbnail runs, upscale side-jobs).
--
-- SAFE: all DDL is guarded so re-running on a fresh DB without the
-- thumbnail stack is a no-op.
-- ─────────────────────────────────────────────────────────────────

-- 1) generated_images.model default + backfill ------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'generated_images'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'generated_images'
        and column_name = 'model'
    ) then
      alter table generated_images add column model text default 'legacy';
    else
      alter table generated_images alter column model set default 'legacy';
    end if;

    update generated_images set model = 'legacy' where model is null;
  end if;
end $$;

-- 2) flux_generation_jobs (optional tracking) -------------------------
create table if not exists flux_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  prompt text not null,
  model text not null default 'flux-dev'
    check (model in ('flux-dev', 'flux-schnell', 'legacy')),
  output_url text,
  cost_usd numeric(10, 6),
  duration_ms integer,
  seed bigint,
  width integer,
  height integer,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  error text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_flux_generation_jobs_org
  on flux_generation_jobs(org_id);
create index if not exists idx_flux_generation_jobs_user
  on flux_generation_jobs(user_id);
create index if not exists idx_flux_generation_jobs_created
  on flux_generation_jobs(created_at desc);
create index if not exists idx_flux_generation_jobs_model
  on flux_generation_jobs(model);
create index if not exists idx_flux_generation_jobs_status
  on flux_generation_jobs(status);

alter table flux_generation_jobs enable row level security;

drop policy if exists "flux_jobs_owner_read" on flux_generation_jobs;
create policy "flux_jobs_owner_read"
  on flux_generation_jobs for select
  using (auth.uid() = user_id or auth.uid() = org_id);

drop policy if exists "flux_jobs_owner_write" on flux_generation_jobs;
create policy "flux_jobs_owner_write"
  on flux_generation_jobs for insert
  with check (auth.uid() = user_id or auth.uid() = org_id);

drop policy if exists "flux_jobs_owner_update" on flux_generation_jobs;
create policy "flux_jobs_owner_update"
  on flux_generation_jobs for update
  using (auth.uid() = user_id or auth.uid() = org_id);

comment on table flux_generation_jobs is
  'FLUX / legacy image-gen job log. flux-dev is non-commercial, flux-schnell is Apache-2.0.';
