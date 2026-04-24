-- Team Syncthing - coordination layer for peer-to-peer file sync
-- Date: 2026-04-24
--
-- Purpose: track Syncthing device IDs, shared folders, and folder membership
-- for internal agency + freelancer collaboration. This is TEAM-ONLY: clients
-- continue using the Google Drive OAuth flow. We do NOT embed the Syncthing
-- daemon; we only coordinate identifiers so users can pair their existing
-- Syncthing installs through the ShortStack UI.

-- Devices --------------------------------------------------------------------

create table if not exists syncthing_devices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  device_id      text not null,
  device_name    text not null default '',
  platform       text not null default 'other'
                   check (platform in ('windows','mac','linux','android','ios','other')),
  last_seen_at   timestamptz,
  added_at       timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists idx_syncthing_devices_user_id
  on syncthing_devices(user_id);

alter table syncthing_devices enable row level security;

drop policy if exists "devices_select_own" on syncthing_devices;
create policy "devices_select_own" on syncthing_devices
  for select using (auth.uid() = user_id);

drop policy if exists "devices_insert_own" on syncthing_devices;
create policy "devices_insert_own" on syncthing_devices
  for insert with check (auth.uid() = user_id);

drop policy if exists "devices_update_own" on syncthing_devices;
create policy "devices_update_own" on syncthing_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "devices_delete_own" on syncthing_devices;
create policy "devices_delete_own" on syncthing_devices
  for delete using (auth.uid() = user_id);

-- Folders --------------------------------------------------------------------

create table if not exists syncthing_folders (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid,
  owner_user_id   uuid not null references auth.users(id) on delete cascade,
  folder_id       text not null,
  folder_label    text not null default '',
  path_hint       text not null default '',
  project_id      uuid,
  size_gb         numeric not null default 0,
  file_count      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_syncthing_folders_org_project
  on syncthing_folders(org_id, project_id);
create index if not exists idx_syncthing_folders_owner
  on syncthing_folders(owner_user_id);

alter table syncthing_folders enable row level security;

drop policy if exists "folders_owner_select" on syncthing_folders;
create policy "folders_owner_select" on syncthing_folders
  for select using (auth.uid() = owner_user_id);

drop policy if exists "folders_owner_insert" on syncthing_folders;
create policy "folders_owner_insert" on syncthing_folders
  for insert with check (auth.uid() = owner_user_id);

drop policy if exists "folders_owner_update" on syncthing_folders;
create policy "folders_owner_update" on syncthing_folders
  for update using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "folders_owner_delete" on syncthing_folders;
create policy "folders_owner_delete" on syncthing_folders
  for delete using (auth.uid() = owner_user_id);

drop policy if exists "folders_member_select" on syncthing_folders;
create policy "folders_member_select" on syncthing_folders
  for select using (
    exists (
      select 1 from syncthing_folder_members m
      where m.folder_id = syncthing_folders.id
        and m.user_id = auth.uid()
    )
  );

-- Folder members -------------------------------------------------------------

create table if not exists syncthing_folder_members (
  folder_id   uuid not null references syncthing_folders(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  permission  text not null default 'send-receive'
                check (permission in ('send-only','receive-only','send-receive')),
  added_at    timestamptz not null default now(),
  primary key (folder_id, user_id)
);

create index if not exists idx_syncthing_folder_members_user
  on syncthing_folder_members(user_id);

alter table syncthing_folder_members enable row level security;

drop policy if exists "members_select_self_or_owner" on syncthing_folder_members;
create policy "members_select_self_or_owner" on syncthing_folder_members
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from syncthing_folders f
      where f.id = syncthing_folder_members.folder_id
        and f.owner_user_id = auth.uid()
    )
  );

drop policy if exists "members_insert_owner" on syncthing_folder_members;
create policy "members_insert_owner" on syncthing_folder_members
  for insert with check (
    exists (
      select 1 from syncthing_folders f
      where f.id = syncthing_folder_members.folder_id
        and f.owner_user_id = auth.uid()
    )
  );

drop policy if exists "members_update_owner" on syncthing_folder_members;
create policy "members_update_owner" on syncthing_folder_members
  for update using (
    exists (
      select 1 from syncthing_folders f
      where f.id = syncthing_folder_members.folder_id
        and f.owner_user_id = auth.uid()
    )
  );

drop policy if exists "members_delete_owner" on syncthing_folder_members;
create policy "members_delete_owner" on syncthing_folder_members
  for delete using (
    exists (
      select 1 from syncthing_folders f
      where f.id = syncthing_folder_members.folder_id
        and f.owner_user_id = auth.uid()
    )
  );

create or replace function update_syncthing_folders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_syncthing_folders_updated_at on syncthing_folders;
create trigger trg_syncthing_folders_updated_at
  before update on syncthing_folders
  for each row execute function update_syncthing_folders_updated_at();
