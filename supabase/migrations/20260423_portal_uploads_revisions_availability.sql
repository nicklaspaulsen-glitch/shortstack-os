-- Portal backend tables: uploads, revisions, calendar availability
-- Applied to prod via Supabase MCP on 2026-04-23.

-- 1. portal_uploads: files clients upload in the portal
create table if not exists portal_uploads (
  id uuid primary key default gen_random_uuid(),
  portal_user_id uuid not null,
  client_id uuid references clients(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size_bytes bigint,
  content_type text,
  uploaded_at timestamptz default now()
);
create index if not exists idx_portal_uploads_client on portal_uploads(client_id);
create index if not exists idx_portal_uploads_user on portal_uploads(portal_user_id);
alter table portal_uploads enable row level security;

drop policy if exists "portal_uploads_own" on portal_uploads;
create policy "portal_uploads_own" on portal_uploads
  for all using (portal_user_id = auth.uid())
  with check (portal_user_id = auth.uid());

drop policy if exists "portal_uploads_agency_owner" on portal_uploads;
create policy "portal_uploads_agency_owner" on portal_uploads
  for all using (
    exists (
      select 1 from clients c
      where c.id = portal_uploads.client_id
      and c.profile_id = auth.uid()
    )
  );

-- 2. portal_revisions: revision requests from clients
create table if not exists portal_revisions (
  id uuid primary key default gen_random_uuid(),
  portal_user_id uuid not null,
  client_id uuid references clients(id) on delete cascade,
  content_item_id uuid,
  revision_notes text not null,
  priority text default 'normal',
  status text default 'open',
  requested_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_portal_revisions_client on portal_revisions(client_id);
create index if not exists idx_portal_revisions_status on portal_revisions(status);
alter table portal_revisions enable row level security;

drop policy if exists "portal_revisions_own" on portal_revisions;
create policy "portal_revisions_own" on portal_revisions
  for all using (portal_user_id = auth.uid())
  with check (portal_user_id = auth.uid());

drop policy if exists "portal_revisions_agency_owner" on portal_revisions;
create policy "portal_revisions_agency_owner" on portal_revisions
  for all using (
    exists (
      select 1 from clients c
      where c.id = portal_revisions.client_id
      and c.profile_id = auth.uid()
    )
  );

-- 3. calendar_availability: agency team's weekly working hours for book-a-call
create table if not exists calendar_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text default 'America/Los_Angeles',
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_calendar_availability_user on calendar_availability(user_id);
alter table calendar_availability enable row level security;

drop policy if exists "own_cavail_all" on calendar_availability;
create policy "own_cavail_all" on calendar_availability
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "public_cavail_read" on calendar_availability;
-- allow authenticated users (portal clients) to read availability of agency team members
create policy "public_cavail_read" on calendar_availability
  for select using (auth.uid() is not null);

-- 4. portal-files Supabase Storage bucket (private, 100MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal-files',
  'portal-files',
  false,
  104857600, -- 100MB
  null  -- any mime type
)
on conflict (id) do nothing;

drop policy if exists "portal_files_upload_own" on storage.objects;
create policy "portal_files_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'portal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "portal_files_read_own" on storage.objects;
create policy "portal_files_read_own"
  on storage.objects for select
  using (
    bucket_id = 'portal-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      -- allow agency owners to read files belonging to their clients
      or exists (
        select 1 from clients c
        join profiles p on p.id = c.profile_id
        where p.id = auth.uid()
        and (storage.foldername(name))[2] = c.id::text
      )
    )
  );

drop policy if exists "portal_files_delete_own" on storage.objects;
create policy "portal_files_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'portal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
