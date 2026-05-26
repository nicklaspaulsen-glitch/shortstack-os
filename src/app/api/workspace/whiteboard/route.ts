import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWhiteboardSnapshot } from "@/lib/workspace/aggregator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/workspace/whiteboard
 * Returns the current snapshot of the live agency production board.
 *
 * Auth: cookie-based (RLS via createServerSupabase). The aggregator
 * scopes everything to the caller's agency owner id — for team
 * members this is resolved from `team_members.member_profile_id`.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the "agency owner" for this user — admins/founders/agency are
  // their own owner, team members carry parent_agency_id on their profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const agencyOwnerId =
    profile.role === "team_member" && profile.parent_agency_id
      ? (profile.parent_agency_id as string)
      : (profile.id as string);

  try {
    const snapshot = await getWhiteboardSnapshot(supabase, agencyOwnerId);
    return NextResponse.json({ success: true, data: snapshot });
  } catch (err) {
    const message = "snapshot failed";
    // eslint-disable-next-line no-console
    console.error("[workspace/whiteboard] snapshot failed", message);
    return NextResponse.json(
      { success: false, error: "snapshot failed" },
      { status: 500 },
    );
  }
}
