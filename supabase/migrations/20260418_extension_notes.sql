-- extension_notes: persistence for quick-notes saved from the Chrome
-- extension. Replaces the in-memory array in /api/extension/note.
create table if not exists extension_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  url text,
  page_title text,
  content text not null,
  tags text[] default array[]::text[],
  created_at timestamptz default now()
);

create index if not exists idx_ext_notes_user on extension_notes(user_id);

alter table extension_notes enable row level security;

-- RLS: owner-only access. auth.uid() = user_id gates both reads and writes
-- so the extension API routes can safely scope by user_id without leaking.
drop policy if exists "Users manage own extension notes" on extension_notes;
create policy "Users manage own extension notes" on extension_notes
  for all using (auth.uid() = user_id);
