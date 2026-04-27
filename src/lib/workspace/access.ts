/**
 * Workspace Files — folder/file ownership checks.
 *
 * The public API never trusts incoming folder_id / file_id without verifying
 * the row belongs to the resolved agency owner. RLS will do this for the
 * agency owner's own queries, but team_member calls that go through the
 * service-role client must be checked explicitly here.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface OwnedFolder {
  id: string;
  agency_owner_id: string;
  parent_id: string | null;
  name: string;
  permission: string;
  is_system: boolean;
  client_id: string | null;
}

export interface OwnedFile {
  id: string;
  agency_owner_id: string;
  folder_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  r2_key: string;
  r2_public_url: string | null;
  status: string;
  source: string;
  client_id: string | null;
  uploaded_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Fetch a folder and confirm it belongs to ownerId. Returns null on miss.
 * Pass the service-role client when called from a team_member context, or
 * the user-scoped client when called by the agency owner directly.
 */
export async function getOwnedFolder(
  client: SupabaseClient,
  folderId: string,
  ownerId: string,
): Promise<OwnedFolder | null> {
  const { data } = await client
    .from("workspace_folders")
    .select("id, agency_owner_id, parent_id, name, permission, is_system, client_id")
    .eq("id", folderId)
    .eq("agency_owner_id", ownerId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Fetch a file and confirm it belongs to ownerId. Returns null on miss.
 */
export async function getOwnedFile(
  client: SupabaseClient,
  fileId: string,
  ownerId: string,
): Promise<OwnedFile | null> {
  const { data } = await client
    .from("workspace_files")
    .select(
      "id, agency_owner_id, folder_id, name, size_bytes, mime_type, r2_key, r2_public_url, status, source, client_id, uploaded_by, metadata, created_at",
    )
    .eq("id", fileId)
    .eq("agency_owner_id", ownerId)
    .maybeSingle();
  return (data as OwnedFile | null) ?? null;
}

/** UUID v4 sanity check — used before query parameters hit Supabase. */
export function isUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}
