-- Workflows
-- Persists user-built automation workflows (nodes + edges) from the workflow-builder
-- dashboard page. Saving the same name for the same user upserts via the
-- (user_id, name) unique constraint.

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_user_name_unique unique (user_id, name)
);

create index if not exists idx_workflows_user on workflows(user_id);
create index if not exists idx_workflows_updated_at on workflows(updated_at desc);

alter table workflows enable row level security;

drop policy if exists "Users manage own workflows" on workflows;
create policy "Users manage own workflows" on workflows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-update updated_at on row change
create or replace function update_workflows_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_workflows_updated_at on workflows;
create trigger trg_workflows_updated_at
  before update on workflows
  for each row execute function update_workflows_updated_at();
