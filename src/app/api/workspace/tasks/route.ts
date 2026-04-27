import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  TASK_STATUSES,
  TASK_TYPES,
  createTaskSchema,
  groupByStatus,
  nextPosition,
  type ListFilters,
  type WorkspaceTask,
  type TaskStatus,
} from "@/lib/workspace/board";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/tasks
 *
 * Returns the agency's tasks, optionally filtered. Always returns both a
 * flat `tasks` array (preserving order) and a `by_status` map keyed by the
 * four canonical board columns so the UI can render the kanban board with
 * a single fetch.
 *
 * Filters (all optional, pass via query string):
 *   • status        — backlog | in_progress | review | done
 *   • assignee_id   — uuid of a team_members row
 *   • client_id     — uuid of a clients row
 *   • type          — video|thumbnail|post|copy|ad|brief|call|generic
 *   • due_before    — ISO timestamp; tasks with due_at strictly before this
 *   • view          — `my_tasks` (caller's assignees) or `due_this_week`
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const filters: ListFilters = {
    status: sp.get("status") as TaskStatus | undefined,
    assignee_id: sp.get("assignee_id") || undefined,
    client_id: sp.get("client_id") || undefined,
    type: (sp.get("type") as ListFilters["type"]) || undefined,
    due_before: sp.get("due_before") || undefined,
    view: (sp.get("view") as ListFilters["view"]) || undefined,
  };

  // Normalize unknown enum values defensively — never trust query strings.
  if (filters.status && !TASK_STATUSES.includes(filters.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (filters.type && !TASK_TYPES.includes(filters.type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  let q = supabase
    .from("workspace_tasks")
    .select("*")
    .eq("agency_owner_id", ownerId);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.assignee_id) q = q.eq("assignee_id", filters.assignee_id);
  if (filters.client_id) q = q.eq("client_id", filters.client_id);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.due_before) q = q.lt("due_at", filters.due_before);

  if (filters.view === "my_tasks") {
    // Resolve caller's team_members row (if any) and scope to that assignee.
    // If the caller is the agency owner with no team_members row, fall back
    // to "tasks I created" — useful for the solo agency owner persona.
    const { data: tm } = await supabase
      .from("team_members")
      .select("id")
      .eq("member_profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (tm?.id) {
      q = q.eq("assignee_id", tm.id);
    } else {
      q = q.eq("created_by", user.id);
    }
  }

  if (filters.view === "due_this_week") {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    q = q
      .neq("status", "done")
      .gte("due_at", now.toISOString())
      .lte("due_at", weekAhead.toISOString());
  }

  // Stable order per column: position ASC, then created_at ASC for ties.
  const { data, error } = await q
    .order("status", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[workspace-board] list error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (data || []) as WorkspaceTask[];
  return NextResponse.json({
    tasks,
    by_status: groupByStatus(tasks),
    total: tasks.length,
  });
}

/**
 * POST /api/workspace/tasks
 *
 * Create a new task. `agency_owner_id` is auto-filled from the resolved
 * effective owner (handles team_member callers). `position` is appended to
 * the bottom of the destination column.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Defense in depth: when a team_member is creating a task, RLS will block
  // an INSERT with a foreign agency_owner_id, but we set it explicitly here
  // so the row goes to the right place.
  const position = await nextPosition(supabase, ownerId, input.status);

  const { data, error } = await supabase
    .from("workspace_tasks")
    .insert({
      agency_owner_id: ownerId,
      client_id: input.client_id ?? null,
      assignee_id: input.assignee_id ?? null,
      title: input.title,
      description: input.description ?? "",
      type: input.type,
      status: input.status,
      priority: input.priority,
      due_at: input.due_at ?? null,
      attachments: input.attachments ?? [],
      created_by: user.id,
      position,
    })
    .select()
    .single();

  if (error) {
    console.error("[workspace-board] create error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
