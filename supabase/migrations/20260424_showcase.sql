-- Showcase / Case-Study Pages
-- Public marketing case-study pages generated (optionally) from completed projects.
-- `org_id` is the agency owner's profile id (follows the codebase's
-- profile_id convention; team_members resolve to parent via routes).

-- ============================================================
-- case_studies
-- ============================================================
create table if not exists public.case_studies (
  id                      uuid        primary key default gen_random_uuid(),
  org_id                  uuid        not null references profiles(id) on delete cascade,
  project_id              uuid,
  title                   text        not null,
  subtitle                text,
  slug                    text        not null unique,
  hero_image_url          text,
  hero_video_url          text,
  summary                 text,
  body_markdown           text,
  metrics                 jsonb       not null default '[]'::jsonb,
  testimonial             text,
  testimonial_author      text,
  testimonial_role        text,
  testimonial_avatar_url  text,
  client_name             text,
  client_logo_url         text,
  industry_tags           text[]      not null default '{}',
  service_tags            text[]      not null default '{}',
  published               boolean     not null default false,
  published_at            timestamptz,
  seo_title               text,
  seo_description         text,
  og_image_url            text,
  created_by              uuid        references profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_case_studies_org_pub
  on public.case_studies(org_id, published);

create index if not exists idx_case_studies_published_at
  on public.case_studies(published, published_at desc);

alter table public.case_studies enable row level security;

drop policy if exists "Public reads published case studies" on public.case_studies;
create policy "Public reads published case studies" on public.case_studies
  for select using (published = true);

drop policy if exists "Org members read own case studies" on public.case_studies;
create policy "Org members read own case studies" on public.case_studies
  for select using (
    auth.uid() = org_id
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'team_member'
        and p.parent_agency_id = case_studies.org_id
    )
  );

drop policy if exists "Org members insert case studies" on public.case_studies;
create policy "Org members insert case studies" on public.case_studies
  for insert with check (
    auth.uid() = org_id
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'team_member'
        and p.parent_agency_id = case_studies.org_id
    )
  );

drop policy if exists "Org members update own case studies" on public.case_studies;
create policy "Org members update own case studies" on public.case_studies
  for update using (
    auth.uid() = org_id
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'team_member'
        and p.parent_agency_id = case_studies.org_id
    )
  );

drop policy if exists "Admins delete case studies" on public.case_studies;
create policy "Admins delete case studies" on public.case_studies
  for delete using (auth.uid() = org_id);

create or replace function update_case_studies_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_case_studies_updated_at on public.case_studies;
create trigger trg_case_studies_updated_at
  before update on public.case_studies
  for each row execute function update_case_studies_updated_at();

-- ============================================================
-- case_study_assets
-- ============================================================
create table if not exists public.case_study_assets (
  id              uuid        primary key default gen_random_uuid(),
  case_study_id   uuid        not null references public.case_studies(id) on delete cascade,
  asset_url       text        not null,
  asset_type      text        not null check (asset_type in ('image','video','embed')),
  caption         text,
  position        integer     not null default 0,
  created_at      timestamptz not null default now(),
  unique (case_study_id, position)
);

create index if not exists idx_case_study_assets_parent
  on public.case_study_assets(case_study_id, position);

alter table public.case_study_assets enable row level security;

drop policy if exists "Public reads assets of published" on public.case_study_assets;
create policy "Public reads assets of published" on public.case_study_assets
  for select using (
    exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_assets.case_study_id
        and cs.published = true
    )
  );

drop policy if exists "Org members read own assets" on public.case_study_assets;
create policy "Org members read own assets" on public.case_study_assets
  for select using (
    exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_assets.case_study_id
        and (
          cs.org_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.role = 'team_member'
              and p.parent_agency_id = cs.org_id
          )
        )
    )
  );

drop policy if exists "Org members write own assets" on public.case_study_assets;
create policy "Org members write own assets" on public.case_study_assets
  for all using (
    exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_assets.case_study_id
        and (
          cs.org_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.role = 'team_member'
              and p.parent_agency_id = cs.org_id
          )
        )
    )
  ) with check (
    exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_assets.case_study_id
        and (
          cs.org_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.role = 'team_member'
              and p.parent_agency_id = cs.org_id
          )
        )
    )
  );

-- ============================================================
-- case_study_views
-- ============================================================
create table if not exists public.case_study_views (
  id              uuid        primary key default gen_random_uuid(),
  case_study_id   uuid        not null references public.case_studies(id) on delete cascade,
  referrer        text,
  user_agent_hash text,
  country         text,
  viewed_at       timestamptz not null default now()
);

create index if not exists idx_case_study_views_by_study_time
  on public.case_study_views(case_study_id, viewed_at desc);

alter table public.case_study_views enable row level security;

drop policy if exists "Anyone logs views" on public.case_study_views;
create policy "Anyone logs views" on public.case_study_views
  for insert with check (true);

drop policy if exists "Org members read own views" on public.case_study_views;
create policy "Org members read own views" on public.case_study_views
  for select using (
    exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_views.case_study_id
        and (
          cs.org_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.role = 'team_member'
              and p.parent_agency_id = cs.org_id
          )
        )
    )
  );
