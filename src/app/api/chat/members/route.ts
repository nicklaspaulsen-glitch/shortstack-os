import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/chat/server-helpers";

export const maxDuration = 10;

/**
 * GET /api/chat/members
 * Returns all org members (owner + active team_members) — used by the chat
 * UI for the DM picker, @mention autocomplete, and the invite dialog.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await resolveOrgId(supabase, user.id);
  const service = createServiceClient();

  const { data: owner } = await service
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", orgId)
    .maybeSingle();

  const { data: teamRows } = await service
    .from("team_members")
    .select("member_profile_id, email, full_name, avatar_url, status")
    .eq("agency_owner_id", orgId)
    .eq("status", "active");

  const teamIds = (teamRows || [])
    .map((r) => (r as { member_profile_id: string | null }).member_profile_id)
    .filter((x): x is string => !!x);

  const { data: teamProfiles } = teamIds.length > 0
    ? await service
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", teamIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }> };

  const profileById = new Map<string, { id: string; full_name: string | null; email: string | null; avatar_url: string | null }>();
  for (const p of teamProfiles || []) profileById.set(p.id as string, p as { id: string; full_name: string | null; email: string | null; avatar_url: string | null });

  const members: Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null; is_owner: boolean }> = [];
  if (owner) {
    members.push({
      id: owner.id as string,
      full_name: (owner.full_name as string | null) ?? null,
      email: (owner.email as string | null) ?? null,
      avatar_url: (owner.avatar_url as string | null) ?? null,
      is_owner: true,
    });
  }
  for (const r of teamRows || []) {
    const mpid = (r as { member_profile_id: string | null }).member_profile_id;
    if (!mpid) continue;
    const p = profileById.get(mpid);
    members.push({
      id: mpid,
      full_name: p?.full_name ?? (r as { full_name: string | null }).full_name ?? null,
      email: p?.email ?? (r as { email: string | null }).email ?? null,
      avatar_url: p?.avatar_url ?? (r as { avatar_url: string | null }).avatar_url ?? null,
      is_owner: false,
    });
  }

  return NextResponse.json({ members });
}
