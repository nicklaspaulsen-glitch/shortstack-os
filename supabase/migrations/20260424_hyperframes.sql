-- Hyperframes compositions and renders
-- Date: 2026-04-24
--
-- Purpose: additive HTML-based video composer (github.com/heygen-com/hyperframes).
-- Runs PARALLEL to existing Remotion pipeline — not a migration. Users can
-- continue using Remotion templates or author a new Hyperframes composition
-- from scratch via /dashboard/video/composer.
--
-- Two tables:
--   hyperframes_compositions — the HTML source of a composition, dimensions,
--     duration, fps. One row per composition; edited in-place.
--   hyperframes_renders — each render attempt (queued / rendering / complete /
--     failed) with output URL and metadata. Multiple renders per composition
--     (versioned).
--
-- RLS model (adapted to this codebase's per-user ownership, with optional
-- org_id for forward-compat):
--   - SELECT/INSERT: anyone authenticated (content scoped by created_by).
--   - UPDATE/DELETE: creator only.
-- If an `organizations` / `organization_members` table is added later, RLS
-- can be extended without schema changes (org_id is already on both tables).

create table if not exists public.hyperframes_compositions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid,
  project_id       uuid references public.video_projects(id) on delete set null,
  title            text not null,
  html_source      text not null default '',
  duration_seconds numeric not null default 10,
  fps              int not null default 30,
  width            int not null default 1920,
  height           int not null default 1080,
  metadata         jsonb not null default '{}'::jsonb,
  created_by       uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_hyperframes_compositions_org_created
  on public.hyperframes_compositions(org_id, created_at desc);
create index if not exists idx_hyperframes_compositions_created_by
  on public.hyperframes_compositions(created_by);
create index if not exists idx_hyperframes_compositions_project
  on public.hyperframes_compositions(project_id);

create table if not exists public.hyperframes_renders (
  id               uuid primary key default gen_random_uuid(),
  composition_id   uuid not null references public.hyperframes_compositions(id) on delete cascade,
  version          int not null default 1,
  output_url       text,
  status           text not null default 'queued'
                     check (status in ('queued','rendering','complete','failed')),
  error            text,
  rendered_at      timestamptz,
  duration_seconds numeric,
  file_size_bytes  bigint,
  -- Optional link to assets table (from asset-library branch). Nullable so
  -- this migration does not depend on that table existing yet.
  asset_id         uuid,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_hyperframes_renders_composition_version
  on public.hyperframes_renders(composition_id, version desc);
create index if not exists idx_hyperframes_renders_status
  on public.hyperframes_renders(status);

-- Auto-update updated_at
create or replace function update_hyperframes_compositions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_hyperframes_compositions_updated_at
  on public.hyperframes_compositions;
create trigger trg_hyperframes_compositions_updated_at
  before update on public.hyperframes_compositions
  for each row execute function update_hyperframes_compositions_updated_at();

create or replace function update_hyperframes_renders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_hyperframes_renders_updated_at
  on public.hyperframes_renders;
create trigger trg_hyperframes_renders_updated_at
  before update on public.hyperframes_renders
  for each row execute function update_hyperframes_renders_updated_at();

-- RLS — hyperframes_compositions
alter table public.hyperframes_compositions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_compositions'
      and policyname = 'hyperframes_compositions_select_auth'
  ) then
    create policy hyperframes_compositions_select_auth
      on public.hyperframes_compositions for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_compositions'
      and policyname = 'hyperframes_compositions_insert_auth'
  ) then
    create policy hyperframes_compositions_insert_auth
      on public.hyperframes_compositions for insert
      with check (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_compositions'
      and policyname = 'hyperframes_compositions_update_creator'
  ) then
    create policy hyperframes_compositions_update_creator
      on public.hyperframes_compositions for update
      using (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_compositions'
      and policyname = 'hyperframes_compositions_delete_creator'
  ) then
    create policy hyperframes_compositions_delete_creator
      on public.hyperframes_compositions for delete
      using (auth.uid() = created_by);
  end if;
end $$;

-- RLS — hyperframes_renders
alter table public.hyperframes_renders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_renders'
      and policyname = 'hyperframes_renders_select_auth'
  ) then
    create policy hyperframes_renders_select_auth
      on public.hyperframes_renders for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_renders'
      and policyname = 'hyperframes_renders_insert_auth'
  ) then
    create policy hyperframes_renders_insert_auth
      on public.hyperframes_renders for insert
      with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_renders'
      and policyname = 'hyperframes_renders_update_creator'
  ) then
    create policy hyperframes_renders_update_creator
      on public.hyperframes_renders for update
      using (
        auth.uid() = created_by
        or exists (
          select 1 from public.hyperframes_compositions c
          where c.id = hyperframes_renders.composition_id
            and c.created_by = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'hyperframes_renders'
      and policyname = 'hyperframes_renders_delete_creator'
  ) then
    create policy hyperframes_renders_delete_creator
      on public.hyperframes_renders for delete
      using (
        auth.uid() = created_by
        or exists (
          select 1 from public.hyperframes_compositions c
          where c.id = hyperframes_renders.composition_id
            and c.created_by = auth.uid()
        )
      );
  end if;
end $$;
