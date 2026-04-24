-- llm_router_log: per-call telemetry for the dual-engine LLM router.
--
-- Every call made via src/lib/llm/router.ts (chatWithFallback) writes one
-- row capturing which tier served the call (local vs cloud), how long it
-- took, token counts, and whether a fallback fired. Used by the admin
-- dashboard at /dashboard/llm-router to surface savings % and latency.
--
-- Admin-read-only via RLS. Inserts are performed server-side with the
-- service-role client, so no insert policy is required for end users.

create table if not exists public.llm_router_log (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references auth.users(id) on delete set null,
  tier            text        not null check (tier in ('local', 'cloud')),
  task_type       text        not null,
  model           text        not null,
  tokens_in       integer     not null default 0,
  tokens_out      integer     not null default 0,
  latency_ms      integer     not null default 0,
  fallback_used   boolean     not null default false,
  error_text      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_llm_router_log_created_at
  on public.llm_router_log (created_at desc);

create index if not exists idx_llm_router_log_tier_task
  on public.llm_router_log (tier, task_type);

create index if not exists idx_llm_router_log_user_created
  on public.llm_router_log (user_id, created_at desc);

alter table public.llm_router_log enable row level security;

-- Admin read-only. The service-role client bypasses RLS for inserts.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'llm_router_log' and policyname = 'llm_router_log_admin_select'
  ) then
    create policy llm_router_log_admin_select
      on public.llm_router_log for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;
