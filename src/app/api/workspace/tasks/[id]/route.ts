import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  patchTaskSchema,
  type WorkspaceTask,
  type WorkspaceTaskComment,
} from "@/lib/workspace/board";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/tasks/[id]
 *
 * Returns the task with its comments. RLS gates ownership — a non-member of
 * the agency gets a row count of 0 and we surface that as a 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = params.id;
  const { data: task, error: taskErr } = await supabase
    .from("workspace_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskErr) {
    console.error("[workspace-board] detail fetch error", taskErr);
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: comments, error: cErr } = await supabase
    .from("workspace_task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (cErr) {
    console.error("[workspace-board] comments fetch error", cErr);
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  return NextResponse.json({
    task: task as WorkspaceTask,
    comments: (comments || []) as WorkspaceTaskComment[],
  });
}

/**
 * PATCH /api/workspace/tasks/[id]
 *
 * Update any writable field. Drag-drop column changes pass `{status, position}`.
 * Field-level RLS handles authorization — team_members can only patch their
 * own assigned tasks (or unassigned ones).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_tasks")
    .update(updates)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[workspace-board] patch error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!data) {
    // Row didn't update — either it doesn't exist or RLS hid it from this
    // caller. Either way, surface as 404 to avoid leaking existence.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ task: data });
}

/**
 * DELETE /api/workspace/tasks/[id]
 *
 * Hard delete — RLS gates ownership (only the agency owner can delete).
 * Cascades to comments via the FK.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve effective owner so a team_member can delete only when they ARE
  // the agency owner — RLS would block the delete anyway, but a 403 here is
  // friendlier than the silent-noop a DELETE-with-no-matching-rows produces.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId || ownerId !== user.id) {
    return NextResponse.json(
      { error: "Only the agency owner can delete tasks" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("workspace_tasks")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[workspace-board] delete error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
