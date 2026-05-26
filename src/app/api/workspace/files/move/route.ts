/**
 * Workspace Files — bulk move.
 *
 * POST /api/workspace/files/move
 *   Body: { file_ids: uuid[], target_folder_id: uuid }
 *
 * Moves up to 200 files into a target folder in a single update. We don't
 * relocate the underlying R2 objects — the key includes the original folder
 * id, but R2 moves are expensive and the public URL stays stable, so a logical
 * move-via-DB-pointer is the right tradeoff for this MVP.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { getOwnedFolder, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";

const MAX_MOVE = 200;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const fileIds = Array.isArray(body?.file_ids) ? body.file_ids : null;
  const targetId = body?.target_folder_id;

  if (!fileIds || fileIds.length === 0 || fileIds.length > MAX_MOVE) {
    return NextResponse.json({ error: `file_ids must be 1..${MAX_MOVE} uuids` }, { status: 400 });
  }
  if (!fileIds.every((x: unknown) => isUuid(x))) {
    return NextResponse.json({ error: "file_ids must all be uuids" }, { status: 400 });
  }
  if (!targetId || !isUuid(targetId)) {
    return NextResponse.json({ error: "target_folder_id (uuid) required" }, { status: 400 });
  }

  const target = await getOwnedFolder(supabase, targetId, ownerId);
  if (!target) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("workspace_files")
    .update({ folder_id: targetId })
    .in("id", fileIds)
    .eq("agency_owner_id", ownerId)
    .select("id, folder_id");

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

  return NextResponse.json({ success: true, moved: data?.length ?? 0 });
}
