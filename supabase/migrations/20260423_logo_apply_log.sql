-- Logo apply history
-- Tracks every time an admin applies one of the 20 brand concepts. Lets us show
-- a "Revert to concept #N" button, and gives an audit trail of brand changes.
-- Admin-only write surface; read is admin/founder only too.

create table if not exists logo_apply_log (
  id                uuid primary key default gen_random_uuid(),
  applied_concept   int  not null check (applied_concept between 1 and 20),
  applied_by_user_id uuid references profiles(id) on delete set null,
  applied_at        timestamptz not null default now()
);

create index if not exists idx_logo_apply_log_applied_at
  on logo_apply_log(applied_at desc);

alter table logo_apply_log enable row level security;

-- Only admins/founders can read the apply history.
drop policy if exists "logo_apply_log_admin_read" on logo_apply_log;
create policy "logo_apply_log_admin_read" on logo_apply_log
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'founder')
    )
  );

-- Only admins/founders can write apply history (inserted server-side via the
-- admin API route, but keep RLS tight anyway).
drop policy if exists "logo_apply_log_admin_insert" on logo_apply_log;
create policy "logo_apply_log_admin_insert" on logo_apply_log
  for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'founder')
    )
  );
