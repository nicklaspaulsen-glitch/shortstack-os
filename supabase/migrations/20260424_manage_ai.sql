-- Manage Tab AI Expansion (Sprint)
-- Adds: tasks, project_health_snapshots, scope_creep_flags,
--       project_weekly_reports, project_post_mortems.
--
-- Depends on the `projects`, `project_members` tables from
-- feat/projects-central-unit (migration 20260424_projects_central.sql).
-- This migration and that one will land together.
--
-- RLS strategy: project members SELECT; owners/leads INSERT/UPDATE/DELETE.
-- Reuses the is_project_member(uuid, uuid) and
-- is_project_owner_or_lead(uuid, uuid) SECURITY DEFINER helpers declared
-- in the projects-central migration.

-- ============================================================
-- tasks
-- ============================================================
-- A tasks table is introduced here. Unlike project_tasks (kanban feature,
-- board-scoped), tasks here are the atomic units of work inside a project,
-- used by the AI kickoff + delegation features. Kept separate on purpose.
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  assignee_id   uuid references profiles(id) on delete set null,
  status        text not null default 'todo'
                  check (status in ('todo','in_progress','review','done')),
  priority      text not null default 'medium'
                  check (priority in ('low','medium','high','urgent')),
  due_date      date,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_tasks_project_status on tasks(project_id, status);
create index if not exists idx_tasks_assignee        on tasks(assignee_id);
create index if not exists idx_tasks_due_date        on tasks(due_date);

alter table tasks enable row level security;

drop policy if exists "Members view project tasks" on tasks;
create policy "Members view project tasks" on tasks
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads insert project tasks" on tasks;
create policy "Owners and leads insert project tasks" on tasks
  for insert
  with check (is_project_owner_or_lead(project_id, auth.uid()));

drop policy if exists "Owners and leads update project tasks" on tasks;
create policy "Owners and leads update project tasks" on tasks
  for update
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

drop policy if exists "Owners and leads delete project tasks" on tasks;
create policy "Owners and leads delete project tasks" on tasks
  for delete
  using (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- project_health_snapshots
-- ============================================================
create table if not exists project_health_snapshots (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  date          date not null,
  status        text not null
                  check (status in ('red','yellow','green')),
  reasons       jsonb not null default '[]'::jsonb,
  generated_at  timestamptz not null default now(),
  unique (project_id, date)
);

create index if not exists idx_health_project_date
  on project_health_snapshots(project_id, date desc);

alter table project_health_snapshots enable row level security;

drop policy if exists "Members view project health" on project_health_snapshots;
create policy "Members view project health" on project_health_snapshots
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads mutate project health" on project_health_snapshots;
create policy "Owners and leads mutate project health" on project_health_snapshots
  for all
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- scope_creep_flags
-- ============================================================
create table if not exists scope_creep_flags (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  flag_type           text not null,
  description         text not null,
  source_asset_id     uuid,
  source_asset_table  text,
  severity            text not null
                        check (severity in ('low','medium','high')),
  resolved            boolean not null default false,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  resolved_by         uuid references profiles(id) on delete set null
);

create index if not exists idx_scope_flags_project_resolved
  on scope_creep_flags(project_id, resolved);
create index if not exists idx_scope_flags_created_at
  on scope_creep_flags(created_at desc);

alter table scope_creep_flags enable row level security;

drop policy if exists "Members view scope flags" on scope_creep_flags;
create policy "Members view scope flags" on scope_creep_flags
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads mutate scope flags" on scope_creep_flags;
create policy "Owners and leads mutate scope flags" on scope_creep_flags
  for all
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- project_weekly_reports
-- ============================================================
create table if not exists project_weekly_reports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  week_start    date not null,
  content       text not null,
  status        text not null default 'draft'
                  check (status in ('draft','sent','skipped')),
  generated_at  timestamptz not null default now(),
  sent_at       timestamptz,
  sent_by       uuid references profiles(id) on delete set null
);

create index if not exists idx_weekly_reports_project_week
  on project_weekly_reports(project_id, week_start desc);
create index if not exists idx_weekly_reports_status
  on project_weekly_reports(status);

alter table project_weekly_reports enable row level security;

drop policy if exists "Members view weekly reports" on project_weekly_reports;
create policy "Members view weekly reports" on project_weekly_reports
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads mutate weekly reports" on project_weekly_reports;
create policy "Owners and leads mutate weekly reports" on project_weekly_reports
  for all
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- project_post_mortems
-- ============================================================
create table if not exists project_post_mortems (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  content       text not null,
  generated_at  timestamptz not null default now(),
  generated_by  text not null default 'ai'
                  check (generated_by in ('ai','manual')),
  edited_at     timestamptz,
  edited_by     uuid references profiles(id) on delete set null
);

create index if not exists idx_post_mortems_project
  on project_post_mortems(project_id, generated_at desc);

alter table project_post_mortems enable row level security;

drop policy if exists "Members view post mortems" on project_post_mortems;
create policy "Members view post mortems" on project_post_mortems
  for select
  using (
    is_project_member(project_id, auth.uid())
    or is_project_owner_or_lead(project_id, auth.uid())
  );

drop policy if exists "Owners and leads mutate post mortems" on project_post_mortems;
create policy "Owners and leads mutate post mortems" on project_post_mortems
  for all
  using (is_project_owner_or_lead(project_id, auth.uid()))
  with check (is_project_owner_or_lead(project_id, auth.uid()));

-- ============================================================
-- grants
-- ============================================================
grant select, insert, update, delete on tasks                     to authenticated;
grant select, insert, update, delete on project_health_snapshots  to authenticated;
grant select, insert, update, delete on scope_creep_flags         to authenticated;
grant select, insert, update, delete on project_weekly_reports    to authenticated;
grant select, insert, update, delete on project_post_mortems      to authenticated;
