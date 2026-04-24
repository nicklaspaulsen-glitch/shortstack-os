import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { emitEventAsync } from "@/lib/activity/emit";

const ALLOWED_STATUS = ["backlog", "todo", "in_progress", "review", "done"] as const;
const ALLOWED_PRIORITY = ["low", "medium", "high", "urgent"] as const;

/** Verify the caller owns the board that contains this task. */
async function assertTaskAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  taskId: string,
  ownerId: string,
) {
  const { data } = await supabase
    .from("project_tasks")
    .select("id, board_id, status, position, project_boards!inner(user_id)")
    .eq("id", taskId)
    .eq("project_boards.user_id", ownerId)
    .single();
  return data ?? null;
}

// PATCH /api/projects/tasks/[id] — update any writable task field.
// Common use: drag-drop column changes (status + position).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const existing = await assertTaskAccess(supabase, params.id, ownerId);
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.description === "string" || body.description === null) {
    updates.description = body.description;
  }
  if (typeof body.status === "string") {
    if (!(ALLOWED_STATUS as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (typeof body.priority === "string") {
    if (!(ALLOWED_PRIORITY as readonly string[]).includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = body.priority;
  }
  if (typeof body.assignee_profile_id === "string" || body.assignee_profile_id === null) {
    updates.assignee_profile_id = body.assignee_profile_id;
  }
  if (typeof body.due_date === "string" || body.due_date === null) {
    updates.due_date = body.due_date;
  }
  if (typeof body.position === "number") {
    updates.position = Math.max(0, Math.trunc(body.position));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If status changed and no explicit position sent, append to the end of the new column.
  if (typeof updates.status === "string" && updates.status !== existing.status && updates.position === undefined) {
    const { data: last } = await supabase
      .from("project_tasks")
      .select("position")
      .eq("board_id", existing.board_id)
      .eq("status", updates.status)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    updates.position = (last?.position ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("project_tasks")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Activity feed — emit task_completed when status flips TO done, otherwise
  // emit task_assigned if an assignee was newly set. Fire-and-forget.
  if (typeof updates.status === "string" && updates.status === "done" && existing.status !== "done") {
    emitEventAsync({
      orgId: ownerId,
      actorId: user.id,
      eventType: "task_completed",
      subjectType: "project_task",
      subjectId: params.id,
      subjectPreview: { title: data.title },
      projectId: existing.board_id,
      visibility: "org",
    });
  } else if (typeof updates.assignee_profile_id === "string" && updates.assignee_profile_id) {
    emitEventAsync({
      orgId: ownerId,
      actorId: user.id,
      eventType: "task_assigned",
      subjectType: "project_task",
      subjectId: params.id,
      subjectPreview: { title: data.title, assignee: updates.assignee_profile_id },
      projectId: existing.board_id,
      visibility: "org",
    });
  }

  return NextResponse.json({ task: data });
}

// DELETE /api/projects/tasks/[id] — remove a task (cascades to comments).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const existing = await assertTaskAccess(supabase, params.id, ownerId);
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
