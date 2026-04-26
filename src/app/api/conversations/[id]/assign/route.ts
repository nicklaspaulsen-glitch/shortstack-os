import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// POST /api/conversations/:id/assign
// Body: { assigned_to_user_id: string | null }
// Null clears the assignment.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assigned_to_user_id } = await request.json();
  if (assigned_to_user_id !== null && typeof assigned_to_user_id !== "string") {
    return NextResponse.json({ error: "assigned_to_user_id must be UUID or null" }, { status: 400 });
  }

  // Security: explicitly verify the caller's tenant owns this conversation
  // before mutating it. Returns 404 (not 403) on mismatch to avoid leaking
  // conversation existence — mirrors the pattern in send/route.ts (e39e9fd).
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  if (conv.user_id !== ownerId) {
    console.error(`[conversations/assign] access denied: conv.user_id=${conv.user_id} ownerId=${ownerId}`);
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Verify the assignee is in the caller's team (owner OR team_member of
  // this agency, NOT a client). Otherwise an authed user could assign a
  // conversation to an arbitrary UUID outside their tenant — or to a
  // client profile that happens to share parent_agency_id.
  if (assigned_to_user_id !== null) {
    const isOwnerSelfAssign = assigned_to_user_id === ownerId;
    if (!isOwnerSelfAssign) {
      const { data: member } = await supabase
        .from("profiles")
        .select("id, role, parent_agency_id")
        .eq("id", assigned_to_user_id)
        .maybeSingle();
      const isTeamMember =
        !!member &&
        member.role === "team_member" &&
        member.parent_agency_id === ownerId;
      if (!isTeamMember) {
        return NextResponse.json({ error: "Assignee is not in your team" }, { status: 400 });
      }
    }
  }
  const { error } = await supabase
    .from("conversations")
    .update({ assigned_to_user_id })
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
