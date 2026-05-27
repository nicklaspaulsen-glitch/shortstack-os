-- Fix: comments_author_self was FOR ALL, which allowed any authenticated user
-- to INSERT a comment on any task_id. Because the API route always sets
-- author_id = auth.uid(), the WITH CHECK (author_id = auth.uid()) condition
-- was always satisfied, bypassing the task-ownership checks in comments_owner_all
-- and comments_team_insert.
--
-- Fix: narrow to FOR SELECT so only the task-ownership policies (comments_owner_all
-- and comments_team_insert) gate INSERT/UPDATE/DELETE access.
DROP POLICY IF EXISTS "comments_author_self" ON public.workspace_task_comments;
CREATE POLICY "comments_author_self" ON public.workspace_task_comments
  FOR SELECT
  USING (author_id = auth.uid());
