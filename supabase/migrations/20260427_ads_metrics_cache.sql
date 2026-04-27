-- Ads Manager UI: cache + AI optimization suggestions tables
--
-- ads_metrics_cache: per-day metrics snapshot per (user, platform, campaign)
-- so the unified Ads Manager dashboard doesn't hit the platform APIs on every
-- page load. Refreshed nightly by /api/cron/refresh-ads-metrics.
--
-- ads_optimization_suggestions: AI-generated reallocation/pause/scale recs
-- with a human-approval gate. Status enum tracks the lifecycle: pending →
-- accepted/rejected/expired.

create table if not exists public.ads_metrics_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('meta','google','tiktok')),
  campaign_id text not null,
  campaign_name text,
  date date not null,
  spend_cents int default 0,
  impressions int default 0,
  clicks int default 0,
  conversions int default 0,
  cpa_cents int,
  roas numeric,
  raw_metrics jsonb default '{}'::jsonb,
  fetched_at timestamptz default now(),
  unique (user_id, platform, campaign_id, date)
);

alter table public.ads_metrics_cache enable row level security;

do $$ begin
  create policy "ads_metrics_cache_own" on public.ads_metrics_cache
    for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create index if not exists idx_ads_metrics_user_date
  on public.ads_metrics_cache(user_id, date desc);
create index if not exists idx_ads_metrics_platform
  on public.ads_metrics_cache(platform);

create table if not exists public.ads_optimization_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  suggestion_type text not null check (
    suggestion_type in ('reallocate','pause','scale','optimize_creative')
  ),
  platform text,
  campaign_id text,
  current_state jsonb,
  suggested_state jsonb,
  rationale text,
  potential_lift_pct numeric,
  status text default 'pending' check (
    status in ('pending','accepted','rejected','expired')
  ),
  created_at timestamptz default now(),
  acted_at timestamptz
);

alter table public.ads_optimization_suggestions enable row level security;

do $$ begin
  create policy "ads_optimization_suggestions_own"
    on public.ads_optimization_suggestions
    for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create index if not exists idx_ads_opt_suggestions_user_status
  on public.ads_optimization_suggestions(user_id, status);
create index if not exists idx_ads_opt_suggestions_created
  on public.ads_optimization_suggestions(created_at desc);
