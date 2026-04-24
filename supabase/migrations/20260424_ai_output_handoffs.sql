-- ai_output_handoffs: short-lived store for "Edit after AI" flow.
-- Table may already exist (created by earlier deploy) — only create if absent.
create table if not exists public.ai_output_handoffs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade,
  kind        text        not null,
  payload     jsonb       not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '15 minutes')
);

-- RLS (idempotent)
alter table public.ai_output_handoffs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_output_handoffs' and policyname = 'ai_output_handoffs_select_own'
  ) then
    create policy ai_output_handoffs_select_own
      on public.ai_output_handoffs for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_output_handoffs' and policyname = 'ai_output_handoffs_insert_own'
  ) then
    create policy ai_output_handoffs_insert_own
      on public.ai_output_handoffs for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_output_handoffs' and policyname = 'ai_output_handoffs_delete_own'
  ) then
    create policy ai_output_handoffs_delete_own
      on public.ai_output_handoffs for delete
      using (auth.uid() = user_id);
  end if;
end $$;
