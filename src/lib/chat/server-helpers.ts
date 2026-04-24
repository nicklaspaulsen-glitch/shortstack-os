import { SupabaseClient } from "@supabase/supabase-js";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * Resolve the caller's effective org id (the agency owner's profile id).
 * Falls back to the user id when the profile row is missing.
 */
export async function resolveOrgId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  return (await getEffectiveOwnerId(supabase, userId)) || userId;
}

/**
 * Parse @username mentions in content against profiles in the given org.
 * Returns the list of profile ids referenced. Unknown usernames are ignored.
 *
 * Matches:
 *   - full_name (first-token lowercased)
 *   - email local-part (before @)
 *   - partial match on full_name tokens
 */
export async function parseMentions(
  supabase: SupabaseClient,
  orgId: string,
  content: string,
): Promise<string[]> {
  if (!content) return [];
  const re = /(?:^|\s)@([a-zA-Z0-9_.-]{2,64})/g;
  const handles = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    handles.add(m[1].toLowerCase());
  }
  if (handles.size === 0) return [];

  // Load all profiles in the org (owner + team members) and match.
  const { data: ownerRow } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", orgId)
    .maybeSingle();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("parent_agency_id", orgId);

  const candidates: Array<{ id: string; full_name: string | null; email: string | null }> = [
    ...(ownerRow ? [ownerRow as { id: string; full_name: string | null; email: string | null }] : []),
    ...((members || []) as Array<{ id: string; full_name: string | null; email: string | null }>),
  ];

  const matched = new Set<string>();
  for (const h of Array.from(handles)) {
    for (const p of candidates) {
      const emailLocal = p.email ? p.email.split("@")[0].toLowerCase() : "";
      const nameTokens = (p.full_name || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (emailLocal === h || nameTokens.includes(h) || nameTokens[0]?.startsWith(h)) {
        matched.add(p.id);
        break;
      }
    }
  }
  return Array.from(matched);
}
