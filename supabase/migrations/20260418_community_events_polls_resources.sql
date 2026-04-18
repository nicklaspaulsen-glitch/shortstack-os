-- Community Events, Polls, and Resources
-- Backs the Events / Polls / Resources tabs on /dashboard/community.

-- ============================================================
-- Events
-- ============================================================
create table if not exists community_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  date_time timestamptz not null,
  location text,
  attendees_count int default 0,
  max_attendees int,
  category text default 'general',
  cover_url text,
  status text default 'upcoming' check (status in ('upcoming', 'live', 'ended')),
  created_at timestamptz default now()
);
create index if not exists idx_community_events_date on community_events(date_time asc);
create index if not exists idx_community_events_user on community_events(user_id);
create index if not exists idx_community_events_status on community_events(status);

create table if not exists community_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references community_events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rsvp_status text not null default 'going' check (rsvp_status in ('going', 'maybe', 'not_going')),
  created_at timestamptz default now(),
  unique(event_id, user_id)
);
create index if not exists idx_event_rsvps_event on community_event_rsvps(event_id);
create index if not exists idx_event_rsvps_user on community_event_rsvps(user_id);

-- ============================================================
-- Polls
-- ============================================================
create table if not exists community_polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  ends_at timestamptz,
  total_votes int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_community_polls_created on community_polls(created_at desc);
create index if not exists idx_community_polls_ends on community_polls(ends_at);
create index if not exists idx_community_polls_user on community_polls(user_id);

create table if not exists community_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references community_polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  option_index int not null,
  created_at timestamptz default now(),
  unique(poll_id, user_id)
);
create index if not exists idx_poll_votes_poll on community_poll_votes(poll_id);
create index if not exists idx_poll_votes_user on community_poll_votes(user_id);

-- ============================================================
-- Resources
-- ============================================================
create table if not exists community_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  title text not null,
  url text not null,
  type text default 'link' check (type in ('pdf', 'video', 'template', 'link')),
  description text,
  downloads int default 0,
  pinned boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_community_resources_pinned on community_resources(pinned desc, created_at desc);
create index if not exists idx_community_resources_user on community_resources(user_id);

-- ============================================================
-- RLS — anyone authenticated can read; only creators can update/delete
-- ============================================================
alter table community_events enable row level security;
alter table community_event_rsvps enable row level security;
alter table community_polls enable row level security;
alter table community_poll_votes enable row level security;
alter table community_resources enable row level security;

-- Events policies
drop policy if exists "Anyone authed can read events" on community_events;
create policy "Anyone authed can read events" on community_events
  for select using (auth.uid() is not null);
drop policy if exists "Auth users can insert events" on community_events;
create policy "Auth users can insert events" on community_events
  for insert with check (auth.uid() = user_id);
drop policy if exists "Creator can update own events" on community_events;
create policy "Creator can update own events" on community_events
  for update using (auth.uid() = user_id);
drop policy if exists "Creator can delete own events" on community_events;
create policy "Creator can delete own events" on community_events
  for delete using (auth.uid() = user_id);

-- Event RSVPs policies — visible to everyone authed (so attendee counts can be read), users only manage their own row
drop policy if exists "Anyone authed can read rsvps" on community_event_rsvps;
create policy "Anyone authed can read rsvps" on community_event_rsvps
  for select using (auth.uid() is not null);
drop policy if exists "Users manage own rsvps" on community_event_rsvps;
create policy "Users manage own rsvps" on community_event_rsvps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Polls policies
drop policy if exists "Anyone authed can read polls" on community_polls;
create policy "Anyone authed can read polls" on community_polls
  for select using (auth.uid() is not null);
drop policy if exists "Auth users can insert polls" on community_polls;
create policy "Auth users can insert polls" on community_polls
  for insert with check (auth.uid() = user_id);
drop policy if exists "Creator can update own polls" on community_polls;
create policy "Creator can update own polls" on community_polls
  for update using (auth.uid() = user_id);
drop policy if exists "Creator can delete own polls" on community_polls;
create policy "Creator can delete own polls" on community_polls
  for delete using (auth.uid() = user_id);

-- Poll votes — visible to everyone authed (for tallies), users only manage their own
drop policy if exists "Anyone authed can read votes" on community_poll_votes;
create policy "Anyone authed can read votes" on community_poll_votes
  for select using (auth.uid() is not null);
drop policy if exists "Users manage own poll votes" on community_poll_votes;
create policy "Users manage own poll votes" on community_poll_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Resources policies
drop policy if exists "Anyone authed can read resources" on community_resources;
create policy "Anyone authed can read resources" on community_resources
  for select using (auth.uid() is not null);
drop policy if exists "Auth users can insert resources" on community_resources;
create policy "Auth users can insert resources" on community_resources
  for insert with check (auth.uid() = user_id);
drop policy if exists "Creator can update own resources" on community_resources;
create policy "Creator can update own resources" on community_resources
  for update using (auth.uid() = user_id);
drop policy if exists "Creator can delete own resources" on community_resources;
create policy "Creator can delete own resources" on community_resources
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Helpers
-- ============================================================
-- Atomic downloads-counter bump. SECURITY DEFINER so any authed user can
-- record a download without UPDATE rights on the row (only the creator
-- has UPDATE under the RLS policies above).
create or replace function increment_resource_downloads(p_resource_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  update community_resources
    set downloads = coalesce(downloads, 0) + 1
    where id = p_resource_id
    returning downloads into v_new;
  return coalesce(v_new, 0);
end;
$$;

grant execute on function increment_resource_downloads(uuid) to authenticated;
