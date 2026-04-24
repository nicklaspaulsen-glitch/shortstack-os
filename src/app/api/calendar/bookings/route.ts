/**
 * Admin view of bookings with reassign support.
 *
 * GET   /api/calendar/bookings?team_id=&rep_id=&from=&to=
 *   Lists calendar_events scoped to the caller's agency, joined with
 *   assigned-user display names and the booking team label.
 *
 * PATCH /api/calendar/bookings
 *   body: { id, assigned_user_id?, booking_status?, booking_team_id? }
 *   Reassigns a booking to a different rep or updates status.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const teamId = req.nextUrl.searchParams.get("team_id");
  const repId = req.nextUrl.searchParams.get("rep_id");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let q = service
    .from("calendar_events")
    .select("*")
    .eq("user_id", ownerId)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  if (teamId) q = q.eq("booking_team_id", teamId);
  if (repId) q = q.eq("assigned_user_id", repId);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);

  const { data: events, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eventRows = (events || []) as Array<{
    id: string;
    assigned_user_id: string | null;
    booking_team_id: string | null;
    [k: string]: unknown;
  }>;

  const userIds = Array.from(
    new Set(eventRows.map((e) => e.assigned_user_id).filter((x): x is string => !!x)),
  );
  const teamIds = Array.from(
    new Set(eventRows.map((e) => e.booking_team_id).filter((x): x is string => !!x)),
  );

  const [profilesRes, teamsRes] = await Promise.all([
    userIds.length
      ? service.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? service.from("booking_teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, { name: string; email: string | null }>();
  for (const p of profilesRes.data || []) {
    const row = p as { id: string; full_name: string | null; email: string | null };
    profileMap.set(row.id, { name: row.full_name || row.email || "—", email: row.email });
  }
  const teamMap = new Map<string, string>();
  for (const t of teamsRes.data || []) {
    const row = t as { id: string; name: string };
    teamMap.set(row.id, row.name);
  }

  const bookings = eventRows.map((e) => ({
    ...e,
    assigned_user_name: e.assigned_user_id ? profileMap.get(e.assigned_user_id)?.name || null : null,
    assigned_user_email: e.assigned_user_id ? profileMap.get(e.assigned_user_id)?.email || null : null,
    booking_team_name: e.booking_team_id ? teamMap.get(e.booking_team_id) || null : null,
  }));

  return NextResponse.json({ bookings });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    assigned_user_id?: string | null;
    booking_status?: string;
    booking_team_id?: string | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const { data: existing } = await service
    .from("calendar_events")
    .select("id, user_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing || existing.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if ("assigned_user_id" in body) updates.assigned_user_id = body.assigned_user_id;
  if (body.booking_status) updates.booking_status = body.booking_status;
  if ("booking_team_id" in body) updates.booking_team_id = body.booking_team_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no updates" }, { status: 400 });
  }

  const { data, error } = await service
    .from("calendar_events")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}
