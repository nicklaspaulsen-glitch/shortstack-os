-- Migration: Telegram bot routines
-- Date: 2026-04-18
-- Gives users control over which scheduled bot messages run
-- (daily brief, lead finder done, retention check, invoice chase, etc.),
-- so they can pause/resume, edit templates, and create custom routines.

create table if not exists telegram_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  routine_type text not null,  -- daily_brief, lead_finder_done, outreach_report, retention_check, invoice_chase, custom
  schedule text not null,      -- cron format or "manual"
  enabled boolean default true,
  paused boolean default false,
  message_template text,        -- template with {{variables}}
  conditions jsonb default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count int default 0,
  success_count int default 0,
  fail_count int default 0,
  last_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tg_routines_user on telegram_routines(user_id);
create index if not exists idx_tg_routines_enabled on telegram_routines(enabled, paused);
create index if not exists idx_tg_routines_type on telegram_routines(routine_type);

alter table telegram_routines enable row level security;

drop policy if exists "Users manage own routines" on telegram_routines;
create policy "Users manage own routines" on telegram_routines
  for all using (auth.uid() = user_id);
