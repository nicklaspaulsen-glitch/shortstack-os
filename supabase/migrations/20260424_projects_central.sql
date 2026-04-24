-- Projects Central Unit — Sprint 1 reframing
-- Projects become the organizing unit of the Creative Production OS.
-- Coexists with existing project_boards (kanban) feature; wire-up later sprints.
--
-- Three tables:
--   projects           — the creative project itself (name, brief, deadline, status)
--   project_members    — team membership with role (lead/contributor/freelancer/client/viewer)
--   project_assets     — polymorphic link from project to any produced asset
--
-- RLS strategy: membership-gated SELECT; owner/lead-gated mutations. Owners are
-- stored as owner_id (profiles.id). Membership is checked through project_members
-- with a SECURITY DEFINER helper to avoid recursive RLS on project_members itself.

-- ============================================================
-- projects
-- ============================================================
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid,
  client_id   uuid references clients(id) on delete set null,
  name        text not null,
  brief       text,
  deadline    timestamptz,
  status      text not null default 'draft'
                check (status in ('draft','active','review','complete','archived')),
  owner_id    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_projects_org_status    on projects(org_id, status);
create index if not exists idx_projects_client        on projects(client_id);
create index if not exists idx_projects_deadline      on projects(deadline);
create index if not exists idx_projects_owner         on projects(owner_id);

-- Auto-update updated_at
create or replace function update_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_projects_updated_at();

-- ============================================================
-- project_members
-- ============================================================
create table if not exists project_members (
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'contributor'
                check (role in ('lead','contributor','freelancer','client','viewer')),
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user    on project_members(user_id);
create index if not exists idx_project_members_project on project_members(project_id);

-- ============================================================
-- project_assets
-- ============================================================
create table if not exists project_assets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  asset_type  text not null
                check (asset_type in ('ai_generation','invoice','booking','file','hire','message','thumbnail','video')),
  asset_id    uuid,
  asset_table text,
  added_at    timestamptz not null default now(),
  added_by    uuid references profiles(id) on delete set null
);

create index if not exists idx_project_assets_project on project_assets(project_id, added_at desc);
create index if not exists idx_project_assets_type    on project_assets(asset_type);
create index if not exists idx_project_assets_asset   on project_assets(asset_table, asset_id);

-- ============================================================
-- Membership helper (SECURITY DEFINER, avoids RLS recursion)
-- ============================================================
create or replace function is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id
      and user_id = p_user_id
  );
$$;

create or replace function is_project_owner_or_lead(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects p
    where p.id = p_project_id
      and p.owner_id = p_user_id
  )
  or exists (
    select 1 from project_members m
    where m.project_id = p_project_id
      and m.user_id = p_user_id
      and m.role = 'lead'
  );
$$;

-- ============================================================
-- RLS: projects
-- ============================================================
alter table projects enable row level security;

drop policy if exists "Members can view projects" on projects;
create policy "Members can view projects" on projects
  for select
  using (
    owner_id = auth.uid()
    or is_project_member(id, auth.uid())
  );

drop policy if exists "Authenticated can create projects" on projects;
create policy "Authenticated can create projects" on projects
  for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "Owners and leads update projects" on projects;
create policy "Owners and leads update projects" on projects
  for update
  using (
    owner_id = auth.uid()
    or is_project_owner_or_lead(id, auth.uid())
  )
  with check (
    owner_id = auth.uid()
    or is_project_owner_or_lead(id, auth.uid())
  );

drop policy if exists "Owners and leads delete projects" on projects;
create policy "Owners and leads delete projects" on projects
  for delete
  using (
    owner_id = auth.uid()
    or is_project_owner_or_lead(id, auth.uid())
  );

-- ============================================================
-- RLS: project_members
-- ============================================================
alter table project_members enable row level security;

drop policy if exists "Members can view membership" on project_members;
create policy "Members can view membership" on project_members
  for select
  using (
    user_id = auth.uid()
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads manage membership" on project_members;
create policy "Owners and leads manage membership" on project_members
  for all
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- RLS: project_assets
-- ============================================================
alter table project_assets enable row level security;

drop policy if exists "Members can view project assets" on project_assets;
create policy "Members can view project assets" on project_assets
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads add project assets" on project_assets;
create policy "Owners and leads add project assets" on project_assets
  for insert
  with check (is_project_owner_or_lead(project_id, auth.uid()));

drop policy if exists "Owners and leads update project assets" on project_assets;
create policy "Owners and leads update project assets" on project_assets
  for update
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

drop policy if exists "Owners and leads delete project assets" on project_assets;
create policy "Owners and leads delete project assets" on project_assets
  for delete
  using (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- grants
-- ============================================================
grant select, insert, update, delete on projects         to authenticated;
grant select, insert, update, delete on project_members  to authenticated;
grant select, insert, update, delete on project_assets   to authenticated;
