-- Sidebar preferences + user_type personalization
-- Supports multi-user-type onboarding (agency, creator, real-estate, coach, ecommerce, saas, service, other)
-- Users customize which sidebar items are visible, can define custom groups, and override ordering.

-- ── Profiles: user type and onboarding preferences ─────────────────────
alter table profiles add column if not exists user_type text default 'agency';
alter table profiles add column if not exists onboarding_preferences jsonb default '{}'::jsonb;

-- Useful index for filtering dashboards by user type
create index if not exists idx_profiles_user_type on profiles(user_type);

-- ── Sidebar preferences ───────────────────────────────────────────────
create table if not exists user_sidebar_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade unique,
  enabled_items text[] default array[]::text[],
  custom_groups jsonb default '[]'::jsonb,
  order_overrides jsonb default '{}'::jsonb,
  business_type text,
  updated_at timestamptz default now()
);

create index if not exists idx_sidebar_prefs_user on user_sidebar_preferences(user_id);

alter table user_sidebar_preferences enable row level security;

drop policy if exists "Users manage own sidebar prefs" on user_sidebar_preferences;
create policy "Users manage own sidebar prefs" on user_sidebar_preferences
  for all using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_sidebar_prefs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sidebar_prefs_updated_at on user_sidebar_preferences;
create trigger trg_sidebar_prefs_updated_at
  before update on user_sidebar_preferences
  for each row execute function update_sidebar_prefs_updated_at();
