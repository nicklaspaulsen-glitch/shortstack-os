import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify that the authenticated user has access to the requested client_id.
 *
 * - Admins: must own the client (clients.profile_id === user.id)
 * - Team members: must belong to an agency that owns the client, and must
 *   pass their client_access_mode gate (all | specific)
 * - Clients: can ONLY access their own record (matched via profile_id)
 *
 * Returns the verified client_id, or denied=true if access is denied.
 */
export async function verifyClientAccess(
  supabase: SupabaseClient,
  userId: string,
  requestedClientId?: string | null,
): Promise<{ clientId: string | null; role: string | null; denied: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .single();

  if (!profile) return { clientId: null, role: null, denied: true };

  const role = profile.role;

  // ── Admin: must own the client ───────────────────────────────
  if (role === "admin") {
    if (!requestedClientId) {
      // No specific client requested — allowed (list queries should scope by owner separately)
      return { clientId: null, role, denied: false };
    }
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", requestedClientId)
      .single();
    if (!client || client.profile_id !== userId) {
      return { clientId: null, role, denied: true };
    }
    return { clientId: requestedClientId, role, denied: false };
  }

  // ── Team member: scoped to parent agency + allowed_client_ids ─
  if (role === "team_member") {
    const { data: member } = await supabase
      .from("team_members")
      .select("agency_owner_id, client_access_mode, allowed_client_ids, status")
      .eq("member_profile_id", userId)
      .eq("status", "active")
      .single();
    if (!member) return { clientId: null, role, denied: true };

    const parentAgency = member.agency_owner_id || profile.parent_agency_id;
    if (!parentAgency) return { clientId: null, role, denied: true };

    if (!requestedClientId) {
      // List query — caller should scope by parent agency
      return { clientId: null, role, denied: false };
    }

    // Verify client belongs to parent agency
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", requestedClientId)
      .single();
    if (!client || client.profile_id !== parentAgency) {
      return { clientId: null, role, denied: true };
    }

    // Verify client is in allowed list (if mode is specific)
    if (member.client_access_mode === "specific") {
      const allowed = (member.allowed_client_ids as string[]) || [];
      if (!allowed.includes(requestedClientId)) {
        return { clientId: null, role, denied: true };
      }
    }
    if (member.client_access_mode === "none") {
      return { clientId: null, role, denied: true };
    }

    return { clientId: requestedClientId, role, denied: false };
  }

  // ── Client role: can only access their own record ────────────
  const { data: ownClient } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", userId)
    .single();

  if (!ownClient) return { clientId: null, role, denied: true };
  if (requestedClientId && requestedClientId !== ownClient.id) {
    return { clientId: null, role, denied: true };
  }

  return { clientId: ownClient.id, role, denied: false };
}
