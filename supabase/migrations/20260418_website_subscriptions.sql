-- Website Subscriptions: per-website Stripe subscriptions for the website builder.
-- Tier-based monthly/yearly billing, addons, billing cycle, lifecycle status.

create table if not exists website_subscriptions (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references website_projects(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  stripe_subscription_id text,
  stripe_price_id text,
  tier text check (tier in ('starter','pro','business','premium')),
  monthly_price numeric(10,2),
  yearly_price numeric(10,2),
  billing_cycle text default 'monthly' check (billing_cycle in ('monthly','yearly')),
  addons jsonb default '[]'::jsonb,
  status text default 'active' check (status in ('active','past_due','cancelled','paused')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_subs_profile on website_subscriptions(profile_id);
create index if not exists idx_website_subs_website on website_subscriptions(website_id);
alter table website_subscriptions enable row level security;
drop policy if exists "Users manage own website subs" on website_subscriptions;
create policy "Users manage own website subs" on website_subscriptions for all using (auth.uid() = profile_id);

-- Add demo lifecycle columns to website_projects (idempotent).
alter table website_projects add column if not exists demo_expires_at timestamptz;
alter table website_projects add column if not exists demo_deployed_at timestamptz;
alter table website_projects add column if not exists watermark_enabled boolean default true;
alter table website_projects add column if not exists pricing_tier text;
alter table website_projects add column if not exists monthly_price numeric(10,2);
alter table website_projects add column if not exists yearly_price numeric(10,2);
alter table website_projects add column if not exists pricing_breakdown jsonb default '[]'::jsonb;
alter table website_projects add column if not exists addons jsonb default '[]'::jsonb;
