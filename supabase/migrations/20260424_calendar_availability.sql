-- Calendar round-robin + team availability
-- Adds: calendar_rules (weekly working hours per team member),
--       calendar_slots_blocked (manual blocks + gcal sync),
--       booking_teams + booking_team_members (round-robin / fair / first_available),
--       booking team routing columns on calendar_events.
--
-- RLS: agency owner (profiles.id / profiles.parent_agency_id) can manage all.
-- Team members can read the rules/blocks/teams they participate in.

-- ============================================================
-- 1. calendar_rules — per-user weekly availability rules
-- ============================================================
create table if not exists calendar_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Los_Angeles',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_calendar_rules_user on calendar_rules(user_id);
create index if not exists idx_calendar_rules_user_day on calendar_rules(user_id, day_of_week);

alter table calendar_rules enable row level security;

drop policy if exists "calendar_rules_owner_all" on calendar_rules;
create policy "calendar_rules_owner_all" on calendar_rules
  for all using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = calendar_rules.user_id
      and p.parent_agency_id = auth.uid()
    )
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.parent_agency_id = calendar_rules.user_id
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = calendar_rules.user_id
      and p.parent_agency_id = auth.uid()
    )
  );

-- Portal clients may read availability so the book-a-call page renders
drop policy if exists "calendar_rules_public_read" on calendar_rules;
create policy "calendar_rules_public_read" on calendar_rules
  for select using (auth.uid() is not null);

-- ============================================================
-- 2. calendar_slots_blocked — manual blocks + gcal sync
-- ============================================================
create table if not exists calendar_slots_blocked (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text default 'manual block',
  source text default 'manual' check (source in ('manual','gcal_sync','outlook_sync','system')),
  external_event_id text,
  created_at timestamptz default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_calendar_blocks_user on calendar_slots_blocked(user_id);
create index if not exists idx_calendar_blocks_range on calendar_slots_blocked(user_id, starts_at, ends_at);

alter table calendar_slots_blocked enable row level security;

drop policy if exists "calendar_blocks_owner_all" on calendar_slots_blocked;
create policy "calendar_blocks_owner_all" on calendar_slots_blocked
  for all using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = calendar_slots_blocked.user_id
      and p.parent_agency_id = auth.uid()
    )
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.parent_agency_id = calendar_slots_blocked.user_id
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = calendar_slots_blocked.user_id
      and p.parent_agency_id = auth.uid()
    )
  );

-- ============================================================
-- 3. booking_teams — agency-owned round-robin pools
-- ============================================================
create table if not exists booking_teams (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  slug text,
  distribution_mode text not null default 'round_robin'
    check (distribution_mode in ('round_robin','fair','first_available')),
  last_assigned_user_id uuid references profiles(id) on delete set null,
  default_duration_minutes int default 30,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_booking_teams_owner on booking_teams(owner_user_id);
create unique index if not exists idx_booking_teams_slug_per_owner on booking_teams(owner_user_id, slug)
  where slug is not null;

alter table booking_teams enable row level security;

drop policy if exists "booking_teams_owner_all" on booking_teams;
create policy "booking_teams_owner_all" on booking_teams
  for all using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.parent_agency_id = booking_teams.owner_user_id
    )
  )
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.parent_agency_id = booking_teams.owner_user_id
    )
  );

drop policy if exists "booking_teams_public_read" on booking_teams;
create policy "booking_teams_public_read" on booking_teams
  for select using (auth.uid() is not null);

-- ============================================================
-- 4. booking_team_members — members of a round-robin pool
-- ============================================================
create table if not exists booking_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references booking_teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  priority int not null default 0,
  assignments_count int not null default 0,
  last_assigned_at timestamptz,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_booking_team_members_team on booking_team_members(team_id);
create index if not exists idx_booking_team_members_user on booking_team_members(user_id);
create unique index if not exists idx_booking_team_members_unique on booking_team_members(team_id, user_id);

alter table booking_team_members enable row level security;

drop policy if exists "booking_team_members_owner_all" on booking_team_members;
create policy "booking_team_members_owner_all" on booking_team_members
  for all using (
    exists (
      select 1 from booking_teams bt
      where bt.id = booking_team_members.team_id
      and (
        bt.owner_user_id = auth.uid()
        or exists (
          select 1 from profiles p
          where p.id = auth.uid()
          and p.parent_agency_id = bt.owner_user_id
        )
      )
    )
  )
  with check (
    exists (
      select 1 from booking_teams bt
      where bt.id = booking_team_members.team_id
      and (
        bt.owner_user_id = auth.uid()
        or exists (
          select 1 from profiles p
          where p.id = auth.uid()
          and p.parent_agency_id = bt.owner_user_id
        )
      )
    )
  );

drop policy if exists "booking_team_members_self_read" on booking_team_members;
create policy "booking_team_members_self_read" on booking_team_members
  for select using (user_id = auth.uid());

-- ============================================================
-- 5. calendar_events — add routing columns (non-breaking)
-- ============================================================
alter table calendar_events add column if not exists booking_team_id uuid references booking_teams(id) on delete set null;
alter table calendar_events add column if not exists assigned_user_id uuid references profiles(id) on delete set null;
alter table calendar_events add column if not exists booked_via text default 'manual';
alter table calendar_events add column if not exists booking_status text default 'confirmed'
  check (booking_status in ('confirmed','cancelled','rescheduled','no_show','completed'));
alter table calendar_events add column if not exists client_id uuid references clients(id) on delete set null;
alter table calendar_events add column if not exists client_contact_name text;
alter table calendar_events add column if not exists client_contact_email text;
create index if not exists idx_calendar_events_team on calendar_events(booking_team_id);
create index if not exists idx_calendar_events_assigned on calendar_events(assigned_user_id);

-- Ensure the assigned agent row can see events routed to them
drop policy if exists "calendar_events_assigned_read" on calendar_events;
create policy "calendar_events_assigned_read" on calendar_events
  for select using (assigned_user_id = auth.uid());

-- ============================================================
-- 6. Auto-update triggers
-- ============================================================
create or replace function update_calendar_rules_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calendar_rules_updated_at on calendar_rules;
create trigger trg_calendar_rules_updated_at
  before update on calendar_rules
  for each row execute function update_calendar_rules_updated_at();

create or replace function update_booking_teams_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_booking_teams_updated_at on booking_teams;
create trigger trg_booking_teams_updated_at
  before update on booking_teams
  for each row execute function update_booking_teams_updated_at();
