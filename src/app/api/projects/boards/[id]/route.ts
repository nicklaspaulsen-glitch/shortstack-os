import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/projects/boards/[id] — fetch a single board (with tasks).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: board, error: boardErr } = await supabase
    .from("project_boards")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();

  if (boardErr || !board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const { data: tasks, error: tasksErr } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("board_id", board.id)
    .order("position", { ascending: true });

  if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 });

  return NextResponse.json({ board, tasks: tasks ?? [] });
}

// PATCH /api/projects/boards/[id] — update name/icon/color/client.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["name", "icon", "color", "client_id"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If changing client_id, ensure it still belongs to the owner.
  if (typeof updates.client_id === "string" && updates.client_id) {
    const { data: c } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", updates.client_id as string)
      .single();
    if (!c || c.profile_id !== ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("project_boards")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  return NextResponse.json({ board: data });
}

// DELETE /api/projects/boards/[id] — delete a board (cascades to tasks/comments).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { error } = await supabase
    .from("project_boards")
    .delete()
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
