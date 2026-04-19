-- Migration: Public Discord bot installs (per-agency Trinity bot config)
-- Date: 2026-04-19
-- Stores OAuth-installed Trinity bot instances per agency, with the target
-- guild, channel, and toggles for which Trinity events should ping that channel.
--
-- Separate from discord_servers (which is MEE6-style community bot config)
-- because this table tracks Trinity's *announcement/notification* integration
-- for agency ops updates (new client, new lead, milestone, etc.).

create table if not exists discord_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  guild_id text not null,
  guild_name text,
  icon_hash text,
  -- OAuth tokens (encrypted via pgsodium/Supabase Vault in production; stored plaintext here
  -- for MVP — these tokens grant bot-install scope only, not user-level access).
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  installed_at timestamptz default now(),
  -- Notification preferences
  notifications_enabled boolean default true,
  notify_channel_id text,
  -- Which event categories to announce. Each key is a bool toggle.
  -- Keys: new_client, new_lead, milestone, workflow_complete, payment_received
  notify_on jsonb default '{
    "new_client": true,
    "new_lead": true,
    "milestone": true,
    "workflow_complete": true,
    "payment_received": true
  }'::jsonb,
  -- Identifier of the Trinity bot application that was installed (allows future
  -- multi-bot scenarios — e.g. Trinity-for-Fitness vs Trinity-for-Agencies).
  installed_bot_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, guild_id)
);

create index if not exists idx_discord_integrations_user on discord_integrations(user_id);
create index if not exists idx_discord_integrations_guild on discord_integrations(guild_id);

alter table discord_integrations enable row level security;

drop policy if exists "Users manage own discord integrations" on discord_integrations;
create policy "Users manage own discord integrations"
  on discord_integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated-at trigger
create or replace function set_discord_integrations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_discord_integrations_updated on discord_integrations;
create trigger trg_discord_integrations_updated
  before update on discord_integrations
  for each row
  execute function set_discord_integrations_updated_at();
