-- oauth_connections_nango
--
-- Per-tenant OAuth connections managed via Nango (https://nango.dev).
-- This is the new table for the Nango migration; the legacy `oauth_connections`
-- table stays in place for the rollback path. Once the Nango flow is verified
-- in production for all integrations, the legacy table can be dropped.
--
-- Convention for `nango_connection_id`: `${user_id}-${integration_id}` (e.g.
-- `aaaa-bbbb-cccc-google-zanb`). One row per (user, integration) — the unique
-- constraint enforces this.

create table if not exists public.oauth_connections_nango (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  integration_id      text        not null,
  nango_connection_id text        not null,
  display_name        text,
  connected_at        timestamptz not null default now(),
  last_used_at        timestamptz,
  metadata            jsonb       not null default '{}'::jsonb,
  unique (user_id, integration_id)
);

create index if not exists oauth_connections_nango_user_id_idx
  on public.oauth_connections_nango (user_id);

create index if not exists oauth_connections_nango_integration_idx
  on public.oauth_connections_nango (integration_id);

create index if not exists oauth_connections_nango_connection_id_idx
  on public.oauth_connections_nango (nango_connection_id);

alter table public.oauth_connections_nango enable row level security;

-- Policies: users see / manage only their own rows; service-role bypasses RLS
-- by definition, so we don't need an explicit policy for it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections_nango' and policyname = 'oauth_connections_nango_select_own'
  ) then
    create policy oauth_connections_nango_select_own
      on public.oauth_connections_nango for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections_nango' and policyname = 'oauth_connections_nango_insert_own'
  ) then
    create policy oauth_connections_nango_insert_own
      on public.oauth_connections_nango for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections_nango' and policyname = 'oauth_connections_nango_update_own'
  ) then
    create policy oauth_connections_nango_update_own
      on public.oauth_connections_nango for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections_nango' and policyname = 'oauth_connections_nango_delete_own'
  ) then
    create policy oauth_connections_nango_delete_own
      on public.oauth_connections_nango for delete
      using (auth.uid() = user_id);
  end if;
end $$;

comment on table public.oauth_connections_nango is
  'OAuth connections managed via Nango. One row per (user_id, integration_id). The actual access/refresh tokens live in Nango — this table only tracks which integrations a tenant has connected and the corresponding nango_connection_id used to fetch fresh credentials at request time.';
