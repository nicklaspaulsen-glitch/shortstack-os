/**
 * POST /api/ads-manager/insights/[id]
 *
 * Accept or reject a single AI optimization suggestion. On accept, we apply
 * the suggested action via UnifiedAdsClient (pause / budget change / etc).
 *
 * Body:
 *   { decision: "accept" | "reject" }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient, type UnifiedPlatform } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

interface SuggestionRow {
  id: string;
  user_id: string;
  suggestion_type: "reallocate" | "pause" | "scale" | "optimize_creative";
  platform: string | null;
  campaign_id: string | null;
  current_state: Record<string, unknown> | null;
  suggested_state: Record<string, unknown> | null;
  status: string;
}

function platformFromString(p: string | null): UnifiedPlatform | null {
  if (p === "meta" || p === "google" || p === "tiktok") return p;
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body — expected { decision: 'accept' | 'reject' }" },
      { status: 400 },
    );
  }

  const { data: suggestion, error } = await supabase
    .from("ads_optimization_suggestions")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const row = suggestion as SuggestionRow;

  if (row.status !== "pending") {
    return NextResponse.json(
      { error: `Suggestion already ${row.status}` },
      { status: 409 },
    );
  }

  if (parsed.data.decision === "reject") {
    await supabase
      .from("ads_optimization_suggestions")
      .update({ status: "rejected", acted_at: new Date().toISOString() })
      .eq("id", row.id);
    return NextResponse.json({ success: true, status: "rejected" });
  }

  // Accept path — apply the action.
  const platform = platformFromString(row.platform);
  const client = new UnifiedAdsClient(supabase, ownerId);

  let actionResult: { success: boolean; error?: string } = { success: true };

  if (row.suggestion_type === "pause" && platform && row.campaign_id) {
    actionResult = await client.pauseCampaign(platform, row.campaign_id);
  } else if (row.suggestion_type === "scale" && platform && row.campaign_id) {
    const newBudget = Number(row.suggested_state?.dailyBudget || 0);
    if (newBudget > 0) {
      actionResult = await client.updateBudget(platform, row.campaign_id, newBudget);
    }
  } else if (row.suggestion_type === "reallocate") {
    // Reallocate is complex — let the dedicated /budgets/rebalance endpoint
    // handle multi-platform shifts. Marking accepted here is a no-op
    // application; the user can apply it via the Budgets tab.
    // Fall through with success=true.
  }
  // optimize_creative is purely informational — no automatic action.

  if (!actionResult.success) {
    return NextResponse.json(
      { error: actionResult.error || "Failed to apply suggestion" },
      { status: 500 },
    );
  }

  await supabase
    .from("ads_optimization_suggestions")
    .update({ status: "accepted", acted_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ success: true, status: "accepted" });
}
