import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify that the authenticated user has access to the requested client_id.
 *
 * - Admins and team_members can access any client.
 * - Clients can ONLY access their own record (matched via profile_id).
 * - Returns the verified client_id, or null if access denied.
 */
export async function verifyClientAccess(
  supabase: SupabaseClient,
  userId: string,
  requestedClientId?: string | null
): Promise<{ clientId: string | null; role: string | null; denied: boolean }> {
  // Get the user's role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile) return { clientId: null, role: null, denied: true };

  const role = profile.role;

  // Admins and team members can access any client
  if (role === "admin" || role === "team_member") {
    return { clientId: requestedClientId || null, role, denied: false };
  }

  // For client role: look up their own client record
  const { data: ownClient } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", userId)
    .single();

  if (!ownClient) return { clientId: null, role, denied: true };

  // If a specific client_id was requested, verify it matches their own
  if (requestedClientId && requestedClientId !== ownClient.id) {
    return { clientId: null, role, denied: true };
  }

  return { clientId: ownClient.id, role, denied: false };
}
