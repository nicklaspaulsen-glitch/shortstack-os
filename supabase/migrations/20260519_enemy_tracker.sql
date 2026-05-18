-- Enemy Tracker: competitor profiles + viral content cache
-- May 19 2026

-- ---------------------------------------------------------------------------
-- competitor_profiles
-- One row per competitor tracked by an agency owner.
-- ---------------------------------------------------------------------------
create table if not exists public.competitor_profiles (
  id                uuid        primary key default gen_random_uuid(),
  agency_owner_id   uuid        not null references auth.users(id) on delete cascade,
  handle            text        not null,          -- e.g. "@growthwithkyle"
  display_name      text,
  platform          text        not null check (platform in ('tiktok','instagram','youtube','x')),
  avatar_url        text,
  niche             text,
  notes             text,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agency_owner_id, handle, platform)
);

-- RLS
alter table public.competitor_profiles enable row level security;

create policy "owner can manage their competitor profiles"
  on public.competitor_profiles
  for all
  using (agency_owner_id = auth.uid())
  with check (agency_owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- competitor_content_cache
-- Cached viral content items fetched from platform APIs (or mock data).
-- Keyed per competitor profile so the background sync cron can upsert.
-- ---------------------------------------------------------------------------
create table if not exists public.competitor_content_cache (
  id                  uuid        primary key default gen_random_uuid(),
  profile_id          uuid        not null references public.competitor_profiles(id) on delete cascade,
  agency_owner_id     uuid        not null references auth.users(id) on delete cascade,
  platform_content_id text        not null,         -- native ID from the platform
  platform            text        not null,
  handle              text        not null,
  display_name        text,
  avatar_url          text,
  thumbnail_url       text,
  video_url           text,
  caption             text,
  likes               integer     not null default 0,
  comments            integer     not null default 0,
  shares              integer     not null default 0,
  views               bigint      not null default 0,
  viral_score         integer     not null default 0 check (viral_score between 0 and 100),
  posted_at           timestamptz,
  tags                text[]      not null default '{}',
  fetched_at          timestamptz not null default now(),
  unique (profile_id, platform_content_id)
);

alter table public.competitor_content_cache enable row level security;

create policy "owner can read their competitor content"
  on public.competitor_content_cache
  for select
  using (agency_owner_id = auth.uid());

create policy "service role can write competitor content"
  on public.competitor_content_cache
  for all
  using (true)
  with check (true);

-- Indexes for fast feed queries
create index if not exists competitor_content_cache_owner_score_idx
  on public.competitor_content_cache (agency_owner_id, viral_score desc, posted_at desc);

create index if not exists competitor_content_cache_platform_idx
  on public.competitor_content_cache (agency_owner_id, platform, posted_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists competitor_profiles_updated_at on public.competitor_profiles;
create trigger competitor_profiles_updated_at
  before update on public.competitor_profiles
  for each row execute function public.set_updated_at();
