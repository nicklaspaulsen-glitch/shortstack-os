-- Trinity AI Assistant — conversation + message persistence.
--
-- The earlier `trinity_conversations` table was a Telegram-bot conversation
-- blob scoped to admins. This migration brings it in line with the new
-- per-user Trinity assistant:
--   * adds `client_id` so portal-role users get their own scoped threads
--   * adds `title` for sidebar/history UI
--   * replaces admin-only RLS with `auth.uid() = user_id`
--   * introduces `trinity_messages` with role ∈ {user|assistant|tool}
--
-- Applied live via Supabase MCP against project `jkttomvrfhomhthetqhh`
-- on 2026-04-19 — this file is the repo mirror for future rebuilds.

-- ── trinity_conversations extensions ───────────────────────────
alter table if exists trinity_conversations
  add column if not exists client_id uuid references clients(id) on delete set null;

alter table if exists trinity_conversations
  add column if not exists title text;

alter table if exists trinity_conversations
  add column if not exists last_message_at timestamptz default now();

-- Tenant-scoped RLS (replaces any pre-existing admin-only policy)
drop policy if exists "trinity_conv_admin_only" on trinity_conversations;
drop policy if exists "trinity_conv_own" on trinity_conversations;

create policy "trinity_conv_own" on trinity_conversations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_trinity_conv_user_last
  on trinity_conversations(user_id, last_message_at desc);
create index if not exists idx_trinity_conv_client
  on trinity_conversations(client_id) where client_id is not null;

-- ── trinity_messages ────────────────────────────────────────────
create table if not exists trinity_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references trinity_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  actions_json jsonb,
  created_at timestamptz default now()
);

alter table trinity_messages enable row level security;

drop policy if exists "trinity_msg_via_conversation" on trinity_messages;
create policy "trinity_msg_via_conversation" on trinity_messages
  for all using (
    exists (
      select 1 from trinity_conversations c
      where c.id = trinity_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from trinity_conversations c
      where c.id = trinity_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create index if not exists idx_trinity_msg_conv_time
  on trinity_messages(conversation_id, created_at);
