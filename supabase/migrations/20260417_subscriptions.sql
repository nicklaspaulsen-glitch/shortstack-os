-- Software Subscriptions — track recurring SaaS costs for the agency
create table if not exists software_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  tool_name text not null,
  category text,
  cost_monthly numeric(10,2) default 0,
  cost_annual numeric(10,2) default 0,
  billing_cycle text default 'monthly' check (billing_cycle in ('monthly','quarterly','annual','one_time')),
  next_charge_date date,
  used_by text default 'me' check (used_by in ('me','clients','both')),
  status text default 'active' check (status in ('active','trial','cancelled','paused')),
  logo_url text,
  website_url text,
  notes text,
  tags text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_subs_profile on software_subscriptions(profile_id);
create index if not exists idx_subs_status on software_subscriptions(status);
create index if not exists idx_subs_next_charge on software_subscriptions(next_charge_date);

alter table software_subscriptions enable row level security;
drop policy if exists "Users manage own subscriptions" on software_subscriptions;
create policy "Users manage own subscriptions" on software_subscriptions
  for all using (auth.uid() = profile_id);
