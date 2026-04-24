/**
 * Booking teams CRUD.
 *
 * GET    /api/calendar/teams
 *   Returns all teams owned by the caller (agency-scoped) including a
 *   nested members array with profile names/emails.
 *
 * POST   /api/calendar/teams
 *   body: { name, distribution_mode?, default_duration_minutes?, members?: string[] }
 *
 * PATCH  /api/calendar/teams
 *   body: { id, ...fields, members?: string[] (optional replace) }
 *
 * DELETE /api/calendar/teams?id=<id>
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

interface TeamMemberRow {
  id: string;
  user_id: string;
  priority: number;
  assignments_count: number;
  last_assigned_at: string | null;
  active: boolean;
}

interface TeamRow {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string | null;
  distribution_mode: string;
  last_assigned_user_id: string | null;
  default_duration_minutes: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type TeamWithMembers = TeamRow & {
  members: Array<TeamMemberRow & { name: string; email: string | null }>;
};

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const { data: teams, error } = await service
    .from("booking_teams")
    .select("*")
    .eq("owner_user_id", ownerId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teamRows = (teams || []) as TeamRow[];
  if (teamRows.length === 0) return NextResponse.json({ teams: [] });

  const teamIds = teamRows.map((t) => t.id);
  const { data: members } = await service
    .from("booking_team_members")
    .select("id, team_id, user_id, priority, assignments_count, last_assigned_at, active")
    .in("team_id", teamIds);

  const memberUserIds = Array.from(
    new Set((members || []).map((m) => (m as { user_id: string }).user_id)),
  );
  let profilesMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (memberUserIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberUserIds);
    profilesMap = new Map(
      (profiles || []).map((p) => {
        const row = p as { id: string; full_name: string | null; email: string | null };
        return [row.id, { full_name: row.full_name, email: row.email }];
      }),
    );
  }

  const out: TeamWithMembers[] = teamRows.map((t) => {
    const teamMembers = (members || [])
      .filter((m) => (m as { team_id: string }).team_id === t.id)
      .map((m) => {
        const row = m as TeamMemberRow & { team_id: string };
        const p = profilesMap.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          priority: row.priority,
          assignments_count: row.assignments_count,
          last_assigned_at: row.last_assigned_at,
          active: row.active,
          name: p?.full_name || p?.email || "—",
          email: p?.email || null,
        };
      });
    return { ...t, members: teamMembers };
  });

  return NextResponse.json({ teams: out });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    slug?: string;
    distribution_mode?: string;
    default_duration_minutes?: number;
    members?: string[];
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const { data: team, error } = await service
    .from("booking_teams")
    .insert({
      owner_user_id: ownerId,
      name: body.name,
      slug: body.slug || null,
      distribution_mode: body.distribution_mode || "round_robin",
      default_duration_minutes: body.default_duration_minutes || 30,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.members && body.members.length > 0) {
    const { error: mErr } = await service.from("booking_team_members").insert(
      body.members.map((uid, idx) => ({
        team_id: team.id,
        user_id: uid,
        priority: body.members!.length - idx,
      })),
    );
    if (mErr) console.warn("[calendar/teams] members insert warn:", mErr.message);
  }

  return NextResponse.json({ team }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    name?: string;
    slug?: string;
    distribution_mode?: string;
    default_duration_minutes?: number;
    active?: boolean;
    members?: string[];
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  // Verify ownership
  const { data: existing } = await service
    .from("booking_teams")
    .select("id, owner_user_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing || existing.owner_user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = ["name", "slug", "distribution_mode", "default_duration_minutes", "active"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) updates[k] = (body as unknown as Record<string, unknown>)[k];
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service.from("booking_teams").update(updates).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace members if provided
  if (Array.isArray(body.members)) {
    await service.from("booking_team_members").delete().eq("team_id", body.id);
    if (body.members.length > 0) {
      await service.from("booking_team_members").insert(
        body.members.map((uid, idx) => ({
          team_id: body.id!,
          user_id: uid,
          priority: body.members!.length - idx,
        })),
      );
    }
  }

  const { data: fresh } = await service
    .from("booking_teams")
    .select("*")
    .eq("id", body.id)
    .single();
  return NextResponse.json({ team: fresh });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();
  const { data: existing } = await service
    .from("booking_teams")
    .select("id, owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.owner_user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await service.from("booking_teams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
