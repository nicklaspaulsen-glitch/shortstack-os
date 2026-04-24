-- Cost-reduction layer: AI batch jobs + cache / usage stats
--
-- Two tables:
--   ai_batch_jobs  — one row per submitted Message Batches API job
--   ai_cache_stats — one row per API call (single or batch-aggregated),
--                    with estimated vs. baseline cost so the dashboard
--                    can surface "how much did prompt caching + batching
--                    save us this month".

-- ---------------------------------------------------------------------------
-- ai_batch_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_batch_jobs (
  id            uuid primary key default gen_random_uuid(),
  batch_id      text not null unique,
  user_id       uuid references auth.users(id) on delete set null,
  endpoint      text not null,
  model         text not null,
  item_count    integer not null default 0,
  status        text not null default 'in_progress'
                 check (status in ('in_progress','completed','canceled','expired','failed')),
  successful    integer,
  failed        integer,
  submitted_at  timestamptz not null default now(),
  completed_at  timestamptz,
  metadata      jsonb default '{}'::jsonb
);

create index if not exists ai_batch_jobs_status_idx
  on public.ai_batch_jobs (status, submitted_at desc);
create index if not exists ai_batch_jobs_user_idx
  on public.ai_batch_jobs (user_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- ai_cache_stats — per-call usage with cost estimates
-- ---------------------------------------------------------------------------
create table if not exists public.ai_cache_stats (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  endpoint               text not null,
  model                  text not null,
  input_tokens           integer not null default 0,
  output_tokens          integer not null default 0,
  cache_creation_tokens  integer not null default 0,
  cache_read_tokens      integer not null default 0,
  batched                boolean not null default false,
  had_cache_hit          boolean not null default false,
  estimated_cost_usd     numeric(12, 6) not null default 0,
  baseline_cost_usd      numeric(12, 6) not null default 0,
  savings_usd            numeric(12, 6) not null default 0,
  created_at             timestamptz not null default now()
);

create index if not exists ai_cache_stats_user_created_idx
  on public.ai_cache_stats (user_id, created_at desc);
create index if not exists ai_cache_stats_endpoint_idx
  on public.ai_cache_stats (endpoint, created_at desc);
create index if not exists ai_cache_stats_created_idx
  on public.ai_cache_stats (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ai_batch_jobs  enable row level security;
alter table public.ai_cache_stats enable row level security;

-- Users can read their own rows (for the /dashboard/settings/ai-costs page).
drop policy if exists ai_batch_jobs_select_own on public.ai_batch_jobs;
create policy ai_batch_jobs_select_own on public.ai_batch_jobs
  for select using (auth.uid() = user_id);

drop policy if exists ai_cache_stats_select_own on public.ai_cache_stats;
create policy ai_cache_stats_select_own on public.ai_cache_stats
  for select using (auth.uid() = user_id);

-- Admins (role='admin' in profiles) can see all rows for cross-account
-- monitoring. Falls through to the select-own policy otherwise.
drop policy if exists ai_batch_jobs_select_admin on public.ai_batch_jobs;
create policy ai_batch_jobs_select_admin on public.ai_batch_jobs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists ai_cache_stats_select_admin on public.ai_cache_stats;
create policy ai_cache_stats_select_admin on public.ai_cache_stats
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role has full access automatically (bypasses RLS).
-- No INSERT/UPDATE/DELETE policies — writes always go through
-- the service role via src/lib/ai/claude-client.ts.

comment on table public.ai_batch_jobs  is 'Anthropic Message Batches API jobs submitted via src/lib/ai/claude-client.ts';
comment on table public.ai_cache_stats is 'Per-call AI token usage with estimated vs. baseline cost — powers /dashboard/settings/ai-costs';
