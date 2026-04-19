import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/** Verify the caller owns the board that contains this task. */
async function assertTaskAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  taskId: string,
  ownerId: string,
) {
  const { data } = await supabase
    .from("project_tasks")
    .select("id, project_boards!inner(user_id)")
    .eq("id", taskId)
    .eq("project_boards.user_id", ownerId)
    .single();
  return data ?? null;
}

// GET /api/projects/tasks/[id]/comments — list comments on a task (oldest first).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const task = await assertTaskAccess(supabase, params.id, ownerId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("project_task_comments")
    .select("*")
    .eq("task_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

// POST /api/projects/tasks/[id]/comments — add a comment.
// Body: { body: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const task = await assertTaskAccess(supabase, params.id, ownerId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_task_comments")
    .insert({
      task_id: params.id,
      author_profile_id: user.id,
      body: text,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data }, { status: 201 });
}
