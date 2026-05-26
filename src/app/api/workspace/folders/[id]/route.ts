/**
 * Workspace Files — single-folder operations.
 *
 * PATCH  /api/workspace/folders/[id]   rename / change permission
 *   Body: { name?: string, permission?: 'owner_only'|'team_read'|'team_write'|'client_can_view' }
 *
 * DELETE /api/workspace/folders/[id]   recursive delete
 *   1. Resolve every descendant folder + every file under those folders.
 *   2. Delete the folder row — Postgres CASCADE drops the rest.
 *   3. Batch-delete the R2 objects (best-effort, non-blocking the response).
 *
 * System folders (is_system=true) cannot be deleted or renamed via this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { deleteFromR2Batch } from "@/lib/server/r2-client";
import { getOwnedFolder, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";

const ALLOWED_PERMISSIONS = [
  "owner_only",
  "team_read",
  "team_write",
  "client_can_view",
] as const;

type Permission = (typeof ALLOWED_PERMISSIONS)[number];

function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (ALLOWED_PERMISSIONS as readonly string[]).includes(v);
}

interface RouteCtx {
  params: { id: string };
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const folderId = ctx.params.id;
  if (!isUuid(folderId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const folder = await getOwnedFolder(supabase, folderId, ownerId);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.is_system) {
    return NextResponse.json({ error: "System folders cannot be modified" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const next = typeof body.name === "string" ? body.name.trim() : "";
    if (!next || next.length > 200) {
      return NextResponse.json({ error: "name must be 1-200 chars" }, { status: 400 });
    }
    updates.name = next;
  }

  if (body?.permission !== undefined) {
    if (!isPermission(body.permission)) {
      return NextResponse.json({ error: "invalid permission" }, { status: 400 });
    }
    updates.permission = body.permission;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_folders")
    .update(updates)
    .eq("id", folderId)
    .eq("agency_owner_id", ownerId)
    .select("id, agency_owner_id, parent_id, client_id, name, permission, is_system, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A folder with that name already exists here" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ folder: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const folderId = ctx.params.id;
  if (!isUuid(folderId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const folder = await getOwnedFolder(supabase, folderId, ownerId);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.is_system) {
    return NextResponse.json({ error: "System folders cannot be deleted" }, { status: 403 });
  }

  // Walk the subtree to collect descendant folder ids. Bounded at 1024
  // folders to keep the DB cost predictable; if a tree is bigger than that
  // we still let the cascade run (the R2 cleanup just won't be exhaustive
  // in the rare worst case — a future cron can sweep orphans).
  const descendantIds: string[] = [folderId];
  let frontier: string[] = [folderId];
  let safety = 0;
  while (frontier.length > 0 && safety < 1024) {
    safety += frontier.length;
    const { data: kids } = await supabase
      .from("workspace_folders")
      .select("id")
      .eq("agency_owner_id", ownerId)
      .in("parent_id", frontier);
    if (!kids || kids.length === 0) break;
    const next = kids.map((k) => k.id as string);
    descendantIds.push(...next);
    frontier = next;
  }

  // Collect every R2 key in the tree before we drop the rows.
  const { data: fileRows } = await supabase
    .from("workspace_files")
    .select("r2_key")
    .eq("agency_owner_id", ownerId)
    .in("folder_id", descendantIds);
  const r2Keys = (fileRows ?? []).map((r) => r.r2_key as string).filter(Boolean);

  // Delete the root folder; CASCADE removes descendant folders + their files.
  const { error } = await supabase
    .from("workspace_folders")
    .delete()
    .eq("id", folderId)
    .eq("agency_owner_id", ownerId);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

  // Best-effort R2 cleanup. Failures here don't fail the API call — the row
  // is already gone, and a sweeper job can clean up later if needed.
  if (r2Keys.length > 0) {
    await deleteFromR2Batch(r2Keys);
  }

  return NextResponse.json({ success: true, deleted_files: r2Keys.length });
}
