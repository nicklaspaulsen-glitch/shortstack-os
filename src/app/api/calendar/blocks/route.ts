/**
 * Manual calendar blocks (calendar_slots_blocked).
 *
 * GET    /api/calendar/blocks?user_id=&from=&to=
 * POST   /api/calendar/blocks    { user_id?, starts_at, ends_at, reason? }
 * DELETE /api/calendar/blocks?id=<id>
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

async function canManageUser(
  service: ReturnType<typeof createServiceClient>,
  callerId: string,
  targetUserId: string,
): Promise<boolean> {
  if (callerId === targetUserId) return true;
  const { data: target } = await service
    .from("profiles")
    .select("id, parent_agency_id")
    .eq("id", targetUserId)
    .maybeSingle();
  return target?.parent_agency_id === callerId;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const targetId = req.nextUrl.searchParams.get("user_id") ||
    (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!(await canManageUser(service, user.id, targetId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  let q = service
    .from("calendar_slots_blocked")
    .select("*")
    .eq("user_id", targetId)
    .order("starts_at", { ascending: true });
  if (from) q = q.gte("starts_at", from);
  if (to) q = q.lte("ends_at", to);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocks: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    user_id?: string;
    starts_at?: string;
    ends_at?: string;
    reason?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: "starts_at, ends_at required" }, { status: 400 });
  }

  const service = createServiceClient();
  const targetId = body.user_id ||
    (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!(await canManageUser(service, user.id, targetId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("calendar_slots_blocked")
    .insert({
      user_id: targetId,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      reason: body.reason || "manual block",
      source: "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ block: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service
    .from("calendar_slots_blocked")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageUser(service, user.id, existing.user_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service.from("calendar_slots_blocked").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
