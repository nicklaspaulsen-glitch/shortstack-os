-- Portal Messages
-- Threaded messages between a client portal user and their agency.
-- `sender_role` is one of 'client' | 'agency' | 'ai' (AI responses from the portal assistant).
-- RLS:
--   client sees messages where clients.profile_id = auth.uid()
--   agency sees messages where clients.profile_id = auth.uid() (they own the client)

create table if not exists portal_messages (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  sender_role   text not null check (sender_role in ('client', 'agency', 'ai')),
  sender_profile_id uuid references profiles(id) on delete set null,
  body          text not null check (length(body) > 0 and length(body) <= 8000),
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_portal_messages_client_created
  on portal_messages(client_id, created_at desc);

alter table portal_messages enable row level security;

-- Client role: see messages for their own client record
drop policy if exists "portal_messages_client_read" on portal_messages;
create policy "portal_messages_client_read" on portal_messages
  for select
  using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- Client role: send messages to their own thread (sender_role must be 'client')
drop policy if exists "portal_messages_client_insert" on portal_messages;
create policy "portal_messages_client_insert" on portal_messages
  for insert
  with check (
    sender_role = 'client'
    and client_id in (select id from clients where profile_id = auth.uid())
  );

-- Client role: can mark their own messages read
drop policy if exists "portal_messages_client_update" on portal_messages;
create policy "portal_messages_client_update" on portal_messages
  for update
  using (
    client_id in (select id from clients where profile_id = auth.uid())
  );

-- Agency owner: full access to messages for clients they own (clients.profile_id = auth.uid())
drop policy if exists "portal_messages_agency_all" on portal_messages;
create policy "portal_messages_agency_all" on portal_messages
  for all
  using (
    exists (
      select 1 from clients c
      where c.id = portal_messages.client_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from clients c
      where c.id = portal_messages.client_id
        and c.profile_id = auth.uid()
    )
  );
