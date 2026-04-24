-- Community feature expansion (Apr 24 2026)
-- Adds emoji reactions, @mentions, channel bucket, and content indexes on top
-- of the existing community_posts / community_comments schema.
--
-- Channels are hard-coded constants in the app (announcements, wins, questions,
-- feedback, off-topic) and stored as a text column on community_posts.
--
-- RLS: authenticated users can read + write. Users can only edit/delete rows
-- they own.

-- ---------------------------------------------------------------------------
-- 1. community_posts: add channel + reaction_count columns
-- ---------------------------------------------------------------------------
alter table community_posts
  add column if not exists channel text not null default 'announcements'
    check (channel in ('announcements', 'wins', 'questions', 'feedback', 'off-topic'));

alter table community_posts
  add column if not exists reaction_count integer not null default 0;

create index if not exists idx_community_posts_channel
  on community_posts(channel, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. community_comments: add reaction_count column
-- ---------------------------------------------------------------------------
alter table community_comments
  add column if not exists reaction_count integer not null default 0;

-- ---------------------------------------------------------------------------
-- 3. community_reactions — emoji reactions on posts + comments
-- ---------------------------------------------------------------------------
create table if not exists community_reactions (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique(target_type, target_id, user_id, emoji)
);

create index if not exists idx_community_reactions_target
  on community_reactions(target_type, target_id);
create index if not exists idx_community_reactions_user
  on community_reactions(user_id);

alter table community_reactions enable row level security;

drop policy if exists "community_reactions_read" on community_reactions;
create policy "community_reactions_read" on community_reactions
  for select using (auth.uid() is not null);

drop policy if exists "community_reactions_insert" on community_reactions;
create policy "community_reactions_insert" on community_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_reactions_delete" on community_reactions;
create policy "community_reactions_delete" on community_reactions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. community_mentions — @mentions on posts + comments
-- ---------------------------------------------------------------------------
create table if not exists community_mentions (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid references community_posts(id) on delete cascade,
  comment_id          uuid references community_comments(id) on delete cascade,
  mentioned_user_id   uuid not null references auth.users(id) on delete cascade,
  author_user_id      uuid references auth.users(id) on delete set null,
  seen_at             timestamptz,
  created_at          timestamptz not null default now(),
  check (post_id is not null or comment_id is not null)
);

create index if not exists idx_community_mentions_user_unseen
  on community_mentions(mentioned_user_id) where seen_at is null;
create index if not exists idx_community_mentions_user_created
  on community_mentions(mentioned_user_id, created_at desc);

alter table community_mentions enable row level security;

drop policy if exists "community_mentions_read_own" on community_mentions;
create policy "community_mentions_read_own" on community_mentions
  for select using (auth.uid() = mentioned_user_id or auth.uid() = author_user_id);

drop policy if exists "community_mentions_insert" on community_mentions;
create policy "community_mentions_insert" on community_mentions
  for insert with check (auth.uid() = author_user_id);

drop policy if exists "community_mentions_update_own" on community_mentions;
create policy "community_mentions_update_own" on community_mentions
  for update using (auth.uid() = mentioned_user_id);

-- ---------------------------------------------------------------------------
-- 5. Ensure community_posts RLS is open for authenticated reads (some older
--    migrations only allowed reads when auth.uid() matched etc. This is a
--    Skool-style shared feed — every logged-in user should see every post.)
-- ---------------------------------------------------------------------------
alter table community_posts enable row level security;

drop policy if exists "community_posts_read_all_auth" on community_posts;
create policy "community_posts_read_all_auth" on community_posts
  for select using (auth.uid() is not null);

drop policy if exists "community_posts_insert_self" on community_posts;
create policy "community_posts_insert_self" on community_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own" on community_posts;
create policy "community_posts_update_own" on community_posts
  for update using (auth.uid() = user_id);

drop policy if exists "community_posts_delete_own" on community_posts;
create policy "community_posts_delete_own" on community_posts
  for delete using (auth.uid() = user_id);
