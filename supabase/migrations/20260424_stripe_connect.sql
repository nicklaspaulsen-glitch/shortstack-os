-- Migration: Stripe Connect Express for referral payouts
-- Date: 2026-04-24
--
-- Adds a SECOND Stripe Connect account link to profiles, SCOPED to the
-- platform paying out referral commissions. Keep in mind this is a DIFFERENT
-- concern from `agency_stripe_accounts` (which is the agency's own Stripe
-- for billing their clients). A user can have both:
--   • profiles.stripe_connect_account_id   → where the platform SENDS money
--   • agency_stripe_accounts.stripe_account_id → where the agency CHARGES money
--
-- We also backfill the referral_payouts table with the columns the monthly
-- cron expects to update. If `referral_payouts` doesn't exist yet (no prior
-- migration shipped), create it here so the cron has something to select
-- from immediately.

-- ─── profiles: stripe_connect_account_id ─────────────────────────────
alter table profiles
  add column if not exists stripe_connect_account_id text;

create index if not exists idx_profiles_stripe_connect_account_id
  on profiles(stripe_connect_account_id)
  where stripe_connect_account_id is not null;

-- ─── referral_payouts: create-or-extend ──────────────────────────────
create table if not exists referral_payouts (
  id                uuid        primary key default gen_random_uuid(),
  referrer_user_id  uuid        not null references profiles(id) on delete cascade,
  referee_user_id   uuid        references profiles(id) on delete set null,
  month_start       date        not null,                   -- first-of-month this payout covers
  amount_cents      integer     not null check (amount_cents >= 0),
  status            text        not null default 'pending',
  stripe_transfer_id text,
  paid_at           timestamptz,
  error_text        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- If the table already existed (from some earlier ad-hoc deploy) make sure
-- the tracking columns the cron writes to are present.
alter table referral_payouts
  add column if not exists stripe_transfer_id text,
  add column if not exists paid_at            timestamptz,
  add column if not exists error_text         text,
  add column if not exists status             text not null default 'pending';

create index if not exists idx_referral_payouts_referrer
  on referral_payouts(referrer_user_id);
create index if not exists idx_referral_payouts_status
  on referral_payouts(status);
create index if not exists idx_referral_payouts_month
  on referral_payouts(month_start);

-- Status check constraint. Drop + recreate so re-running the migration
-- with a different set of allowed values is a no-op edit.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'referral_payouts_status_check'
      and conrelid = 'public.referral_payouts'::regclass
  ) then
    alter table referral_payouts drop constraint referral_payouts_status_check;
  end if;
end $$;

alter table referral_payouts
  add constraint referral_payouts_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table referral_payouts enable row level security;

-- Users see their own payout rows (as referrer). Admins see everything.
drop policy if exists "referral_payouts_select_own" on referral_payouts;
create policy "referral_payouts_select_own"
  on referral_payouts for select
  using (
    referrer_user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Only admins can insert/update/delete via RLS. The monthly cron uses the
-- service role client (bypasses RLS) and manages everything server-side.
drop policy if exists "referral_payouts_admin_write" on referral_payouts;
create policy "referral_payouts_admin_write"
  on referral_payouts for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- updated_at trigger (reuses existing update_updated_at() if present;
-- otherwise create a minimal one).
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'update_updated_at'
  ) then
    create or replace function update_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;
  end if;
end $$;

drop trigger if exists trg_referral_payouts_updated on referral_payouts;
create trigger trg_referral_payouts_updated
  before update on referral_payouts
  for each row
  execute function update_updated_at();

-- ─── payout_runs: audit log of monthly cron invocations ─────────────
-- Used by the admin payouts tab to show "last 20 runs" with summary stats.
create table if not exists payout_runs (
  id              uuid        primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  triggered_by    text        not null default 'cron',   -- 'cron' | 'manual'
  payouts_total   integer     not null default 0,
  payouts_paid    integer     not null default 0,
  payouts_failed  integer     not null default 0,
  payouts_skipped integer     not null default 0,
  amount_cents    integer     not null default 0,
  error_text      text,
  notes           text
);

create index if not exists idx_payout_runs_started
  on payout_runs(started_at desc);

alter table payout_runs enable row level security;

drop policy if exists "payout_runs_admin_read" on payout_runs;
create policy "payout_runs_admin_read"
  on payout_runs for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
