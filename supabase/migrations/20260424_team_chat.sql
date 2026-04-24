-- Team Chat (Slack-style) — internal teams + hired freelancers
-- Tables: channels, channel_members, messages, message_reactions
--
-- The "org" in this codebase is the agency owner's profile id. Team members
-- (profiles.parent_agency_id) belong to an org. Freelancers can be invited
-- to specific channels via channel_members without any other org-wide access.
--
-- Channel types:
--   public   — anyone in the org can join/see
--   private  — invite-only, members list is authoritative
--   project  — auto-bound to a project (project_id), membership mirrors project
--   dm       — direct message between exactly two users (name: canonical DM key)

create extension if not exists "pgcrypto";

/* ─── channels ───────────────────────────────────────────────────── */
create table if not exists channels (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  name          text not null,
  description   text,
  channel_type  text not null check (channel_type in ('public','private','project','dm')),
  project_id    uuid,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  archived_at   timestamptz
);

create index if not exists idx_channels_org on channels(org_id);
create index if not exists idx_channels_project on channels(project_id) where project_id is not null;

-- Unique names per org for non-DM channels (DMs share a canonical key)
create unique index if not exists ux_channels_org_name
  on channels(org_id, name) where channel_type in ('public','private','project');

/* ─── channel_members ────────────────────────────────────────────── */
create table if not exists channel_members (
  channel_id    uuid not null references channels(id) on delete cascade,
  user_id       uuid not null,
  joined_at     timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  muted         boolean not null default false,
  primary key (channel_id, user_id)
);

create index if not exists idx_channel_members_user on channel_members(user_id);

/* ─── messages ───────────────────────────────────────────────────── */
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid not null references channels(id) on delete cascade,
  sender_id         uuid not null,
  content           text not null,
  thread_parent_id  uuid references messages(id) on delete cascade,
  mentions          uuid[] not null default '{}',
  attachments       jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);

create index if not exists idx_messages_channel_created on messages(channel_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id);
create index if not exists idx_messages_thread_parent on messages(thread_parent_id) where thread_parent_id is not null;

/* ─── message_reactions ──────────────────────────────────────────── */
create table if not exists message_reactions (
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message on message_reactions(message_id);

/* ─── RLS ────────────────────────────────────────────────────────── */
alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;
alter table message_reactions enable row level security;

-- Channels: members can see their channels; anyone in org can see public channels
drop policy if exists "channels_member_select" on channels;
create policy "channels_member_select" on channels
  for select
  using (
    exists (
      select 1 from channel_members cm
      where cm.channel_id = channels.id and cm.user_id = auth.uid()
    )
    or (channel_type = 'public' and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.id = channels.org_id or p.parent_agency_id = channels.org_id)
    ))
  );

-- Anyone in the org (or the org owner) can create channels
drop policy if exists "channels_insert_org_member" on channels;
create policy "channels_insert_org_member" on channels
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.id = channels.org_id or p.parent_agency_id = channels.org_id)
    )
  );

-- Creator or org owner can update/archive channels
drop policy if exists "channels_update_owner" on channels;
create policy "channels_update_owner" on channels
  for update
  using (
    created_by = auth.uid()
    or channels.org_id = auth.uid()
  );

-- channel_members: users see their own memberships; members can see co-members
drop policy if exists "channel_members_select" on channel_members;
create policy "channel_members_select" on channel_members
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from channel_members self
      where self.channel_id = channel_members.channel_id and self.user_id = auth.uid()
    )
  );

-- Join self to a public channel, or inserted by channel creator / org owner
drop policy if exists "channel_members_insert" on channel_members;
create policy "channel_members_insert" on channel_members
  for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from channels c
      where c.id = channel_members.channel_id
        and (c.created_by = auth.uid() or c.org_id = auth.uid())
    )
  );

-- Members can update their own membership row (last_read_at, muted)
drop policy if exists "channel_members_update_self" on channel_members;
create policy "channel_members_update_self" on channel_members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Leave self; or channel owner / org owner kicks
drop policy if exists "channel_members_delete" on channel_members;
create policy "channel_members_delete" on channel_members
  for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from channels c
      where c.id = channel_members.channel_id
        and (c.created_by = auth.uid() or c.org_id = auth.uid())
    )
  );

-- messages: channel members can SELECT; senders can UPDATE/DELETE own within 5 min
drop policy if exists "messages_member_select" on messages;
create policy "messages_member_select" on messages
  for select
  using (
    exists (
      select 1 from channel_members cm
      where cm.channel_id = messages.channel_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "messages_member_insert" on messages;
create policy "messages_member_insert" on messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from channel_members cm
      where cm.channel_id = messages.channel_id and cm.user_id = auth.uid()
    )
  );

-- Senders can update their own message within 5 minutes of creation
drop policy if exists "messages_sender_update_5min" on messages;
create policy "messages_sender_update_5min" on messages
  for update
  using (
    sender_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  )
  with check (
    sender_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

-- Senders can delete their own message within 5 minutes of creation
drop policy if exists "messages_sender_delete_5min" on messages;
create policy "messages_sender_delete_5min" on messages
  for delete
  using (
    sender_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

-- message_reactions: channel members can SELECT; users toggle their own rows
drop policy if exists "message_reactions_member_select" on message_reactions;
create policy "message_reactions_member_select" on message_reactions
  for select
  using (
    exists (
      select 1 from messages m
      join channel_members cm on cm.channel_id = m.channel_id
      where m.id = message_reactions.message_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "message_reactions_insert_self" on message_reactions;
create policy "message_reactions_insert_self" on message_reactions
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from messages m
      join channel_members cm on cm.channel_id = m.channel_id
      where m.id = message_reactions.message_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "message_reactions_delete_self" on message_reactions;
create policy "message_reactions_delete_self" on message_reactions
  for delete
  using (user_id = auth.uid());

/* ─── Realtime publication ───────────────────────────────────────── */
-- Enable realtime for messages and message_reactions so the UI can subscribe
-- per-channel. (channels and channel_members are managed via API fetches.)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table messages';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table message_reactions';
    exception when duplicate_object then null;
    end;
  end if;
end $$;
