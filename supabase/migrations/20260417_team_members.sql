-- Agency Team Members — sub-accounts created by an agency owner
-- Team members can manage the agency's clients but cannot create their own agency accounts or manage billing

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  agency_owner_id uuid not null references profiles(id) on delete cascade,
  member_profile_id uuid references profiles(id) on delete cascade,
  email text not null,
  full_name text,
  role text default 'member' check (role in ('member','manager','viewer','admin')),
  -- Granular permissions (all default to false except basic views)
  can_manage_clients boolean default true,
  can_manage_outreach boolean default true,
  can_manage_content boolean default true,
  can_manage_ads boolean default false,
  can_manage_billing boolean default false,
  can_manage_team boolean default false,
  can_view_financials boolean default false,
  -- Scope restrictions — which clients they can access
  client_access_mode text default 'all' check (client_access_mode in ('all','specific','none')),
  allowed_client_ids uuid[] default array[]::uuid[],
  -- Meta
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  last_active_at timestamptz,
  status text default 'active' check (status in ('invited','active','suspended','removed')),
  avatar_url text,
  job_title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_team_agency on team_members(agency_owner_id);
create index if not exists idx_team_member_profile on team_members(member_profile_id);
create index if not exists idx_team_status on team_members(status);
create unique index if not exists idx_team_unique_email_per_agency on team_members(agency_owner_id, email);

-- Profiles table: add fields for team member identification
alter table profiles add column if not exists parent_agency_id uuid references profiles(id) on delete set null;
alter table profiles add column if not exists is_team_member boolean default false;

alter table team_members enable row level security;

-- Agency owners can see + manage their own team
drop policy if exists "Agency owners manage their team" on team_members;
create policy "Agency owners manage their team" on team_members
  for all using (auth.uid() = agency_owner_id);

-- Team members can see their own record
drop policy if exists "Members can view own row" on team_members;
create policy "Members can view own row" on team_members
  for select using (auth.uid() = member_profile_id);

-- Auto-update updated_at
create or replace function update_team_members_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_team_members_updated_at on team_members;
create trigger trg_team_members_updated_at
  before update on team_members
  for each row execute function update_team_members_updated_at();
