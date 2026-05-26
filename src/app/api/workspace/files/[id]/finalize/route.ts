/**
 * Workspace Files — finalize upload.
 *
 * POST /api/workspace/files/[id]/finalize
 *
 * Called by the browser after a successful PUT to the presigned URL. Verifies
 * the object actually exists in R2 (HeadObject) and flips the row from
 * 'pending' → 'ready'. Idempotent: calling finalize on an already-ready row
 * is a no-op.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { r2ObjectExists } from "@/lib/server/r2-client";
import { getOwnedFile, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: { id: string };
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
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

  if (file.status === "ready") {
    return NextResponse.json({ file, already_ready: true });
  }

  const exists = await r2ObjectExists(file.r2_key);
  if (!exists) {
    // Mark the row as failed so the UI can offer a retry. We don't delete it
    // outright because the caller may retry the PUT and re-finalize.
    await supabase
      .from("workspace_files")
      .update({ status: "failed" })
      .eq("id", fileId)
      .eq("agency_owner_id", ownerId);
    return NextResponse.json(
      { error: "Object not found in R2 — upload likely never completed" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("workspace_files")
    .update({ status: "ready" })
    .eq("id", fileId)
    .eq("agency_owner_id", ownerId)
    .select(
      "id, agency_owner_id, folder_id, client_id, name, size_bytes, mime_type, r2_key, r2_public_url, status, source, uploaded_by, metadata, created_at",
    )
    .single();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ file: data });
}
