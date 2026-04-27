import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/leads/[id]/score-history
 *
 * Returns the lead_score_events history for a single lead — used by the
 * score-detail modal to render the area chart. Auth-gated by ownership.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Confirm the lead belongs to this owner.
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: events, error } = await supabase
    .from("lead_score_events")
    .select(
      "id, event_type, prior_score, new_score, metadata, created_at",
    )
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
}
