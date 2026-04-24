/**
 * Access helpers for manage-tab features.
 *
 * All of these resolve through SECURITY DEFINER helpers the projects-central
 * migration installs: is_project_member(uuid, uuid), is_project_owner_or_lead(uuid, uuid).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "owner" | "lead" | "member" | "none";

/**
 * Returns the caller's effective role for a given project.
 * Call with a cookie-auth'd supabase client so RLS resolves auth.uid().
 */
export async function getProjectRole(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<Role> {
  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();

  if (proj && proj.owner_id === userId) return "owner";

  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return "none";
  if (member.role === "lead") return "lead";
  return "member";
}

/** Owner or lead only. */
export function canManage(role: Role): boolean {
  return role === "owner" || role === "lead";
}

/** Any role that can read the project. */
export function canRead(role: Role): boolean {
  return role !== "none";
}
