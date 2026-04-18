-- Unified generations table — one row per output across all generators
-- (Copywriter, Email Composer, Carousel Generator, Thumbnail Studio, etc.)

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null, -- 'video' | 'ad_copy' | 'thumbnail' | 'email' | 'script' | 'social_post' | 'landing_page'
  title text not null,
  source_tool text not null, -- e.g. 'Copywriter', 'Email Composer', 'Carousel Generator', 'Thumbnail Studio'
  content_preview text, -- first 200 chars or summary
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_generations_user on generations(user_id);
create index if not exists idx_generations_category on generations(category);
create index if not exists idx_generations_created on generations(created_at desc);

alter table generations enable row level security;

drop policy if exists "Users manage own generations" on generations;
create policy "Users manage own generations"
  on generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
