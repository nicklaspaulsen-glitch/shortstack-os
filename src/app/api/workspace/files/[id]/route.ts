/**
 * Workspace Files — single-file detail + delete.
 *
 * GET    /api/workspace/files/[id]   — fetch row
 * DELETE /api/workspace/files/[id]   — drop the row + the R2 object
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { deleteFromR2 } from "@/lib/server/r2-client";
import { getOwnedFile, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fileId = ctx.params.id;
  if (!isUuid(fileId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const file = await getOwnedFile(supabase, fileId, ownerId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ file });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fileId = ctx.params.id;
  if (!isUuid(fileId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const file = await getOwnedFile(supabase, fileId, ownerId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("workspace_files")
    .delete()
    .eq("id", fileId)
    .eq("agency_owner_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort R2 delete. Log but don't surface failure — the DB pointer is
  // gone, the object is unreachable through the app, and a sweeper can mop
  // up any orphan if needed.
  try {
    await deleteFromR2(file.r2_key);
  } catch (err) {
    console.error("[workspace/files] R2 delete failed for key", file.r2_key, err);
  }

  return NextResponse.json({ success: true });
}
