-- Project Boards (Monday.com-style kanban)
-- Three tables: project_boards, project_tasks, project_task_comments.
-- Agency owner (admin) creates boards; team_members reference their parent agency.
-- Optional client_id scope lets a board be "about" a specific client.
--
-- RLS strategy: boards gated on auth.uid() = user_id. Tasks/comments gated
-- via an EXISTS join against the parent board so the policy is a single
-- index lookup. No recursion across tables.

-- ============================================================
-- project_boards
-- ============================================================
create table if not exists project_boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  client_id   uuid references clients(id) on delete set null,
  name        text not null,
  icon        text default 'kanban',
  color       text default '#C9A84C',
  created_at  timestamptz not null default now()
);

create index if not exists idx_project_boards_user    on project_boards(user_id, created_at desc);
create index if not exists idx_project_boards_client  on project_boards(client_id);

alter table project_boards enable row level security;

drop policy if exists "Users manage own project boards" on project_boards;
create policy "Users manage own project boards" on project_boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- project_tasks
-- ============================================================
create table if not exists project_tasks (
  id                    uuid primary key default gen_random_uuid(),
  board_id              uuid not null references project_boards(id) on delete cascade,
  title                 text not null,
  description           text,
  status                text not null default 'backlog'
                          check (status in ('backlog','todo','in_progress','review','done')),
  priority              text not null default 'medium'
                          check (priority in ('low','medium','high','urgent')),
  assignee_profile_id   uuid references profiles(id) on delete set null,
  due_date              date,
  position              integer not null default 0,
  created_by            uuid references profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_project_tasks_board_status_pos
  on project_tasks(board_id, status, position);
create index if not exists idx_project_tasks_assignee
  on project_tasks(assignee_profile_id);
create index if not exists idx_project_tasks_due_date
  on project_tasks(due_date);

alter table project_tasks enable row level security;

-- Task access is gated via the owning board. A single EXISTS join
-- keeps policies fast and RLS simple.
drop policy if exists "Users access tasks via own boards" on project_tasks;
create policy "Users access tasks via own boards" on project_tasks
  for all
  using (
    exists (
      select 1 from project_boards b
      where b.id = project_tasks.board_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from project_boards b
      where b.id = project_tasks.board_id
        and b.user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function update_project_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_project_tasks_updated_at on project_tasks;
create trigger trg_project_tasks_updated_at
  before update on project_tasks
  for each row execute function update_project_tasks_updated_at();

-- ============================================================
-- project_task_comments
-- ============================================================
create table if not exists project_task_comments (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references project_tasks(id) on delete cascade,
  author_profile_id   uuid references profiles(id) on delete set null,
  body                text not null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_project_task_comments_task
  on project_task_comments(task_id, created_at asc);

alter table project_task_comments enable row level security;

drop policy if exists "Users access comments via own boards" on project_task_comments;
create policy "Users access comments via own boards" on project_task_comments
  for all
  using (
    exists (
      select 1
      from project_tasks t
      join project_boards b on b.id = t.board_id
      where t.id = project_task_comments.task_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from project_tasks t
      join project_boards b on b.id = t.board_id
      where t.id = project_task_comments.task_id
        and b.user_id = auth.uid()
    )
  );
