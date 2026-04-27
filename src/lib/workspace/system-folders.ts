/**
 * Workspace Files — system folder bootstrap.
 *
 * Every agency owner gets four "system" folders on first GET to /api/workspace/folders:
 *   • Workspace      — generic shared scratchpad
 *   • Templates      — reusable briefs / scripts / outline assets
 *   • Brand assets   — logos, colour swatches, fonts, imagery
 *   • Clients        — top-level container; per-client subfolders auto-created elsewhere
 *
 * We INSERT … ON CONFLICT DO NOTHING so the bootstrap is safe to call on every
 * GET. The unique (agency_owner_id, parent_id, name) constraint plus the
 * partial root-uniqueness index in the migration de-duplicate.
 *
 * The seed runs against the SERVICE-ROLE Supabase client so that a freshly-
 * created agency profile (where the user-scoped `auth.uid()` may not yet have
 * a row in profiles) doesn't trip RLS during the bootstrap.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface SystemFolderSeed {
  name: string;
  permission: "owner_only" | "team_read" | "team_write" | "client_can_view";
}

export const SYSTEM_FOLDERS: ReadonlyArray<SystemFolderSeed> = [
  { name: "Workspace", permission: "team_write" },
  { name: "Templates", permission: "team_write" },
  { name: "Brand assets", permission: "team_read" },
  { name: "Clients", permission: "team_write" },
] as const;

/**
 * Insert system folders for an agency owner if they don't already exist.
 * Idempotent — safe to call on every list request.
 *
 * @param service Service-role Supabase client (bypasses RLS).
 * @param ownerId Agency owner profile id.
 */
export async function ensureSystemFolders(
  service: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const rows = SYSTEM_FOLDERS.map((f) => ({
    agency_owner_id: ownerId,
    parent_id: null,
    name: f.name,
    permission: f.permission,
    is_system: true,
  }));

  // ON CONFLICT DO NOTHING via .upsert with ignoreDuplicates=true. The unique
  // index (agency_owner_id, name) WHERE parent_id IS NULL handles dedup.
  const { error } = await service
    .from("workspace_folders")
    .upsert(rows, {
      onConflict: "agency_owner_id,parent_id,name",
      ignoreDuplicates: true,
    });

  if (error) {
    // Don't throw — the bootstrap is best-effort. The list query that follows
    // will still succeed (it just won't have system folders). Worst case the
    // owner sees an empty root and creates folders manually.
    console.error("[workspace/system-folders] ensure failed:", error.message);
  }
}
