import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: { id: string } };

// GET /api/team-sync/folders/[id]
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: folder, error } = await service
    .from("syncthing_folders")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (folder.owner_user_id !== user.id) {
    const { data: membership } = await service
      .from("syncthing_folder_members")
      .select("user_id")
      .eq("folder_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ folder });
}

// PATCH /api/team-sync/folders/[id] - owner only.
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.folder_label === "string") updates.folder_label = body.folder_label.slice(0, 160);
  if (typeof body.path_hint === "string") updates.path_hint = body.path_hint.slice(0, 500);
  if (body.project_id === null || typeof body.project_id === "string") updates.project_id = body.project_id;
  if (typeof body.size_gb === "number") updates.size_gb = body.size_gb;
  if (typeof body.file_count === "number") updates.file_count = body.file_count;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("syncthing_folders")
    .update(updates)
    .eq("id", params.id)
    .eq("owner_user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ folder: data });
}

// DELETE /api/team-sync/folders/[id] - owner only.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { error } = await service
    .from("syncthing_folders")
    .delete()
    .eq("id", params.id)
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
