-- Sidebar unread tracking
-- Stores per-user "last visited" timestamp per nav path so we can compute
-- a small red-dot unread indicator for each sidebar item, similar to Discord DMs.
--
-- The actual unread *count* is computed on demand by /api/user/sidebar-unread
-- by joining against the relevant feature tables (notifications, leads,
-- outreach_log, content_calendar, content_scripts, trinity_log, etc.) using
-- last_visited_at as the cut-off. We persist last_activity_at as a denormalized
-- cache that some surfaces can update on push (optional).

create table if not exists sidebar_unread_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  nav_path text not null,
  last_visited_at timestamptz default now(),
  last_activity_at timestamptz,
  unread_count int default 0,
  created_at timestamptz default now(),
  unique(user_id, nav_path)
);

create index if not exists idx_sidebar_unread_user on sidebar_unread_tracking(user_id);

alter table sidebar_unread_tracking enable row level security;

-- Single combined RLS policy for all operations (drop first if re-running).
drop policy if exists "Users manage own unread" on sidebar_unread_tracking;
create policy "Users manage own unread" on sidebar_unread_tracking
  for all using (auth.uid() = user_id);
