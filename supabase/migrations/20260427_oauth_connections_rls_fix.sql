-- Fix oauth_connections RLS: replace the single catch-all FOR ALL policy with
-- separate SELECT / INSERT / UPDATE / DELETE policies that correctly enforce
-- the OR-of-IDs pattern for rows that may be owned by a profile directly
-- (user_id) OR scoped to a client the authenticated user owns (client_id).
--
-- Previous policy: auth.uid() = user_id OR auth.uid() = profile_id
-- Problem: `profile_id` and `user_id` are both direct profile references,
-- meaning an agency tenant who shares a client's profile_id could accidentally
-- read another tenant's OAuth tokens. The correct scope is:
--
--   SELECT/UPDATE/DELETE: caller owns the row directly (user_id match) OR
--     caller owns the client that the row is scoped to (client_id IN
--     SELECT id FROM clients WHERE profile_id = auth.uid()).
--   INSERT:  new row must set user_id = auth.uid() (direct ownership).
--     Rows scoped to a client are created server-side via service role only.
--
-- The separate-operation policies replace the FOR ALL policy so each verb
-- gets the tightest possible check.
--
-- ORDERING NOTE (audit Apr 26 M7): the client_id column is added BEFORE the
-- policies so a fresh-DB run doesn't fail with `column "client_id" does not
-- exist` when Postgres parses the policy bodies. This migration is already
-- live in production (applied via Supabase MCP earlier), so the reorder is
-- only for schema reproducibility on staging / fresh installs.

-- 1. Add a client_id column if it doesn't exist yet. The migration that
--    created the table used user_id and profile_id; client_id was planned
--    but not yet added. Safe no-op if it already exists. Must run BEFORE
--    the policies below because they reference client_id in their USING /
--    WITH CHECK expressions.
alter table public.oauth_connections
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

create index if not exists idx_oauth_connections_client
  on public.oauth_connections (client_id);

comment on column public.oauth_connections.client_id is
  'When set, this OAuth connection is scoped to a specific client (e.g., an '
  'agency connected TikTok Ads on behalf of client X). RLS allows the owning '
  'agency profile to manage these rows via the clients.profile_id join.';

-- 2. Drop the old catch-all policy.
drop policy if exists "Users manage own oauth connections" on public.oauth_connections;

-- 3. SELECT: own rows OR rows belonging to the caller's clients.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections'
      and policyname = 'oauth_connections_select_own_or_client'
  ) then
    create policy oauth_connections_select_own_or_client
      on public.oauth_connections
      for select
      using (
        auth.uid() = user_id
        or
        client_id in (
          select id from public.clients where profile_id = auth.uid()
        )
      );
  end if;
end $$;

-- 4. INSERT: caller must own the new row directly.
--    Client-scoped inserts must go through the service role (server-side).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections'
      and policyname = 'oauth_connections_insert_own'
  ) then
    create policy oauth_connections_insert_own
      on public.oauth_connections
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 5. UPDATE: same as SELECT — own rows OR rows belonging to the caller's clients.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections'
      and policyname = 'oauth_connections_update_own_or_client'
  ) then
    create policy oauth_connections_update_own_or_client
      on public.oauth_connections
      for update
      using (
        auth.uid() = user_id
        or
        client_id in (
          select id from public.clients where profile_id = auth.uid()
        )
      )
      with check (
        auth.uid() = user_id
        or
        client_id in (
          select id from public.clients where profile_id = auth.uid()
        )
      );
  end if;
end $$;

-- 6. DELETE: own rows OR rows belonging to the caller's clients.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'oauth_connections'
      and policyname = 'oauth_connections_delete_own_or_client'
  ) then
    create policy oauth_connections_delete_own_or_client
      on public.oauth_connections
      for delete
      using (
        auth.uid() = user_id
        or
        client_id in (
          select id from public.clients where profile_id = auth.uid()
        )
      );
  end if;
end $$;
