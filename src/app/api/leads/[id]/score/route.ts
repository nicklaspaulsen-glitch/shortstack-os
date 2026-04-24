import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { scoreLead } from "@/lib/lead-scoring";

// POST /api/leads/[id]/score — score a single lead on demand, persist result
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = params.id;

  // Fetch the lead — scoped to owner
  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", ownerId)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Score it
  const result = await scoreLead(lead);

  // Persist to DB
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      score: result.score,
      score_breakdown: result.breakdown,
      score_reasoning: result.reasoning,
      score_computed_at: new Date().toISOString(),
      score_version: 1,
    })
    .eq("id", leadId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: leadId,
    score: result.score,
    breakdown: result.breakdown,
    reasoning: result.reasoning,
    recommended_action: result.recommended_action,
  });
}
