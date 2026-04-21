/**
 * Portal Messages — client ↔ agency thread.
 *
 * GET /api/portal/[clientId]/messages
 *   Lists the thread, oldest first, capped at 500. Marks inbound messages
 *   (from the "other" side) as read_at=now() if they weren't already.
 *
 * POST /api/portal/[clientId]/messages
 *   body: { body: string }
 *   Sends a new message. sender_role is auto-derived from the caller's
 *   verified role — client portal user writes as 'client', agency owner
 *   writes as 'agency'. There's no way for a caller to impersonate the
 *   other side.
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

  const { data: messages, error } = await service
    .from("portal_messages")
    .select("id, client_id, sender_role, sender_profile_id, body, read_at, created_at")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[portal messages] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark inbound unread messages as read. "Inbound" = not sent by the caller's role.
  const callerIsAgency = isAgencyRole(access.role);
  const callerOwnRole = callerIsAgency ? "agency" : "client";
  const unreadIds = (messages || [])
    .filter((m) => !m.read_at && m.sender_role !== callerOwnRole)
    .map((m) => m.id);
  if (unreadIds.length) {
    await service
      .from("portal_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return NextResponse.json({
    messages: messages || [],
    role: callerOwnRole,
  });
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

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.body || "").trim();
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json(
      { error: "Message too long (8000 char max)" },
      { status: 400 },
    );
  }

  const senderRole = isAgencyRole(access.role) ? "agency" : "client";

  const service = createServiceClient();
  const { data: message, error } = await service
    .from("portal_messages")
    .insert({
      client_id: params.clientId,
      sender_role: senderRole,
      sender_profile_id: user.id,
      body: text,
    })
    .select()
    .single();

  if (error) {
    console.error("[portal messages] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message });
}
