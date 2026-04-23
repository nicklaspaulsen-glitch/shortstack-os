-- Domain-as-Hub orchestration state.
-- Each row tracks a single "buy domain + provision all 5 services" flow.
-- Rather than one-off API calls, the user toggles which of { email, phone,
-- website, portal, chat } they want and one click spins all of them up in
-- parallel. The progress page polls this row to paint 5 colored dots.

create table if not exists domain_setup_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  domain text not null,
  enable_email boolean default true,
  enable_phone boolean default true,
  enable_website boolean default true,
  enable_portal boolean default true,
  enable_chat boolean default true,
  -- per-service lifecycle: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped'
  email_status text default 'pending',
  phone_status text default 'pending',
  website_status text default 'pending',
  portal_status text default 'pending',
  chat_status text default 'pending',
  email_result jsonb,
  phone_result jsonb,
  website_result jsonb,
  portal_result jsonb,
  chat_result jsonb,
  errors jsonb default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table domain_setup_jobs enable row level security;
drop policy if exists "own_dsjob_all" on domain_setup_jobs;
create policy "own_dsjob_all" on domain_setup_jobs for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create index if not exists idx_dsjob_user on domain_setup_jobs(profile_id, created_at desc);

-- Subdomain routing registry — one row per portal.<domain> we serve.
create table if not exists portal_subdomains (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  subdomain text unique not null,
  apex_domain text not null,
  configured_at timestamptz default now()
);
alter table portal_subdomains enable row level security;
drop policy if exists "own_ps_all" on portal_subdomains;
create policy "own_ps_all" on portal_subdomains for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Chat widget tokens — each domain gets its own embed so the agency can
-- hand off one <script> tag per client site.
create table if not exists chat_widgets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  domain text not null,
  token text unique not null,
  embed_script text,
  created_at timestamptz default now()
);
alter table chat_widgets enable row level security;
drop policy if exists "own_cw_all" on chat_widgets;
create policy "own_cw_all" on chat_widgets for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create index if not exists idx_chat_widgets_profile on chat_widgets(profile_id);
