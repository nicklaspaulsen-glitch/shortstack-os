import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/crm/follow-ups — list. Optional ?lead_id=&status=
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = request.nextUrl.searchParams.get("lead_id");
  const status = request.nextUrl.searchParams.get("status");

  let q = supabase
    .from("lead_follow_ups")
    .select("*")
    .eq("profile_id", ownerId)
    .order("scheduled_for", { ascending: true });
  if (leadId) q = q.eq("lead_id", leadId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, follow_ups: data || [] });
}

// POST /api/crm/follow-ups — schedule one
// Body: { lead_id, scheduled_for, channel?, message? }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    lead_id?: string;
    scheduled_for?: string;
    channel?: string;
    message?: string;
  };
  if (!body.lead_id || !body.scheduled_for) {
    return NextResponse.json(
      { error: "lead_id and scheduled_for are required" },
      { status: 400 }
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", body.lead_id)
    .single();
  if (!lead || lead.user_id !== ownerId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lead_follow_ups")
    .insert({
      profile_id: ownerId,
      lead_id: body.lead_id,
      scheduled_for: body.scheduled_for,
      channel: body.channel ?? "manual",
      message: body.message ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, follow_up: data });
}

// PATCH /api/crm/follow-ups — update. Body: { id, status?, scheduled_for?, message?, completed_at? }
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.scheduled_for === "string") patch.scheduled_for = body.scheduled_for;
  if (typeof body.message === "string") patch.message = body.message;
  if (typeof body.channel === "string") patch.channel = body.channel;
  if (body.completed_at !== undefined) patch.completed_at = body.completed_at;

  const { data, error } = await supabase
    .from("lead_follow_ups")
    .update(patch)
    .eq("id", id)
    .eq("profile_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, follow_up: data });
}

// DELETE /api/crm/follow-ups?id=xyz
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const { error } = await supabase
    .from("lead_follow_ups")
    .delete()
    .eq("id", id)
    .eq("profile_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
