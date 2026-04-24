import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { emitEventAsync } from "@/lib/activity/emit";

// GET /api/projects/boards — list all boards owned by caller (team_members
// resolve to parent agency). Optional ?client_id=xxx filter.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");

  let query = supabase
    .from("project_boards")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ boards: data ?? [] });
}

// POST /api/projects/boards — create a new board.
// Body: { name, icon?, color?, client_id? }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  let body: { name?: unknown; icon?: unknown; color?: unknown; client_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const icon = typeof body.icon === "string" ? body.icon : null;
  const color = typeof body.color === "string" ? body.color : null;
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  // If client_id is provided, verify it belongs to this owner.
  if (clientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientId)
      .single();
    if (!c || c.profile_id !== ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("project_boards")
    .insert({
      user_id: ownerId,
      client_id: clientId,
      name,
      icon: icon ?? "kanban",
      color: color ?? "#C9A84C",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Activity feed — fire and forget; never blocks the response.
  emitEventAsync({
    orgId: ownerId,
    actorId: user.id,
    eventType: "project_launched",
    subjectType: "project_board",
    subjectId: data.id,
    subjectPreview: { title: data.name, icon: data.icon, color: data.color },
    projectId: data.id,
    visibility: "org",
  });

  return NextResponse.json({ board: data }, { status: 201 });
}
