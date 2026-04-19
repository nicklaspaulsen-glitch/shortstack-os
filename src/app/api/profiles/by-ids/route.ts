import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Batch profile lookup — returns basic public profile info for a list of
 * profile ids, scoped to the authed user's tenant so team members can't
 * enumerate other agencies.
 *
 * Used by the Projects page (and anywhere else showing assignee initials)
 * to avoid rendering the first character of the UUID itself.
 *
 * Query shape:  GET /api/profiles/by-ids?ids=uuid1,uuid2,uuid3
 * Returns: { profiles: Array<{ id, full_name, email, avatar_url, role }> }
 *
 * Scoping rules:
 *   - Admin: can see their own profile + any team_member whose agency_owner_id === them
 *   - Team member: can see self + their parent agency owner + other team members
 *                  of the same agency
 *   - Client: can only see self
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idsParam = request.nextUrl.searchParams.get("ids") || "";
  const requestedIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200); // hard cap — no unbounded enumeration

  if (requestedIds.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  // Determine this user's tenant scope
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ profiles: [] });

  // Build the set of profile ids this user is allowed to see
  const allowedIds = new Set<string>([user.id]);

  if (profile.role === "admin") {
    // Agency owner: allowed to see self + team_members under this owner
    const { data: members } = await supabase
      .from("team_members")
      .select("member_profile_id")
      .eq("agency_owner_id", user.id)
      .eq("status", "active");
    for (const m of members || []) {
      if (m.member_profile_id) allowedIds.add(m.member_profile_id);
    }
  } else if (profile.role === "team_member") {
    // Team member: allowed to see self + their agency owner + peers
    const { data: myRow } = await supabase
      .from("team_members")
      .select("agency_owner_id")
      .eq("member_profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    const ownerId = myRow?.agency_owner_id || profile.parent_agency_id;
    if (ownerId) {
      allowedIds.add(ownerId);
      const { data: peers } = await supabase
        .from("team_members")
        .select("member_profile_id")
        .eq("agency_owner_id", ownerId)
        .eq("status", "active");
      for (const p of peers || []) {
        if (p.member_profile_id) allowedIds.add(p.member_profile_id);
      }
    }
  }
  // client role falls through — only sees self

  // Intersect requested with allowed
  const safeIds = requestedIds.filter((id) => allowedIds.has(id));
  if (safeIds.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", safeIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: profiles || [] });
}
