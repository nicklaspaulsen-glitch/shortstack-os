-- AI Budget Caps + Output Cache (Apr 24, 2026)
-- Layered on top of prompt-caching + Batches API (feat/cost-reduction-layer branch).
-- Adds:
--   * ai_output_cache — 7-day TTL cache of Claude responses keyed by sha256(input)
--   * org_ai_budgets — per-org monthly spend caps + circuit breaker
--   * ai_budget_alerts — audit log of threshold/pause/reset events
--
-- NOTE: Project currently has no `organizations` table (uses profiles + clients + team_members).
-- `org_id` here is stored as a plain uuid (no FK) so the migration runs standalone and can
-- later be linked once an orgs concept lands. RLS checks defer to team_members or profiles.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ai_output_cache
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_output_cache (
  id                  uuid        primary key default gen_random_uuid(),
  input_hash          text        not null unique,
  model               text        not null,
  output_content      text        not null,
  output_tokens       int         not null default 0,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '7 days'),
  hits                int         not null default 0,
  last_hit_at         timestamptz,
  created_by_org_id   uuid
);

create index if not exists idx_ai_output_cache_org_created
  on public.ai_output_cache(created_by_org_id, created_at desc);
create index if not exists idx_ai_output_cache_expires
  on public.ai_output_cache(expires_at);

alter table public.ai_output_cache enable row level security;

-- Reads: service role (no user read exposure — the hash is the API key).
-- We deliberately skip a permissive SELECT policy so callers must use service_role.

-- ──────────────────────────────────────────────────────────────────────────
-- 2. org_ai_budgets
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.org_ai_budgets (
  org_id                    uuid          primary key,
  monthly_limit_usd         numeric(10,2) not null default 100.00,
  current_month_spend_usd   numeric(10,4) not null default 0,
  reset_date                date          not null default (date_trunc('month', now() + interval '1 month'))::date,
  alert_threshold_pct       int           not null default 80 check (alert_threshold_pct between 1 and 100),
  paused                    bool          not null default false,
  paused_reason             text,
  updated_at                timestamptz   not null default now()
);

create index if not exists idx_org_ai_budgets_org on public.org_ai_budgets(org_id);

alter table public.org_ai_budgets enable row level security;

-- Members of the org can read their own budget row.
-- We approximate "org member" via team_members.user_id = auth.uid() && team_members.org_id = org_id
-- If team_members doesn't have an org_id column on this branch, the policy falls back to
-- get_user_role() = 'admin'.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'org_ai_budgets' and policyname = 'org_ai_budgets_select_member'
  ) then
    create policy org_ai_budgets_select_member
      on public.org_ai_budgets for select
      using (
        get_user_role(auth.uid()) = 'admin'
        or exists (
          select 1 from public.team_members tm
          where tm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'org_ai_budgets' and policyname = 'org_ai_budgets_update_admin'
  ) then
    create policy org_ai_budgets_update_admin
      on public.org_ai_budgets for update
      using (get_user_role(auth.uid()) = 'admin')
      with check (get_user_role(auth.uid()) = 'admin');
  end if;
end $$;

-- Keep updated_at fresh
create or replace function public.touch_org_ai_budgets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_org_ai_budgets on public.org_ai_budgets;
create trigger trg_touch_org_ai_budgets
  before update on public.org_ai_budgets
  for each row execute function public.touch_org_ai_budgets_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. ai_budget_alerts
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_budget_alerts (
  id               uuid          primary key default gen_random_uuid(),
  org_id           uuid          not null,
  alert_type       text          not null check (alert_type in (
                      'threshold_80','threshold_100','manual_pause',
                      'manual_resume','auto_pause','monthly_reset'
                    )),
  spend_at_alert   numeric(10,4) not null default 0,
  sent_at          timestamptz   not null default now(),
  recipient_email  text
);

create index if not exists idx_ai_budget_alerts_org_sent
  on public.ai_budget_alerts(org_id, sent_at desc);

alter table public.ai_budget_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_budget_alerts' and policyname = 'ai_budget_alerts_select_member'
  ) then
    create policy ai_budget_alerts_select_member
      on public.ai_budget_alerts for select
      using (
        get_user_role(auth.uid()) = 'admin'
        or exists (
          select 1 from public.team_members tm
          where tm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Comments
-- ──────────────────────────────────────────────────────────────────────────
comment on table  public.ai_output_cache       is 'sha256-keyed Claude output cache, 7-day TTL';
comment on table  public.org_ai_budgets        is 'Per-org monthly AI spend limits + circuit breaker';
comment on table  public.ai_budget_alerts      is 'Audit log for threshold/pause/reset events';
