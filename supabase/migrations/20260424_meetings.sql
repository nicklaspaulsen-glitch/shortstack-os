-- AI Meeting Recorder / Transcription tables.
--
-- Stores uploaded meeting audio + Whisper transcript + Claude-generated
-- structured summary, action items, decisions, and key moments. Audio files
-- live in the `meetings` Storage bucket; `audio_url` stores a signed/public
-- URL reference. Transcript analysis is populated async by the analyzer.
--
-- NOTE on org scoping: the wider codebase currently scopes per-user via
-- auth.uid() (agency owner). We keep `org_id` in the schema so a future
-- multi-tenant rewrite has a home for it, but fall back to `created_by`
-- when `current_org_id` isn't available on the profile. The RLS policy
-- therefore also permits `created_by = auth.uid()` so this works today.

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid, -- soft ref, may or may not exist depending on Sprint 1 merge
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  audio_url text,
  transcript_raw text,
  transcript_speaker_labeled jsonb, -- [{speaker, start, end, text}]
  summary text,
  action_items jsonb, -- [{id, assignee, text, due, done}]
  decisions jsonb,    -- [{text, context}]
  key_moments jsonb,  -- [{ts, label}]
  status text default 'scheduled' check (status in ('scheduled','recording','processing','ready','failed')),
  created_at timestamptz default now()
);

create index if not exists idx_meetings_created_by on meetings(created_by);
create index if not exists idx_meetings_client on meetings(client_id);
create index if not exists idx_meetings_status on meetings(status);
create index if not exists idx_meetings_created_at on meetings(created_at desc);

alter table meetings enable row level security;

-- Owner always wins; org match is additive for the future multi-tenant case.
drop policy if exists meetings_select on meetings;
create policy meetings_select on meetings for select
  using (
    created_by = auth.uid()
    or (org_id is not null and org_id = (
      select coalesce((raw_user_meta_data->>'current_org_id')::uuid, null)
      from auth.users where id = auth.uid()
    ))
  );

drop policy if exists meetings_insert on meetings;
create policy meetings_insert on meetings for insert
  with check (created_by = auth.uid());

drop policy if exists meetings_update on meetings;
create policy meetings_update on meetings for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists meetings_delete on meetings;
create policy meetings_delete on meetings for delete
  using (created_by = auth.uid());

-- Storage bucket for audio uploads. Bucket is private; access via signed URL.
insert into storage.buckets (id, name, public)
values ('meetings', 'meetings', false)
on conflict (id) do nothing;

-- Users can upload/read files in their own folder inside the bucket.
-- Path convention: `<auth.uid()>/<meeting_id>/<filename>`.
drop policy if exists "meetings_storage_owner_rw" on storage.objects;
create policy "meetings_storage_owner_rw" on storage.objects
  for all
  using (
    bucket_id = 'meetings'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'meetings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
