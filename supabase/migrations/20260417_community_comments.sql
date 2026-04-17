-- Community Comments — threaded comments on community posts
create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  parent_id uuid references community_comments(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  author_name text,
  author_avatar text,
  content text not null,
  likes int default 0,
  edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_comments_post on community_comments(post_id);
create index if not exists idx_comments_parent on community_comments(parent_id);
create index if not exists idx_comments_created on community_comments(created_at desc);

-- Community comment likes (who liked what)
create table if not exists community_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references community_comments(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);
create index if not exists idx_comment_likes_user on community_comment_likes(user_id);

-- Community post likes (who liked what post)
create table if not exists community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
create index if not exists idx_post_likes_user on community_post_likes(user_id);
create index if not exists idx_post_likes_post on community_post_likes(post_id);

-- Bookmarks
create table if not exists community_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
create index if not exists idx_bookmarks_user on community_bookmarks(user_id);

alter table community_comments enable row level security;
alter table community_comment_likes enable row level security;
alter table community_post_likes enable row level security;
alter table community_bookmarks enable row level security;

drop policy if exists "Anyone can read comments" on community_comments;
create policy "Anyone can read comments" on community_comments for select using (true);
drop policy if exists "Auth users can insert comments" on community_comments;
create policy "Auth users can insert comments" on community_comments for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own comments" on community_comments;
create policy "Users can update own comments" on community_comments for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own comments" on community_comments;
create policy "Users can delete own comments" on community_comments for delete using (auth.uid() = user_id);

drop policy if exists "Users manage own likes" on community_comment_likes;
create policy "Users manage own likes" on community_comment_likes for all using (auth.uid() = user_id);
drop policy if exists "Users manage own post likes" on community_post_likes;
create policy "Users manage own post likes" on community_post_likes for all using (auth.uid() = user_id);
drop policy if exists "Users manage own bookmarks" on community_bookmarks;
create policy "Users manage own bookmarks" on community_bookmarks for all using (auth.uid() = user_id);
