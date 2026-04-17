-- Video Projects — stores AI-generated video project data
-- Feeds the video editor's "Generate with AI" flow (script + captions + shotlist + editor_settings)

create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  topic text not null,
  duration int default 60,
  style_preset text,
  niche text,
  target_audience text,
  call_to_action text,

  -- AI-generated content
  script jsonb,
  captions jsonb,
  shotlist jsonb,
  editor_settings jsonb,

  -- Render output
  render_url text,
  render_status text default 'draft' check (render_status in ('draft','rendering','completed','failed')),
  render_job_id text,
  render_error text,
  estimated_render_cost int,

  -- Metadata
  title text,
  tags text[] default array[]::text[],
  status text default 'active' check (status in ('active','archived','deleted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_video_projects_profile on video_projects(profile_id);
create index if not exists idx_video_projects_client on video_projects(client_id);
create index if not exists idx_video_projects_status on video_projects(status);
create index if not exists idx_video_projects_created on video_projects(created_at desc);

-- Auto-update updated_at
create or replace function update_video_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_video_projects_updated_at on video_projects;
create trigger trg_video_projects_updated_at
  before update on video_projects
  for each row execute function update_video_projects_updated_at();

-- RLS
alter table video_projects enable row level security;

drop policy if exists "Users can view their own video projects" on video_projects;
create policy "Users can view their own video projects"
  on video_projects for select
  using (auth.uid() = profile_id);

drop policy if exists "Users can insert their own video projects" on video_projects;
create policy "Users can insert their own video projects"
  on video_projects for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Users can update their own video projects" on video_projects;
create policy "Users can update their own video projects"
  on video_projects for update
  using (auth.uid() = profile_id);

drop policy if exists "Users can delete their own video projects" on video_projects;
create policy "Users can delete their own video projects"
  on video_projects for delete
  using (auth.uid() = profile_id);
