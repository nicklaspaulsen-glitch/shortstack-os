import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { recomputeScore } from "@/lib/leads/score-recompute";

/**
 * POST /api/leads/[id]/recompute-score
 *
 * Recompute one lead's AI score. Auth-gated: caller must own the lead via
 * `getEffectiveOwnerId`. Persists to `leads` and logs a `lead_score_events`
 * row.
 */
export async function POST(
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

  // Confirm the lead belongs to this owner before recomputing.
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();

  if (leadErr || !leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const out = await recomputeScore(
      supabase,
      params.id,
      "/api/leads/[id]/recompute-score",
    );
    if (!out) {
      return NextResponse.json(
        { error: "Failed to load lead signals" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      ...out,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/leads/recompute-score] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
