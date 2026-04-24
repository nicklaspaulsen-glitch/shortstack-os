import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: { id: string } };

// GET /api/team-sync/folders/[id]/members
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: folder } = await service
    .from("syncthing_folders")
    .select("owner_user_id")
    .eq("id", params.id)
    .single();
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  if (folder.owner_user_id !== user.id) {
    const { data: membership } = await service
      .from("syncthing_folder_members")
      .select("user_id")
      .eq("folder_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("syncthing_folder_members")
    .select("folder_id, user_id, permission, added_at")
    .eq("folder_id", params.id)
    .order("added_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (data ?? []).map((m) => m.user_id);
  let profileMap = new Map<string, { email?: string; full_name?: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email, full_name: p.full_name }])
    );
  }

  const members = (data ?? []).map((m) => ({ ...m, profile: profileMap.get(m.user_id) ?? null }));
  return NextResponse.json({ members });
}

// POST /api/team-sync/folders/[id]/members - owner only.
// Body: { user_id?: string, email?: string, permission?: string }
export async function POST(request: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  let memberUserId: string = (body.user_id ?? "").toString();
  const email: string = (body.email ?? "").toString().trim().toLowerCase();
  const permission: string = (body.permission ?? "send-receive").toString();

  const service = createServiceClient();

  const { data: folder } = await service
    .from("syncthing_folders")
    .select("owner_user_id")
    .eq("id", params.id)
    .single();
  if (!folder || folder.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!memberUserId && email) {
    const { data: prof } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!prof) return NextResponse.json({ error: "No team user with that email" }, { status: 404 });
    memberUserId = prof.id;
  }

  if (!memberUserId) return NextResponse.json({ error: "user_id or email required" }, { status: 400 });

  const allowedPerms = ["send-only", "receive-only", "send-receive"];
  if (!allowedPerms.includes(permission)) {
    return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
  }

  const { data, error } = await service
    .from("syncthing_folder_members")
    .upsert(
      { folder_id: params.id, user_id: memberUserId, permission },
      { onConflict: "folder_id,user_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

// DELETE /api/team-sync/folders/[id]/members?user_id=<uuid>
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberUserId = new URL(request.url).searchParams.get("user_id");
  if (!memberUserId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: folder } = await service
    .from("syncthing_folders")
    .select("owner_user_id")
    .eq("id", params.id)
    .single();
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  if (folder.owner_user_id !== user.id && memberUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .from("syncthing_folder_members")
    .delete()
    .eq("folder_id", params.id)
    .eq("user_id", memberUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
