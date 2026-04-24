-- Client file drops: portal uploads + Google Drive / Dropbox / OneDrive sync
--
-- Two surfaces — clients drop files via the portal (multipart upload) OR grant
-- us OAuth access to their cloud drive and we ingest the files.
--
-- Everything lands in `client_files`. OAuth tokens live in `client_oauth_tokens`
-- and are encrypted at rest with AES-256-GCM (see src/lib/crypto/token-cipher.ts).
-- Org-level storage quotas live in `org_file_quotas`.
--
-- Nothing here is applied to prod by this migration — the parent agent is
-- applying it out-of-band via Supabase MCP.

-- ─────────────────────────────────────────────────────────────────────
-- 1. client_files — unified drop-box across every source (portal, GDrive,
--    Dropbox, OneDrive, Zapier webhook).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  source text not null check (source in ('portal_upload','gdrive','dropbox','onedrive','webhook')),
  external_id text,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  storage_url text,
  project_id uuid references projects(id) on delete set null,
  status text not null default 'ready' check (status in ('pending','processing','ready','failed')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_client_files_client_created
  on client_files (client_id, created_at desc);
create index if not exists idx_client_files_project
  on client_files (project_id)
  where project_id is not null;
create index if not exists idx_client_files_source
  on client_files (client_id, source);
create unique index if not exists uq_client_files_source_external
  on client_files (client_id, source, external_id)
  where external_id is not null;

alter table client_files enable row level security;

-- Client who owns the row (via clients.profile_id) can SELECT + INSERT their own.
drop policy if exists "client_files_client_select" on client_files;
create policy "client_files_client_select" on client_files
  for select using (
    exists (
      select 1 from clients c
      where c.id = client_files.client_id
      and c.profile_id = auth.uid()
    )
  );

drop policy if exists "client_files_client_insert" on client_files;
create policy "client_files_client_insert" on client_files
  for insert with check (
    exists (
      select 1 from clients c
      where c.id = client_files.client_id
      and c.profile_id = auth.uid()
    )
  );

-- Agency owner (clients.profile_id) can SELECT all files for their clients.
-- team_members scoped to the parent agency also get read access.
drop policy if exists "client_files_org_select" on client_files;
create policy "client_files_org_select" on client_files
  for select using (
    exists (
      select 1
      from clients c
      join profiles p on p.id = auth.uid()
      where c.id = client_files.client_id
      and (
        c.profile_id = auth.uid()
        or c.profile_id = p.parent_agency_id
      )
    )
  );

-- Agency owner can update / delete rows for their clients (used by the Manage tab).
drop policy if exists "client_files_org_write" on client_files;
create policy "client_files_org_write" on client_files
  for all using (
    exists (
      select 1 from clients c
      where c.id = client_files.client_id
      and c.profile_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2. client_oauth_tokens — encrypted OAuth tokens for cloud-drive sync.
--    `access_token` / `refresh_token` columns hold AES-256-GCM ciphertext
--    produced by src/lib/crypto/token-cipher.ts (format: iv.tag.ciphertext,
--    base64url).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists client_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  provider text not null check (provider in ('gdrive','dropbox','onedrive')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists uq_client_oauth_tokens_client_provider_active
  on client_oauth_tokens (client_id, provider)
  where revoked_at is null;
create index if not exists idx_client_oauth_tokens_client
  on client_oauth_tokens (client_id);

alter table client_oauth_tokens enable row level security;

-- Client owners + agency owners of that client can manage tokens.
drop policy if exists "client_oauth_tokens_client_access" on client_oauth_tokens;
create policy "client_oauth_tokens_client_access" on client_oauth_tokens
  for all using (
    exists (
      select 1 from clients c
      where c.id = client_oauth_tokens.client_id
      and c.profile_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 3. org_file_quotas — bytes-used vs plan-tier bytes-limit per org (agency).
--    Seed defaults: starter 1 GiB, pro 10 GiB, enterprise 0 (= unlimited).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists org_file_quotas (
  org_id uuid primary key references profiles(id) on delete cascade,
  plan_tier text not null default 'starter' check (plan_tier in ('starter','pro','enterprise')),
  bytes_used bigint not null default 0,
  bytes_limit bigint not null default 1073741824,
  updated_at timestamptz not null default now()
);

alter table org_file_quotas enable row level security;

drop policy if exists "org_file_quotas_owner" on org_file_quotas;
create policy "org_file_quotas_owner" on org_file_quotas
  for all using (org_id = auth.uid())
  with check (org_id = auth.uid());

-- Backfill limits for any pre-existing rows (idempotent — only fires on initial
-- create since bytes_limit is default 1 GiB already).
update org_file_quotas
set bytes_limit = case
  when plan_tier = 'starter' then 1073741824       -- 1 GiB
  when plan_tier = 'pro' then 10737418240          -- 10 GiB
  when plan_tier = 'enterprise' then 0             -- unlimited sentinel
  else bytes_limit
end
where bytes_limit is null or bytes_limit = 0 and plan_tier <> 'enterprise';

-- ─────────────────────────────────────────────────────────────────────
-- 4. Storage bucket — `client-files` (private). Path convention:
--    {client_id}/{yyyy-mm}/{timestamp}-{safe-filename}
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- Clients can insert objects for their own client_id (first path segment).
drop policy if exists "client_files_storage_client_insert" on storage.objects;
create policy "client_files_storage_client_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'client-files'
    and exists (
      select 1 from clients c
      where c.profile_id = auth.uid()
      and c.id::text = (storage.foldername(name))[1]
    )
  );

-- Agency owners (and their team) can read every object for clients they own.
drop policy if exists "client_files_storage_org_read" on storage.objects;
create policy "client_files_storage_org_read"
  on storage.objects for select
  using (
    bucket_id = 'client-files'
    and exists (
      select 1
      from clients c
      left join profiles p on p.id = auth.uid()
      where c.id::text = (storage.foldername(name))[1]
      and (
        c.profile_id = auth.uid()
        or c.profile_id = p.parent_agency_id
      )
    )
  );

-- Clients can read their own objects.
drop policy if exists "client_files_storage_client_read" on storage.objects;
create policy "client_files_storage_client_read"
  on storage.objects for select
  using (
    bucket_id = 'client-files'
    and exists (
      select 1 from clients c
      where c.profile_id = auth.uid()
      and c.id::text = (storage.foldername(name))[1]
    )
  );

-- Agency owners can delete their clients' objects (e.g. via Manage tab).
drop policy if exists "client_files_storage_org_delete" on storage.objects;
create policy "client_files_storage_org_delete"
  on storage.objects for delete
  using (
    bucket_id = 'client-files'
    and exists (
      select 1 from clients c
      where c.id::text = (storage.foldername(name))[1]
      and c.profile_id = auth.uid()
    )
  );
