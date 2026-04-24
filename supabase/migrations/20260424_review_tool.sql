-- Creative Review Tool (Frame.io-style)
-- Tables: review_sessions, review_versions, review_comments.
--
-- Agency members create review sessions for video/image/pdf/audio deliverables
-- and share a magic link with their client. Anonymous clients leave timestamped
-- or region-pinned comments, and can approve / request revisions. Agency
-- uploads new versions; each version carries its own comment thread.
--
-- RLS strategy: authenticated agency (owner/team_member) gets full access via
-- user_id match. Anonymous clients with a valid magic_link_token bypass RLS via
-- server-side routes that use the service-role client + token verification.
-- Policies on auth.uid() protect direct PostgREST access; anon paths are only
-- hit server-side.

-- ============================================================
-- review_sessions
-- ============================================================
create table if not exists review_sessions (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid,
  title                text not null,
  asset_url            text not null,
  asset_type           text not null check (asset_type in ('video','image','pdf','audio')),
  version              int  not null default 1,
  status               text not null default 'pending'
                         check (status in ('pending','in_review','approved','revisions_requested','archived')),
  -- 32-byte URL-safe random token (base64url without padding = 43 chars)
  magic_link_token     text not null unique default replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''),
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  approved_at          timestamptz,
  approved_by_name     text
);

create index if not exists idx_review_sessions_created_by on review_sessions(created_by, created_at desc);
create index if not exists idx_review_sessions_project    on review_sessions(project_id);
create index if not exists idx_review_sessions_status     on review_sessions(status);
create index if not exists idx_review_sessions_token      on review_sessions(magic_link_token);

alter table review_sessions enable row level security;

drop policy if exists "Owner manages own review sessions" on review_sessions;
create policy "Owner manages own review sessions" on review_sessions
  for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Auto-update updated_at
create or replace function update_review_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_review_sessions_updated_at on review_sessions;
create trigger trg_review_sessions_updated_at
  before update on review_sessions
  for each row execute function update_review_sessions_updated_at();

-- ============================================================
-- review_versions
-- ============================================================
create table if not exists review_versions (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references review_sessions(id) on delete cascade,
  version        int  not null,
  asset_url      text not null,
  uploaded_at    timestamptz not null default now(),
  uploaded_by    uuid references auth.users(id) on delete set null,
  release_notes  text,
  unique(session_id, version)
);

create index if not exists idx_review_versions_session on review_versions(session_id, version desc);

alter table review_versions enable row level security;

drop policy if exists "Owner manages own review versions" on review_versions;
create policy "Owner manages own review versions" on review_versions
  for all
  using (
    exists (
      select 1 from review_sessions s
      where s.id = review_versions.session_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from review_sessions s
      where s.id = review_versions.session_id
        and s.created_by = auth.uid()
    )
  );

-- ============================================================
-- review_comments
-- ============================================================
create table if not exists review_comments (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references review_sessions(id) on delete cascade,
  version           int  not null,
  -- null author_id = anonymous client comment (identified by name/email)
  author_id         uuid references auth.users(id) on delete set null,
  author_name       text not null,
  author_email      text,
  content           text not null,
  -- Video/audio: seconds into asset where comment is pinned
  timestamp_seconds numeric,
  -- Image: {x,y,w,h} as percentages (0..100) of container
  region            jsonb,
  -- PDF: page number comment is attached to
  page_number       int,
  thread_parent_id  uuid references review_comments(id) on delete cascade,
  resolved          boolean not null default false,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references auth.users(id) on delete set null
);

create index if not exists idx_review_comments_session_version on review_comments(session_id, version);
create index if not exists idx_review_comments_session_resolved on review_comments(session_id, resolved);
create index if not exists idx_review_comments_thread on review_comments(thread_parent_id);

alter table review_comments enable row level security;

-- Session owner has full access to all comments (including anonymous-author rows)
drop policy if exists "Owner manages comments on own sessions" on review_comments;
create policy "Owner manages comments on own sessions" on review_comments
  for all
  using (
    exists (
      select 1 from review_sessions s
      where s.id = review_comments.session_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from review_sessions s
      where s.id = review_comments.session_id
        and s.created_by = auth.uid()
    )
  );

-- Anonymous client access is handled server-side via magic-link-token routes
-- using the service-role client. No RLS policy is exposed to anon/authenticated
-- that would let them read/write arbitrary rows by token — routes verify the
-- token on every call and scope the service-role query to that session_id.

-- ============================================================
-- review-assets Storage bucket (public read for magic-link access)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('review-assets', 'review-assets', true)
on conflict (id) do nothing;

-- Authenticated uploads only; anonymous clients never write.
drop policy if exists "review_assets_upload_authed" on storage.objects;
create policy "review_assets_upload_authed"
  on storage.objects for insert
  with check (
    bucket_id = 'review-assets'
    and auth.uid() is not null
  );

drop policy if exists "review_assets_public_read" on storage.objects;
create policy "review_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'review-assets');

drop policy if exists "review_assets_delete_owner" on storage.objects;
create policy "review_assets_delete_owner"
  on storage.objects for delete
  using (
    bucket_id = 'review-assets'
    and auth.uid() is not null
    and owner = auth.uid()
  );
