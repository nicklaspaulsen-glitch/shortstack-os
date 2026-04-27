-- Workspace Board: Trello/Monday-style task board for agency teams.
-- Tables: workspace_tasks (cards) + workspace_task_comments (threaded comments).
--
-- RLS strategy
-- ------------
-- The agency owner (profiles.id == auth.uid()) has full access to every task
-- they own. Team members of the same agency get read access plus write access
-- on tasks assigned to them OR unassigned tasks in their agency. Comments
-- inherit access from the parent task.
--
-- Note on team_members column: schema in this project uses
-- `member_profile_id` (verified via information_schema). Older comments in the
-- repo refer to `profile_id`; we use the canonical `member_profile_id` here.

CREATE TABLE IF NOT EXISTS public.workspace_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'generic'
    CHECK (type IN ('video','thumbnail','post','copy','ad','brief','call','generic')),
  status text NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog','in_progress','review','done')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  due_at timestamptz,
  position int NOT NULL DEFAULT 0,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_owner_status
  ON public.workspace_tasks(agency_owner_id, status, position);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_assignee
  ON public.workspace_tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_client
  ON public.workspace_tasks(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_due
  ON public.workspace_tasks(due_at) WHERE status <> 'done';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.workspace_tasks_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_tasks_updated_at ON public.workspace_tasks;
CREATE TRIGGER trg_workspace_tasks_updated_at
  BEFORE UPDATE ON public.workspace_tasks
  FOR EACH ROW EXECUTE FUNCTION public.workspace_tasks_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.workspace_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_comments_task
  ON public.workspace_task_comments(task_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_owner_all" ON public.workspace_tasks;
CREATE POLICY "tasks_owner_all" ON public.workspace_tasks
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Team members of the agency can read all agency tasks.
DROP POLICY IF EXISTS "tasks_team_read" ON public.workspace_tasks;
CREATE POLICY "tasks_team_read" ON public.workspace_tasks
  FOR SELECT
  USING (
    agency_owner_id IN (
      SELECT tm.agency_owner_id
      FROM public.team_members tm
      WHERE tm.member_profile_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Team members can update tasks assigned to them or unassigned tasks
-- in their agency. Status, position, priority, description, attachments are
-- all updatable; ownership column is immutable from the team_member side.
DROP POLICY IF EXISTS "tasks_team_update" ON public.workspace_tasks;
CREATE POLICY "tasks_team_update" ON public.workspace_tasks
  FOR UPDATE
  USING (
    agency_owner_id IN (
      SELECT tm.agency_owner_id
      FROM public.team_members tm
      WHERE tm.member_profile_id = auth.uid()
        AND tm.status = 'active'
    )
    AND (
      assignee_id IS NULL
      OR assignee_id IN (
        SELECT tm.id
        FROM public.team_members tm
        WHERE tm.member_profile_id = auth.uid()
          AND tm.status = 'active'
      )
    )
  )
  WITH CHECK (
    agency_owner_id IN (
      SELECT tm.agency_owner_id
      FROM public.team_members tm
      WHERE tm.member_profile_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Comments policy:
--   • Owner of the parent task: full access.
--   • Comment author: read & delete their own.
--   • Team members of the agency: read all agency comments + author new ones.
DROP POLICY IF EXISTS "comments_owner_all" ON public.workspace_task_comments;
CREATE POLICY "comments_owner_all" ON public.workspace_task_comments
  FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.workspace_tasks WHERE agency_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT id FROM public.workspace_tasks WHERE agency_owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comments_author_self" ON public.workspace_task_comments;
CREATE POLICY "comments_author_self" ON public.workspace_task_comments
  FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "comments_team_read" ON public.workspace_task_comments;
CREATE POLICY "comments_team_read" ON public.workspace_task_comments
  FOR SELECT
  USING (
    task_id IN (
      SELECT t.id
      FROM public.workspace_tasks t
      JOIN public.team_members tm
        ON tm.agency_owner_id = t.agency_owner_id
      WHERE tm.member_profile_id = auth.uid()
        AND tm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "comments_team_insert" ON public.workspace_task_comments;
CREATE POLICY "comments_team_insert" ON public.workspace_task_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND task_id IN (
      SELECT t.id
      FROM public.workspace_tasks t
      JOIN public.team_members tm
        ON tm.agency_owner_id = t.agency_owner_id
      WHERE tm.member_profile_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Realtime: enable replication for live drag-drop updates between teammates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_tasks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_tasks';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_task_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_comments';
  END IF;
END$$;
