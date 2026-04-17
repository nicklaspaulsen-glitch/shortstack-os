-- Client cancellations and account deletion requests
create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  requested_at timestamptz default now(),
  scheduled_for timestamptz default (now() + interval '30 days'),
  reason text,
  status text default 'pending' check (status in ('pending','processing','completed','cancelled')),
  processed_at timestamptz,
  processed_by text,
  created_at timestamptz default now()
);
create index if not exists idx_deletion_scheduled on account_deletion_requests(scheduled_for) where status = 'pending';
create index if not exists idx_deletion_profile on account_deletion_requests(profile_id);

-- Add cancellation columns to clients if not exist
alter table clients add column if not exists cancelled_at timestamptz;
alter table clients add column if not exists cancellation_reason text;
alter table clients add column if not exists scheduled_deletion_at timestamptz;

alter table account_deletion_requests enable row level security;
drop policy if exists "Users view own deletion requests" on account_deletion_requests;
create policy "Users view own deletion requests" on account_deletion_requests
  for select using (auth.uid() = profile_id);
drop policy if exists "Users insert own deletion requests" on account_deletion_requests;
create policy "Users insert own deletion requests" on account_deletion_requests
  for insert with check (auth.uid() = profile_id);
