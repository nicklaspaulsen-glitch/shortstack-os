/**
 * Workspace Files — list files in a folder.
 *
 * GET /api/workspace/files?folder_id=<uuid>
 *   Returns all files in the folder, newest first. Only files in 'ready'
 *   status are returned by default — callers that need to see in-flight
 *   uploads can pass ?include_pending=1.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { getOwnedFolder, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder_id");
  if (!folderId || !isUuid(folderId)) {
    return NextResponse.json({ error: "folder_id (uuid) is required" }, { status: 400 });
  }

  const folder = await getOwnedFolder(supabase, folderId, ownerId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const includePending = url.searchParams.get("include_pending") === "1";

  let q = supabase
    .from("workspace_files")
    .select(
      "id, agency_owner_id, folder_id, client_id, name, size_bytes, mime_type, r2_key, r2_public_url, status, source, uploaded_by, metadata, created_at",
    )
    .eq("agency_owner_id", ownerId)
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!includePending) q = q.eq("status", "ready");

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

  return NextResponse.json({ files: data ?? [] });
}
