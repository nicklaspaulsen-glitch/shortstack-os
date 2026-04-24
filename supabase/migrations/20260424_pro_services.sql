-- ════════════════════════════════════════════════════════════════════
-- Pro Services Directory — the "hire real humans" marketplace.
--
-- v1 is curated (admin-vetted) so we skip the two-sided cold-start
-- problem: agency users see only `vetted = true` providers. Providers
-- invoice clients directly outside ShortStack; this schema captures the
-- quote-request handshake + post-hoc reviews/referrals for v2 monetization.
--
-- Tables:
--   - pro_services_providers  : freelancer profile rows (admin-vetted)
--   - pro_services_requests   : agency → provider quote requests
--   - pro_services_reviews    : post-delivery 1–5 star rating + text
--   - pro_services_referrals  : 10% referral ledger (scaffolding — no
--                               real money flow in v1, fills from webhook v2)
--
-- RLS:
--   - providers         : everyone can read vetted=true rows; providers can
--                         read+update their own row (by email match);
--                         admins can do anything
--   - requests          : requester sees their own; provider sees where
--                         provider_id resolves to their own profile; admin
--                         sees all
--   - reviews           : readable by anyone (for display on profile);
--                         writable by the requester of the matching request
--   - referrals         : admin-only (internal ledger, v2)
-- ════════════════════════════════════════════════════════════════════

-- ─── providers ────────────────────────────────────────────────────
create table if not exists public.pro_services_providers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email                 text not null unique,
  bio                   text,
  avatar_url            text,
  timezone              text,
  categories            text[] not null default '{}',
  starting_price_cents  integer not null default 0 check (starting_price_cents >= 0),
  turnaround_days       integer not null default 7 check (turnaround_days > 0),
  portfolio_urls        text[] not null default '{}',
  vetted                boolean not null default false,
  vetted_at             timestamptz,
  subscription_status   text not null default 'inactive'
                          check (subscription_status in ('active', 'inactive', 'trialing')),
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);

create index if not exists pro_services_providers_vetted_idx
  on public.pro_services_providers (vetted);
create index if not exists pro_services_providers_categories_idx
  on public.pro_services_providers using gin (categories);
create index if not exists pro_services_providers_email_idx
  on public.pro_services_providers (email);

alter table public.pro_services_providers enable row level security;

-- Anyone authenticated can read vetted providers (public directory)
drop policy if exists "pro_providers_read_vetted" on public.pro_services_providers;
create policy "pro_providers_read_vetted" on public.pro_services_providers
  for select
  using (vetted = true);

-- Providers can read their own row regardless of vetted status (so they
-- see their profile-in-review and can edit while waiting for vetting)
drop policy if exists "pro_providers_read_own" on public.pro_services_providers;
create policy "pro_providers_read_own" on public.pro_services_providers
  for select
  using (
    email = (select email from public.profiles where id = auth.uid())
  );

-- Providers can update their own row (but not vetted / subscription fields —
-- enforced in the API route, not in RLS, because there's no column-level RLS)
drop policy if exists "pro_providers_update_own" on public.pro_services_providers;
create policy "pro_providers_update_own" on public.pro_services_providers
  for update
  using (
    email = (select email from public.profiles where id = auth.uid())
  )
  with check (
    email = (select email from public.profiles where id = auth.uid())
  );

-- Admins: full access
drop policy if exists "pro_providers_admin_all" on public.pro_services_providers;
create policy "pro_providers_admin_all" on public.pro_services_providers
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Signed-in users can insert a new provider row (self-signup) — always
-- forced to vetted=false at the API layer
drop policy if exists "pro_providers_insert_self" on public.pro_services_providers;
create policy "pro_providers_insert_self" on public.pro_services_providers
  for insert
  with check (
    email = (select email from public.profiles where id = auth.uid())
  );

-- ─── requests ─────────────────────────────────────────────────────
create table if not exists public.pro_services_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  provider_id     uuid not null references public.pro_services_providers(id) on delete cascade,
  category        text not null,
  title           text not null,
  description     text not null,
  budget_cents    integer,
  deadline        date,
  attachments     jsonb not null default '[]'::jsonb,
  status          text not null default 'open'
                    check (status in ('open', 'quoted', 'accepted', 'declined', 'completed', 'cancelled')),
  quote_cents     integer,
  quote_message   text,
  accepted_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists pro_services_requests_user_idx
  on public.pro_services_requests (user_id, created_at desc);
create index if not exists pro_services_requests_provider_idx
  on public.pro_services_requests (provider_id, created_at desc);
create index if not exists pro_services_requests_status_idx
  on public.pro_services_requests (status);

alter table public.pro_services_requests enable row level security;

-- Requester: read/update their own requests
drop policy if exists "pro_requests_requester" on public.pro_services_requests;
create policy "pro_requests_requester" on public.pro_services_requests
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Provider: read/update requests targeted at them (identified by email→row)
drop policy if exists "pro_requests_provider" on public.pro_services_requests;
create policy "pro_requests_provider" on public.pro_services_requests
  for all
  using (
    provider_id in (
      select p.id from public.pro_services_providers p
      where p.email = (select email from public.profiles where id = auth.uid())
    )
  )
  with check (
    provider_id in (
      select p.id from public.pro_services_providers p
      where p.email = (select email from public.profiles where id = auth.uid())
    )
  );

-- Admin: full access
drop policy if exists "pro_requests_admin" on public.pro_services_requests;
create policy "pro_requests_admin" on public.pro_services_requests
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── reviews ──────────────────────────────────────────────────────
create table if not exists public.pro_services_reviews (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.pro_services_requests(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  review_text  text,
  created_at   timestamptz not null default now(),
  unique (request_id)
);

create index if not exists pro_services_reviews_request_idx
  on public.pro_services_reviews (request_id);

alter table public.pro_services_reviews enable row level security;

-- Anyone signed-in can read reviews (to display on provider profiles)
drop policy if exists "pro_reviews_read_all" on public.pro_services_reviews;
create policy "pro_reviews_read_all" on public.pro_services_reviews
  for select
  using (auth.uid() is not null);

-- The requester of the matching request can write/update their review
drop policy if exists "pro_reviews_write_requester" on public.pro_services_reviews;
create policy "pro_reviews_write_requester" on public.pro_services_reviews
  for all
  using (
    request_id in (
      select id from public.pro_services_requests where user_id = auth.uid()
    )
  )
  with check (
    request_id in (
      select id from public.pro_services_requests where user_id = auth.uid()
    )
  );

-- Admin full access
drop policy if exists "pro_reviews_admin" on public.pro_services_reviews;
create policy "pro_reviews_admin" on public.pro_services_reviews
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── referrals (ledger — v2 monetization scaffolding) ────────────
create table if not exists public.pro_services_referrals (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.pro_services_requests(id) on delete cascade,
  referral_pct    integer not null default 10 check (referral_pct between 0 and 100),
  referral_cents  integer not null default 0 check (referral_cents >= 0),
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (request_id)
);

create index if not exists pro_services_referrals_paid_idx
  on public.pro_services_referrals (paid_at);

alter table public.pro_services_referrals enable row level security;

-- Admin-only ledger
drop policy if exists "pro_referrals_admin" on public.pro_services_referrals;
create policy "pro_referrals_admin" on public.pro_services_referrals
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── seed 10 placeholder providers (vetted=false) ────────────────
-- These are obviously-fake rows so Nicklas can replace them when real
-- freelancers onboard. Categories spread across the 6 supported buckets:
-- video_editor, thumbnail_artist, voice_over, copywriter, designer, other.
insert into public.pro_services_providers
  (name, email, bio, timezone, categories, starting_price_cents, turnaround_days, portfolio_urls, vetted)
values
  ('[Placeholder] Maya Velasquez', 'placeholder+editor1@shortstack.example',
   'Short-form vertical video editor. 5+ years. Fast turnaround, clean cuts, punchy B-roll.',
   'America/Los_Angeles', array['video_editor'], 15000, 3,
   array['https://example.com/maya/reel']::text[], false),

  ('[Placeholder] Kenji Yamamoto', 'placeholder+editor2@shortstack.example',
   'YouTube long-form editor specializing in educational content. Storytelling-first.',
   'Asia/Tokyo', array['video_editor'], 25000, 5,
   array['https://example.com/kenji/portfolio']::text[], false),

  ('[Placeholder] Zara Okonkwo', 'placeholder+thumb1@shortstack.example',
   'Thumbnail artist. High-CTR Photoshop work for finance, tech, and fitness creators.',
   'Europe/London', array['thumbnail_artist'], 7500, 2,
   array['https://example.com/zara/thumbs']::text[], false),

  ('[Placeholder] Diego Moreno', 'placeholder+thumb2@shortstack.example',
   'Thumbnail designer + photographer. Hand-composed shots, custom face retouching.',
   'America/Mexico_City', array['thumbnail_artist', 'designer'], 9000, 3,
   array['https://example.com/diego/case-studies']::text[], false),

  ('[Placeholder] Priya Sharma', 'placeholder+voice1@shortstack.example',
   'Voice-over artist: warm conversational, explainer-style narration. Home studio.',
   'Asia/Kolkata', array['voice_over'], 12000, 2,
   array['https://example.com/priya/demo-reel']::text[], false),

  ('[Placeholder] Marcus Bailey', 'placeholder+voice2@shortstack.example',
   'Deep-voice commercial + trailer VO. Broadcast credits: history, sports, auto.',
   'America/Chicago', array['voice_over'], 20000, 1,
   array['https://example.com/marcus/reel']::text[], false),

  ('[Placeholder] Elena Rossi', 'placeholder+copy1@shortstack.example',
   'Direct-response copywriter — ads, landing pages, email sequences. SaaS focus.',
   'Europe/Rome', array['copywriter'], 40000, 4,
   array['https://example.com/elena/case-studies']::text[], false),

  ('[Placeholder] Oliver Chen', 'placeholder+copy2@shortstack.example',
   'YouTube scriptwriter and long-form content strategist. 100M+ views delivered.',
   'Australia/Sydney', array['copywriter'], 30000, 3,
   array['https://example.com/oliver/scripts']::text[], false),

  ('[Placeholder] Sofia Hartmann', 'placeholder+design1@shortstack.example',
   'Brand + graphic designer. Logos, brand kits, social templates, presentations.',
   'Europe/Berlin', array['designer'], 50000, 5,
   array['https://example.com/sofia/brands']::text[], false),

  ('[Placeholder] Jamal Washington', 'placeholder+other1@shortstack.example',
   'Motion graphics + 3D animator. Custom intros, logo stings, title sequences.',
   'America/New_York', array['other', 'designer'], 35000, 7,
   array['https://example.com/jamal/motion']::text[], false)
on conflict (email) do nothing;
