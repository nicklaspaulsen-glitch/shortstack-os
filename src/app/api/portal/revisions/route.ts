/**
 * Portal Revision Request endpoint
 *
 * POST /api/portal/revisions
 *   body: { content_item_id?: string, revision_notes: string, priority?: 'low'|'normal'|'high'|'urgent' }
 *   Records a revision request on a delivered asset. Inserts into
 *   portal_revisions, fires a trinity_log entry, notifies the agency owner,
 *   and (best-effort) creates a project_task entry so the team sees it in
 *   their workflow queue.
 *
 * GET /api/portal/revisions
 *   Lists revision requests for the caller's client. Optional ?status=open|closed.
 *
 * PATCH /api/portal/revisions
 *   body: { id, status: 'open'|'in_progress'|'resolved', resolution_notes? }
 *   Agency-owner only. Used when team marks a revision done.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

type Priority = "low" | "normal" | "high" | "urgent";
const VALID_PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
const VALID_STATUSES = ["open", "in_progress", "resolved"];

async function resolvePortalClient(userId: string) {
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("profile_id", userId)
    .maybeSingle();
  return client;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const service = createServiceClient();

  let query = service
    .from("portal_revisions")
    .select("*")
    .eq("portal_user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revisions: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await resolvePortalClient(user.id);
  if (!client) {
    return NextResponse.json(
      { error: "No portal client linked to this account" },
      { status: 403 },
    );
  }

  let body: {
    content_item_id?: string;
    revision_notes?: string;
    requested_priority?: string;
    priority?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const notes = (body.revision_notes || "").trim();
  if (!notes) {
    return NextResponse.json(
      { error: "revision_notes required" },
      { status: 400 },
    );
  }
  if (notes.length > 4000) {
    return NextResponse.json(
      { error: "revision_notes exceeds 4000 characters" },
      { status: 400 },
    );
  }

  const priorityRaw = (body.priority || body.requested_priority || "normal").toLowerCase();
  const priority: Priority = VALID_PRIORITIES.includes(priorityRaw as Priority)
    ? (priorityRaw as Priority)
    : "normal";

  const service = createServiceClient();

  // If content_item_id is provided, verify it belongs to this client
  let contentTitle: string | null = null;
  if (body.content_item_id) {
    const { data: item } = await service
      .from("content_calendar")
      .select("id, client_id, title")
      .eq("id", body.content_item_id)
      .maybeSingle();
    if (!item || item.client_id !== client.id) {
      return NextResponse.json(
        { error: "Content item not found or not accessible" },
        { status: 404 },
      );
    }
    contentTitle = item.title;

    // Send the content item back to editing so the team sees it needs work
    await service
      .from("content_calendar")
      .update({
        status: "editing",
        notes: `[revision requested ${new Date().toISOString()}] ${notes}`,
      })
      .eq("id", body.content_item_id);
  }

  const { data: row, error: insertError } = await service
    .from("portal_revisions")
    .insert({
      portal_user_id: user.id,
      client_id: client.id,
      content_item_id: body.content_item_id || null,
      revision_notes: notes,
      priority,
      status: "open",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Trinity log entry
  await service.from("trinity_log").insert({
    agent: "content",
    action_type: "custom",
    description: `Revision requested${contentTitle ? ` on "${contentTitle}"` : ""} — ${notes.slice(0, 200)}`,
    client_id: client.id,
    status: "pending",
    result: {
      type: "client_request",
      category: "revision",
      revision_id: row.id,
      content_item_id: body.content_item_id || null,
      priority,
      message: notes,
    },
  });

  // Notify agency owner
  try {
    const { data: clientProfile } = await service
      .from("profiles")
      .select("parent_agency_id")
      .eq("id", client.profile_id)
      .maybeSingle();

    const ownerId = clientProfile?.parent_agency_id || client.profile_id;
    if (ownerId && ownerId !== user.id) {
      await service.from("notifications").insert({
        user_id: ownerId,
        title: `Revision requested${priority === "urgent" ? " (URGENT)" : ""}`,
        message: `${client.business_name || "Client"}: ${notes.slice(0, 140)}`,
        type: priority === "urgent" ? "alert" : "warning",
        link: "/dashboard/content-library",
      });
    }

    // Best-effort: create a project_task if the table is available
    try {
      await service.from("project_tasks").insert({
        client_id: client.id,
        title: `Revision: ${contentTitle || "Client requested changes"}`,
        description: notes,
        status: "todo",
        priority,
        assigned_to: ownerId,
        metadata: {
          source: "portal_revision",
          revision_id: row.id,
          content_item_id: body.content_item_id || null,
        },
      });
    } catch {
      // project_tasks may not have these columns — swallow
    }
  } catch (e) {
    console.warn("[portal revisions] notify failed:", e);
  }

  return NextResponse.json({ revision: row });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; status?: string; resolution_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || !body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "id and valid status (open|in_progress|resolved) required" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Verify caller is the agency owner of the related client
  const { data: existing } = await service
    .from("portal_revisions")
    .select("id, client_id, portal_user_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const isRequester = existing.portal_user_id === user.id;
  let isOwner = false;
  if (!isRequester) {
    const { data: client } = await service
      .from("clients")
      .select("profile_id")
      .eq("id", existing.client_id)
      .maybeSingle();
    if (client) {
      // The agency owner is the parent_agency of the client's linked profile
      const { data: clientProfile } = await service
        .from("profiles")
        .select("parent_agency_id")
        .eq("id", client.profile_id)
        .maybeSingle();
      const ownerId = clientProfile?.parent_agency_id || client.profile_id;
      isOwner = ownerId === user.id;
    }
  }
  if (!isRequester && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved") updates.resolved_at = new Date().toISOString();

  const { data, error } = await service
    .from("portal_revisions")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revision: data });
}
