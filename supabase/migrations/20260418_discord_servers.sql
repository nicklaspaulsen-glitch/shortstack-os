-- Migration: Discord bot servers + MEE6-style features
-- Date: 2026-04-18
-- Connected Discord servers, per-server custom commands, reaction roles, and leveling.

create table if not exists discord_servers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  guild_id text unique not null,
  guild_name text,
  guild_icon text,
  member_count int default 0,
  bot_added_at timestamptz default now(),
  status text default 'active' check (status in ('active', 'paused', 'removed')),
  features_enabled jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_discord_servers_profile on discord_servers(profile_id);
alter table discord_servers enable row level security;
drop policy if exists "Users manage own servers" on discord_servers;
create policy "Users manage own servers" on discord_servers for all using (auth.uid() = profile_id);

create table if not exists discord_custom_commands (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  trigger text not null,
  response text not null,
  embed jsonb,
  roles_required text[],
  cooldown_seconds int default 0,
  uses_count int default 0,
  enabled boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_discord_commands_server on discord_custom_commands(server_id);
alter table discord_custom_commands enable row level security;
drop policy if exists "Users manage own commands" on discord_custom_commands;
create policy "Users manage own commands" on discord_custom_commands for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

create table if not exists discord_reaction_roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  channel_id text not null,
  message_id text not null,
  emoji text not null,
  role_id text not null,
  description text,
  created_at timestamptz default now()
);
create index if not exists idx_discord_rr_server on discord_reaction_roles(server_id);
alter table discord_reaction_roles enable row level security;
drop policy if exists "Users manage own reaction roles" on discord_reaction_roles;
create policy "Users manage own reaction roles" on discord_reaction_roles for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

create table if not exists discord_levels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  user_id text not null,
  username text,
  avatar_url text,
  xp int default 0,
  level int default 0,
  messages_count int default 0,
  last_message_at timestamptz,
  updated_at timestamptz default now(),
  unique(server_id, user_id)
);
create index if not exists idx_discord_levels_server_xp on discord_levels(server_id, xp desc);
alter table discord_levels enable row level security;
drop policy if exists "Users view own server levels" on discord_levels;
create policy "Users view own server levels" on discord_levels for select using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Welcome message config (one-to-one w/ server)
create table if not exists discord_welcome_config (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade unique,
  enabled boolean default false,
  channel_id text,
  message_template text default 'Welcome {{user}} to {{server}}! You are member #{{member_count}}.',
  embed_enabled boolean default true,
  embed_color text default '#5865F2',
  background_image_url text,
  send_dm boolean default false,
  dm_template text,
  auto_role_id text,
  updated_at timestamptz default now()
);
alter table discord_welcome_config enable row level security;
drop policy if exists "Users manage own welcome config" on discord_welcome_config;
create policy "Users manage own welcome config" on discord_welcome_config for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Auto-moderation rules
create table if not exists discord_moderation (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade unique,
  bad_words text[] default '{}',
  anti_spam_enabled boolean default false,
  anti_spam_rate int default 5,       -- messages per 5 seconds
  anti_caps_enabled boolean default false,
  anti_caps_threshold int default 70, -- percent uppercase
  anti_link_enabled boolean default false,
  link_whitelist text[] default '{}',
  action_type text default 'warn' check (action_type in ('warn','mute','kick','ban','delete')),
  log_channel_id text,
  exempt_roles text[] default '{}',
  updated_at timestamptz default now()
);
alter table discord_moderation enable row level security;
drop policy if exists "Users manage own moderation" on discord_moderation;
create policy "Users manage own moderation" on discord_moderation for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Leveling config (one-to-one w/ server)
create table if not exists discord_leveling_config (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade unique,
  enabled boolean default true,
  xp_per_message int default 15,
  xp_cooldown_seconds int default 60,
  level_up_message text default 'Congrats {{user}}, you reached level {{level}}!',
  level_up_channel_id text,
  role_rewards jsonb default '[]'::jsonb, -- [{level: 5, role_id: '...'}, ...]
  updated_at timestamptz default now()
);
alter table discord_leveling_config enable row level security;
drop policy if exists "Users manage own leveling config" on discord_leveling_config;
create policy "Users manage own leveling config" on discord_leveling_config for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Giveaways
create table if not exists discord_giveaways (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  channel_id text,
  message_id text,
  prize text not null,
  winners_count int default 1,
  ends_at timestamptz not null,
  requirements jsonb default '{}'::jsonb,
  status text default 'active' check (status in ('active','ended','cancelled')),
  winners jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_discord_giveaways_server on discord_giveaways(server_id);
alter table discord_giveaways enable row level security;
drop policy if exists "Users manage own giveaways" on discord_giveaways;
create policy "Users manage own giveaways" on discord_giveaways for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Polls
create table if not exists discord_polls (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  channel_id text,
  message_id text,
  question text not null,
  options jsonb not null,     -- [{label: 'Yes', votes: 0}, ...]
  multi_select boolean default false,
  closes_at timestamptz,
  status text default 'active' check (status in ('active','closed')),
  created_at timestamptz default now()
);
create index if not exists idx_discord_polls_server on discord_polls(server_id);
alter table discord_polls enable row level security;
drop policy if exists "Users manage own polls" on discord_polls;
create policy "Users manage own polls" on discord_polls for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Scheduled announcements
create table if not exists discord_scheduled_announcements (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  channel_id text not null,
  title text,
  message text not null,
  embed jsonb,
  scheduled_for timestamptz,
  recurring text check (recurring in ('none','daily','weekly','monthly')),
  last_sent_at timestamptz,
  status text default 'pending' check (status in ('pending','sent','cancelled','failed')),
  created_at timestamptz default now()
);
create index if not exists idx_discord_sched_server on discord_scheduled_announcements(server_id);
alter table discord_scheduled_announcements enable row level security;
drop policy if exists "Users manage own scheduled announcements" on discord_scheduled_announcements;
create policy "Users manage own scheduled announcements" on discord_scheduled_announcements for all using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);

-- Audit log for bot actions
create table if not exists discord_audit_log (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references discord_servers(id) on delete cascade,
  event_type text not null,   -- member_join, member_leave, ban, role_change, command_used, mod_action
  user_id text,
  username text,
  actor text,                 -- bot, mod name, or system
  details jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_discord_audit_server on discord_audit_log(server_id, created_at desc);
alter table discord_audit_log enable row level security;
drop policy if exists "Users view own audit log" on discord_audit_log;
create policy "Users view own audit log" on discord_audit_log for select using (
  exists (select 1 from discord_servers s where s.id = server_id and s.profile_id = auth.uid())
);
