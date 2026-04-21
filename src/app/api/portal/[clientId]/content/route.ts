/**
 * Portal Content Approvals
 *
 * GET /api/portal/[clientId]/content
 *   Lists content_calendar items for the client (all platforms),
 *   ordered by scheduled_at asc with nulls last, then newest first.
 *
 * PATCH /api/portal/[clientId]/content
 *   body: { id: string, action: 'approve' | 'reject', notes?: string }
 *   approve -> status='approved_for_publish', stamps approved_by + approved_at
 *   reject  -> status='editing',  appends notes
 *
 * Either the portal-linked client OR the agency owner can approve or
 * reject (in practice clients approve and the agency sets up items).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

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

  const { data: items, error } = await service
    .from("content_calendar")
    .select(
      "id, title, platform, status, scheduled_at, published_at, live_url, notes, approved_at, approved_by, content_script_id, created_at",
    )
    .eq("client_id", params.clientId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[portal content] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: items || [] });
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

  let body: { id?: string; action?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json(
      { error: "id and action (approve|reject) required" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Verify the item belongs to this client
  const { data: existing } = await service
    .from("content_calendar")
    .select("id, client_id, notes")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing || existing.client_id !== params.clientId) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};

  if (body.action === "approve") {
    update.status = "approved_for_publish";
    update.approved_at = now;
    update.approved_by = user.id;
    if (body.notes) {
      const existingNotes = existing.notes ? `${existing.notes}\n\n` : "";
      update.notes = `${existingNotes}[approved ${now}] ${body.notes}`;
    }
  } else {
    // reject → send back to editing
    update.status = "editing";
    update.approved_at = null;
    update.approved_by = null;
    const rejectionNote = body.notes
      ? `[rejected ${now}] ${body.notes}`
      : `[rejected ${now}]`;
    const existingNotes = existing.notes ? `${existing.notes}\n\n` : "";
    update.notes = `${existingNotes}${rejectionNote}`;
  }

  const { data: item, error } = await service
    .from("content_calendar")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    console.error("[portal content] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item });
}
