import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const ALLOWED_STATUS = ["backlog", "todo", "in_progress", "review", "done"] as const;
const ALLOWED_PRIORITY = ["low", "medium", "high", "urgent"] as const;

/** Verify that the board belongs to the caller's agency. Returns the board row
 *  (or null when access denied — caller maps to 403/404). */
async function assertBoardAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  boardId: string,
  ownerId: string,
) {
  const { data } = await supabase
    .from("project_boards")
    .select("id, user_id")
    .eq("id", boardId)
    .eq("user_id", ownerId)
    .single();
  return data ?? null;
}

// GET /api/projects/boards/[id]/tasks — list all tasks in a board.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const board = await assertBoardAccess(supabase, params.id, ownerId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("board_id", params.id)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

// POST /api/projects/boards/[id]/tasks — create a new task.
// Body: { title, description?, status?, priority?, assignee_profile_id?, due_date? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const board = await assertBoardAccess(supabase, params.id, ownerId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const status = typeof body.status === "string" && (ALLOWED_STATUS as readonly string[]).includes(body.status)
    ? body.status
    : "backlog";
  const priority = typeof body.priority === "string" && (ALLOWED_PRIORITY as readonly string[]).includes(body.priority)
    ? body.priority
    : "medium";

  const description = typeof body.description === "string" ? body.description : null;
  const assignee = typeof body.assignee_profile_id === "string" ? body.assignee_profile_id : null;
  const dueDate = typeof body.due_date === "string" ? body.due_date : null;

  // Compute next position at the end of the target column.
  const { data: last } = await supabase
    .from("project_tasks")
    .select("position")
    .eq("board_id", params.id)
    .eq("status", status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("project_tasks")
    .insert({
      board_id: params.id,
      title,
      description,
      status,
      priority,
      assignee_profile_id: assignee,
      due_date: dueDate,
      position: nextPosition,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
