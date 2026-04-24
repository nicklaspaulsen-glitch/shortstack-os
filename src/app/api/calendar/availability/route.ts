/**
 * Calendar availability rules CRUD.
 *
 * GET    /api/calendar/availability?user_id=<optional>
 *   Returns calendar_rules for the specified user (defaults to effective
 *   owner). Agency owners can pass a team member's user_id to view their
 *   schedule.
 *
 * POST   /api/calendar/availability
 *   body: { user_id?, day_of_week, start_time, end_time, timezone, active }
 *
 * PATCH  /api/calendar/availability
 *   body: { id, ...fields }
 *
 * DELETE /api/calendar/availability?id=<id>
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

  const targetId = req.nextUrl.searchParams.get("user_id") ||
    (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const service = createServiceClient();
  if (!(await canManageUser(service, user.id, targetId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("calendar_rules")
    .select("*")
    .eq("user_id", targetId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    user_id?: string;
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    timezone?: string;
    active?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetId = body.user_id ||
    (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const service = createServiceClient();
  if (!(await canManageUser(service, user.id, targetId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    typeof body.day_of_week !== "number" ||
    body.day_of_week < 0 || body.day_of_week > 6 ||
    !body.start_time || !body.end_time
  ) {
    return NextResponse.json(
      { error: "day_of_week (0–6), start_time, end_time required" },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .from("calendar_rules")
    .insert({
      user_id: targetId,
      day_of_week: body.day_of_week,
      start_time: body.start_time,
      end_time: body.end_time,
      timezone: body.timezone || "America/Los_Angeles",
      active: body.active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; [k: string]: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service
    .from("calendar_rules")
    .select("user_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageUser(service, user.id, existing.user_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = ["day_of_week", "start_time", "end_time", "timezone", "active"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await service
    .from("calendar_rules")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service
    .from("calendar_rules")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageUser(service, user.id, existing.user_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service.from("calendar_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
