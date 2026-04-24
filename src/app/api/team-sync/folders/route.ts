import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/team-sync/folders - returns folders the caller owns OR is a member of.
export async function GET(request: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org_id = new URL(request.url).searchParams.get("org_id");
  const service = createServiceClient();

  const ownedQ = service
    .from("syncthing_folders")
    .select("*")
    .eq("owner_user_id", user.id);
  if (org_id) ownedQ.eq("org_id", org_id);
  const { data: owned, error: ownedErr } = await ownedQ;
  if (ownedErr) return NextResponse.json({ error: ownedErr.message }, { status: 500 });

  const { data: memberships, error: mErr } = await service
    .from("syncthing_folder_members")
    .select("folder_id")
    .eq("user_id", user.id);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const memberIds = (memberships ?? [])
    .map((m) => m.folder_id)
    .filter((id) => !(owned ?? []).some((o) => o.id === id));

  type FolderRow = { id: string };
  let memberFolders: FolderRow[] = [];
  if (memberIds.length > 0) {
    const memberQ = service.from("syncthing_folders").select("*").in("id", memberIds);
    if (org_id) memberQ.eq("org_id", org_id);
    const { data: memberData, error: memberErr } = await memberQ;
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
    memberFolders = (memberData ?? []) as FolderRow[];
  }

  const all = [...(owned ?? []), ...memberFolders];
  return NextResponse.json({ folders: all });
}

// POST /api/team-sync/folders
// Body: { folder_id, folder_label?, path_hint?, org_id?, project_id? }
export async function POST(request: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const folder_id: string = (body.folder_id ?? "").toString().trim();
  const folder_label: string = (body.folder_label ?? "").toString().slice(0, 160);
  const path_hint: string = (body.path_hint ?? "").toString().slice(0, 500);
  const org_id: string | null = body.org_id ?? null;
  const project_id: string | null = body.project_id ?? null;

  if (!folder_id) return NextResponse.json({ error: "folder_id required" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("syncthing_folders")
    .insert({ owner_user_id: user.id, folder_id, folder_label, path_hint, org_id, project_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from("syncthing_folder_members").insert({
    folder_id: data.id,
    user_id: user.id,
    permission: "send-receive",
  });

  return NextResponse.json({ folder: data });
}
