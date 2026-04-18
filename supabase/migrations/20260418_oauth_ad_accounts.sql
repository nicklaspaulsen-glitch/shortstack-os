-- OAuth connections extensions + ad accounts/campaigns tables for Ads Manager
-- Extends oauth_connections with ad-specific fields + creates ad_accounts per connection

-- Ensure oauth_connections exists (safe to run again on existing envs)
create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  platform text not null,
  account_id text,
  account_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add ad-specific columns (no-op if already present)
alter table oauth_connections add column if not exists platform_type text;  -- 'social' | 'ads' | 'email'
alter table oauth_connections add column if not exists scope text;
alter table oauth_connections add column if not exists account_id text;
alter table oauth_connections add column if not exists account_name text;
alter table oauth_connections add column if not exists user_id uuid references profiles(id) on delete cascade;
alter table oauth_connections add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_oauth_connections_user on oauth_connections(user_id);
create index if not exists idx_oauth_connections_profile on oauth_connections(profile_id);
create index if not exists idx_oauth_connections_platform on oauth_connections(platform);

alter table oauth_connections enable row level security;
do $$ begin
  create policy "Users manage own oauth connections" on oauth_connections
    for all using (auth.uid() = user_id or auth.uid() = profile_id);
exception when duplicate_object then null; end $$;

-- ad_accounts: one row per connected ad account under a connection
create table if not exists ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  platform text not null check (platform in ('meta_ads','google_ads','tiktok_ads','linkedin_ads')),
  account_id text not null,
  account_name text,
  currency text,
  timezone text,
  status text default 'active',
  oauth_connection_id uuid references oauth_connections(id) on delete cascade,
  is_default boolean default false,
  spend_this_month numeric(12,2) default 0,
  last_synced_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, platform, account_id)
);
create index if not exists idx_ad_accounts_user on ad_accounts(user_id);
create index if not exists idx_ad_accounts_platform on ad_accounts(platform);
alter table ad_accounts enable row level security;
do $$ begin
  create policy "Users manage own ad accounts" on ad_accounts
    for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ad_campaigns: normalized campaigns from Meta / Google / TikTok Ads
create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  ad_account_id uuid references ad_accounts(id) on delete cascade,
  platform text not null,
  external_id text not null,
  name text,
  objective text,
  status text,
  daily_budget numeric(12,2),
  total_spend numeric(12,2) default 0,
  impressions int default 0,
  clicks int default 0,
  conversions int default 0,
  ctr numeric(6,4),
  cpa numeric(12,4),
  roas numeric(10,4),
  start_date date,
  end_date date,
  last_synced_at timestamptz,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, platform, external_id)
);
create index if not exists idx_ad_campaigns_user on ad_campaigns(user_id);
create index if not exists idx_ad_campaigns_account on ad_campaigns(ad_account_id);
create index if not exists idx_ad_campaigns_platform on ad_campaigns(platform);
alter table ad_campaigns enable row level security;
do $$ begin
  create policy "Users manage own ad campaigns" on ad_campaigns
    for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
