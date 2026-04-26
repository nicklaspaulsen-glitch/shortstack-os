import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the "effective agency owner" for the caller (handles team_members)
 * and assert the requested client_id (if any) belongs to that agency.
 *
 * Returns { ownerId, clientId, role } on success, or null on failure
 * (route should respond 403 Forbidden).
 *
 * Usage:
 *   const ctx = await requireOwnedClient(supabase, user.id, client_id);
 *   if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *   // use ctx.ownerId for list queries, ctx.clientId for single-client queries
 */
export async function requireOwnedClient(
  supabase: SupabaseClient,
  userId: string,
  requestedClientId?: string | null,
): Promise<{ ownerId: string; clientId: string | null; role: string } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  // Resolve effective owner (team_member → their parent agency)
  const ownerId =
    profile.role === "team_member" && profile.parent_agency_id
      ? profile.parent_agency_id
      : userId;

  // Clients can only act on their own record
  if (profile.role === "client") {
    const { data: own } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("profile_id", userId)
      .single();
    if (!own) return null;
    if (requestedClientId && requestedClientId !== own.id) return null;
    return { ownerId: userId, clientId: own.id, role: profile.role };
  }

  // Admin / team_member: verify requested client belongs to owner
  if (requestedClientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", requestedClientId)
      .single();
    if (!c || c.profile_id !== ownerId) return null;

    // team_member with specific-client scope — check allowed list
    if (profile.role === "team_member") {
      const { data: m } = await supabase
        .from("team_members")
        .select("client_access_mode, allowed_client_ids")
        .eq("member_profile_id", userId)
        .eq("status", "active")
        .single();
      if (
        m?.client_access_mode === "specific" &&
        !(m.allowed_client_ids as string[])?.includes(requestedClientId)
      ) {
        return null;
      }
    }
  }

  return { ownerId, clientId: requestedClientId ?? null, role: profile.role };
}

/**
 * Get the effective agency owner id for a user (team_members resolve to parent).
 * Lightweight helper for list queries that don't involve a specific client.
 *
 * Defense-in-depth (codex round-1 catch on the conversations RLS patch): for
 * team_members we ALSO require an `active` row in `team_members` matching
 * the parent agency. Without this guard a suspended/revoked member would
 * still resolve to the parent agency and read inbox / connection data.
 *
 * Returns null when:
 *   - The profile row doesn't exist.
 *   - The user is a team_member but no active team_members row exists.
 */
export async function getEffectiveOwnerId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  if (profile.role === "team_member" && profile.parent_agency_id) {
    // Verify the team_member row is still active for this agency.
    const { data: tm } = await supabase
      .from("team_members")
      .select("status")
      .eq("member_profile_id", userId)
      .eq("agency_owner_id", profile.parent_agency_id)
      .maybeSingle();
    if (!tm || tm.status !== "active") return null;
    return profile.parent_agency_id;
  }
  return userId;
}
