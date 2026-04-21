-- Native sequences (multi-touch outreach automations)
-- Replaces GHL-hosted sequences after the Apr 21 migration.
-- Applied via Supabase MCP under the same name (sequences_native).

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sequences_profile on sequences(profile_id);
create index if not exists idx_sequences_updated_at on sequences(updated_at desc);

create table if not exists sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_order int not null,
  delay_days int not null default 0,
  channel text not null check (channel in ('email','sms','call','dm','wait')),
  template_body text,
  template_subject text,
  created_at timestamptz not null default now(),
  constraint sequence_steps_order_unique unique (sequence_id, step_order)
);

create index if not exists idx_sequence_steps_sequence on sequence_steps(sequence_id, step_order);

create table if not exists sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  current_step int not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed','stopped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sequence_enrollments_unique unique (sequence_id, lead_id)
);

create index if not exists idx_sequence_enrollments_sequence on sequence_enrollments(sequence_id);
create index if not exists idx_sequence_enrollments_lead on sequence_enrollments(lead_id);
create index if not exists idx_sequence_enrollments_status on sequence_enrollments(status) where status = 'active';

-- Auto-update updated_at on sequences
create or replace function update_sequences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sequences_updated_at on sequences;
create trigger trg_sequences_updated_at
  before update on sequences
  for each row execute function update_sequences_updated_at();

-- RLS — owners see only their own rows; steps/enrollments inherit via sequence
alter table sequences enable row level security;
alter table sequence_steps enable row level security;
alter table sequence_enrollments enable row level security;

drop policy if exists "Users manage own sequences" on sequences;
create policy "Users manage own sequences" on sequences
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "Users manage own sequence_steps" on sequence_steps;
create policy "Users manage own sequence_steps" on sequence_steps
  for all using (
    exists (select 1 from sequences s where s.id = sequence_steps.sequence_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from sequences s where s.id = sequence_steps.sequence_id and s.profile_id = auth.uid())
  );

drop policy if exists "Users manage own sequence_enrollments" on sequence_enrollments;
create policy "Users manage own sequence_enrollments" on sequence_enrollments
  for all using (
    exists (select 1 from sequences s where s.id = sequence_enrollments.sequence_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from sequences s where s.id = sequence_enrollments.sequence_id and s.profile_id = auth.uid())
  );
