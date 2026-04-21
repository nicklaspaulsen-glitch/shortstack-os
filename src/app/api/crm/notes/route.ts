import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/crm/notes — list. Optional ?lead_id=
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = request.nextUrl.searchParams.get("lead_id");

  let q = supabase
    .from("lead_notes")
    .select("*")
    .eq("profile_id", ownerId)
    .order("created_at", { ascending: false });
  if (leadId) q = q.eq("lead_id", leadId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, notes: data || [] });
}

// POST /api/crm/notes — create. Body: { lead_id, body }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, body: noteBody } = (await request.json()) as { lead_id?: string; body?: string };
  if (!lead_id || !noteBody) {
    return NextResponse.json({ error: "lead_id and body are required" }, { status: 400 });
  }

  // Ensure the lead is owned by this agency
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", lead_id)
    .single();
  if (!lead || lead.user_id !== ownerId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ profile_id: ownerId, lead_id, body: noteBody })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, note: data });
}

// PATCH /api/crm/notes — update. Body: { id, body }
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, body: noteBody } = (await request.json()) as { id?: string; body?: string };
  if (!id || !noteBody) {
    return NextResponse.json({ error: "id and body are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_notes")
    .update({ body: noteBody, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", ownerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, note: data });
}

// DELETE /api/crm/notes?id=xyz
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const { error } = await supabase
    .from("lead_notes")
    .delete()
    .eq("id", id)
    .eq("profile_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
