/**
 * Portal Tasks
 *
 * GET  /api/portal/[clientId]/tasks
 *   Lists client_tasks for the client, ordered by due_date ascending
 *   (NULLs last), completed tasks sunk to the bottom.
 *
 * POST /api/portal/[clientId]/tasks
 *   body: { title: string, description?: string, due_date?: string }
 *   Agency-only: creates a new task on behalf of the client.
 *
 * PATCH /api/portal/[clientId]/tasks
 *   body: { id: string, is_completed?: boolean, title?, description?, due_date? }
 *   Client can mark their tasks complete. Agency can edit anything.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

function isAgencyRole(role: string | null) {
  return role === "admin" || role === "founder" || role === "agency" || role === "team_member";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { data: tasks, error } = await service
    .from("client_tasks")
    .select("id, title, description, is_completed, completed_at, due_date, assigned_to, created_at")
    .eq("client_id", params.clientId)
    .order("is_completed", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[portal tasks] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: tasks || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only agency roles can create tasks — clients read/complete only
  if (!isAgencyRole(access.role)) {
    return NextResponse.json(
      { error: "Only the agency can add tasks" },
      { status: 403 },
    );
  }

  let body: {
    title?: string;
    description?: string;
    due_date?: string;
    assigned_to?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: task, error } = await service
    .from("client_tasks")
    .insert({
      client_id: params.clientId,
      title,
      description: body.description || null,
      due_date: body.due_date || null,
      assigned_to: body.assigned_to || null,
      is_completed: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[portal tasks] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    id?: string;
    is_completed?: boolean;
    title?: string;
    description?: string;
    due_date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify the task belongs to this client
  const { data: existing } = await service
    .from("client_tasks")
    .select("id, client_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing || existing.client_id !== params.clientId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.is_completed === "boolean") {
    update.is_completed = body.is_completed;
    update.completed_at = body.is_completed ? new Date().toISOString() : null;
  }
  // Only agency roles can edit title / description / due_date
  if (isAgencyRole(access.role)) {
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.description === "string") update.description = body.description;
    if (typeof body.due_date === "string") update.due_date = body.due_date || null;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "No changes requested" }, { status: 400 });
  }

  const { data: task, error } = await service
    .from("client_tasks")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    console.error("[portal tasks] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task });
}
