-- AI auto-edit jobs (video-use integration).
-- Each row represents one raw-footage-in / polished-video-out request.

create table if not exists public.ai_video_jobs (
  id                 uuid         primary key default gen_random_uuid(),
  org_id             uuid,
  project_id         uuid,
  asset_id_in        uuid,
  asset_id_out       uuid,
  source_url         text,
  output_url         text,
  style_hints        jsonb        not null default '{}'::jsonb,
  status             text         not null default 'queued'
                                    check (status in (
                                      'queued',
                                      'downloading',
                                      'processing',
                                      'uploading',
                                      'complete',
                                      'failed'
                                    )),
  error              text,
  cost_usd           numeric(10,4) not null default 0,
  duration_seconds   numeric,
  user_id            uuid         references auth.users(id) on delete set null,
  created_at         timestamptz  not null default now(),
  started_at         timestamptz,
  completed_at       timestamptz
);

-- Hot-path index for dashboard listing (most recent first, filtered by org).
create index if not exists ai_video_jobs_org_status_created_idx
  on public.ai_video_jobs (org_id, status, created_at desc);

-- Secondary index for per-user history.
create index if not exists ai_video_jobs_user_created_idx
  on public.ai_video_jobs (user_id, created_at desc);

-- Touch trigger: populate started_at / completed_at as status changes.
create or replace function public.ai_video_jobs_touch()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('downloading','processing','uploading') and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status in ('complete','failed') and new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ai_video_jobs_touch_trg on public.ai_video_jobs;
create trigger ai_video_jobs_touch_trg
  before update on public.ai_video_jobs
  for each row execute function public.ai_video_jobs_touch();

-- RLS ------------------------------------------------------------------
alter table public.ai_video_jobs enable row level security;

-- Org members can SELECT. If the organization_members table exists we join it;
-- otherwise fall back to owner-only visibility so the policy is safe to
-- deploy before multi-tenant rollout.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_video_jobs' and policyname = 'ai_video_jobs_select'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'organization_members'
    ) then
      create policy ai_video_jobs_select on public.ai_video_jobs
        for select using (
          auth.uid() = user_id
          or exists (
            select 1 from public.organization_members m
            where m.organization_id = ai_video_jobs.org_id
              and m.user_id = auth.uid()
          )
        );
    else
      create policy ai_video_jobs_select on public.ai_video_jobs
        for select using (auth.uid() = user_id);
    end if;
  end if;

  -- INSERT: authenticated users may create their own rows.
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_video_jobs' and policyname = 'ai_video_jobs_insert'
  ) then
    create policy ai_video_jobs_insert on public.ai_video_jobs
      for insert with check (auth.uid() = user_id);
  end if;

  -- UPDATE: the creator can always update their row. Admins (role='admin'
  -- or 'owner' in organization_members if present) can also update.
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_video_jobs' and policyname = 'ai_video_jobs_update'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'organization_members'
    ) then
      create policy ai_video_jobs_update on public.ai_video_jobs
        for update using (
          auth.uid() = user_id
          or exists (
            select 1 from public.organization_members m
            where m.organization_id = ai_video_jobs.org_id
              and m.user_id = auth.uid()
              and m.role in ('admin','owner')
          )
        );
    else
      create policy ai_video_jobs_update on public.ai_video_jobs
        for update using (auth.uid() = user_id);
    end if;
  end if;
end $$;

comment on table public.ai_video_jobs is
  'AI video auto-edit jobs. Orchestrates raw-footage -> polished-video flow via video-use worker.';
comment on column public.ai_video_jobs.style_hints is
  'Serialised options: {style_preset, cut_filler_words, auto_color_grade, audio_fades, burn_subtitles}.';
comment on column public.ai_video_jobs.cost_usd is
  'Best-effort cost estimate reported by worker (Claude API usage for the skill).';
