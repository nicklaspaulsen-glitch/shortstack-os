-- Workspace Files — Drive-style shared workspace file system on Cloudflare R2.
--
-- One of three Workspace surfaces (Board, Files, Whiteboard) being built in
-- parallel. This migration covers ONLY the file system: a folder tree per
-- agency owner, plus file rows that point at R2 objects (object bytes never
-- live in Postgres).
--
-- Folders form the directory tree. parent_id NULL = root folder for that
-- owner. Special "system" folders (Workspace, Templates, Brand, Clients) are
-- auto-created on first GET by the API; users can create their own subfolders.
--
-- Note on team_members linkage: the column is `member_profile_id`, NOT
-- `profile_id`. See 20260417_team_members.sql line 7. The team-read RLS
-- policy below uses the correct column.

CREATE TABLE public.workspace_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.workspace_folders(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  permission text NOT NULL DEFAULT 'team_write'
    CHECK (permission IN ('owner_only','team_read','team_write','client_can_view')),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Two folders cannot share the same name under the same parent for the same
  -- agency owner. Root folders (parent_id NULL) are deduped via the partial
  -- index below; non-root via this UNIQUE constraint.
  UNIQUE (agency_owner_id, parent_id, name)
);

-- Postgres treats NULL as distinct, so the UNIQUE above doesn't catch two
-- root folders with the same name. Add a partial unique index so root-level
-- duplicates are rejected too.
CREATE UNIQUE INDEX idx_workspace_folders_root_unique
  ON public.workspace_folders (agency_owner_id, name)
  WHERE parent_id IS NULL;

CREATE TABLE public.workspace_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.workspace_folders(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  -- Pre-signed PUT flow: row is inserted with status='pending' and r2_key set
  -- BEFORE the actual upload happens. The follow-up /finalize call HEADs the
  -- object and flips status to 'ready'. Stale 'pending' rows older than ~1h
  -- can be GC'd by a future cron.
  r2_key text NOT NULL UNIQUE,
  r2_public_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ready','failed')),
  uploaded_by uuid REFERENCES public.profiles(id),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','thumbnail_editor','video_editor','ai_studio','client_portal')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_folders_owner_parent
  ON public.workspace_folders(agency_owner_id, parent_id);
CREATE INDEX idx_workspace_files_folder
  ON public.workspace_files(folder_id, created_at DESC);
CREATE INDEX idx_workspace_files_owner_client
  ON public.workspace_files(agency_owner_id, client_id);

ALTER TABLE public.workspace_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- Agency owner: full CRUD on their own folders/files.
CREATE POLICY "folders_owner_all" ON public.workspace_folders
  FOR ALL USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

CREATE POLICY "files_owner_all" ON public.workspace_files
  FOR ALL USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Team members read agency folders/files. Writes flow through the API which
-- uses service-role for non-owner team_member calls (the route resolves
-- effective owner via getEffectiveOwnerId).
--
-- IMPORTANT: team_members.member_profile_id (not profile_id). Filter by
-- status='active' so a removed/suspended member can't keep reading files.
CREATE POLICY "folders_team_read" ON public.workspace_folders
  FOR SELECT USING (
    agency_owner_id IN (
      SELECT agency_owner_id
      FROM public.team_members
      WHERE member_profile_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "files_team_read" ON public.workspace_files
  FOR SELECT USING (
    agency_owner_id IN (
      SELECT agency_owner_id
      FROM public.team_members
      WHERE member_profile_id = auth.uid()
        AND status = 'active'
    )
  );
