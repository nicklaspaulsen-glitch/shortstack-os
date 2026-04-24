-- feedback: in-product feedback/bug/feature requests captured from the
-- feedback button. Screenshot blob stored as data-url.
-- Idempotent so repeated runs in dev are safe.

create table if not exists public.feedback (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users(id) on delete set null,
  org_id             uuid,
  type               text        not null check (type in ('bug', 'feature', 'praise', 'question')),
  message            text        not null,
  page_url           text,
  screenshot_data_url text,
  user_agent         text,
  created_at         timestamptz not null default now(),
  status             text        not null default 'new' check (status in ('new', 'acknowledged', 'resolved'))
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx     on public.feedback (status);
create index if not exists feedback_user_id_idx    on public.feedback (user_id);

alter table public.feedback enable row level security;

-- Inserts: anyone can submit feedback (including unauthenticated visitors).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'feedback' and policyname = 'feedback_insert_any'
  ) then
    create policy feedback_insert_any
      on public.feedback for insert
      with check (true);
  end if;

  -- Reads: admins only. Matches the existing admin pattern used elsewhere
  -- (profile.role = 'admin'). If profile table isn't present, this policy
  -- simply denies reads, which is the safe default.
  if not exists (
    select 1 from pg_policies
    where tablename = 'feedback' and policyname = 'feedback_select_admin'
  ) then
    create policy feedback_select_admin
      on public.feedback for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  -- Updates (status transitions): admins only.
  if not exists (
    select 1 from pg_policies
    where tablename = 'feedback' and policyname = 'feedback_update_admin'
  ) then
    create policy feedback_update_admin
      on public.feedback for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;
