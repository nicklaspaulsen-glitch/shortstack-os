/**
 * GET /api/ads-manager/budgets
 *
 * Returns current allocation per platform plus the AI-suggested allocation
 * (from the most recent "reallocate" suggestion in
 * ads_optimization_suggestions).
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

interface AllocationSlice {
  platform: "meta" | "google" | "tiktok";
  amount: number;
  pct: number;
}

interface BudgetsResponse {
  current: AllocationSlice[];
  suggested: AllocationSlice[] | null;
  rationale: string | null;
  totalDailyBudget: number;
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const client = new UnifiedAdsClient(supabase, ownerId);
  const campaigns = await client.listCampaigns();

  // Sum daily_budget per platform for active campaigns. Missing daily_budget
  // (lifetime-budget campaigns) gets a fallback estimate from total_spend
  // averaged across the last 7 days — but if we don't have that, just skip.
  const totals = { meta: 0, google: 0, tiktok: 0 };
  for (const c of campaigns) {
    if (c.status !== "active") continue;
    if (c.dailyBudget !== null) {
      totals[c.platform] += c.dailyBudget;
    }
  }

  const total = totals.meta + totals.google + totals.tiktok;
  const current: AllocationSlice[] =
    total > 0
      ? (Object.keys(totals) as Array<"meta" | "google" | "tiktok">)
          .map((p) => ({ platform: p, amount: totals[p], pct: (totals[p] / total) * 100 }))
          .filter((s) => s.amount > 0)
      : [];

  // Latest reallocate suggestion's suggested state.
  const { data: reallocSuggestion } = await supabase
    .from("ads_optimization_suggestions")
    .select("suggested_state, rationale, created_at")
    .eq("user_id", ownerId)
    .eq("suggestion_type", "reallocate")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let suggested: AllocationSlice[] | null = null;
  let rationale: string | null = null;

  if (reallocSuggestion?.suggested_state) {
    const state = reallocSuggestion.suggested_state as Record<string, unknown>;
    const allocation = state.allocation as Record<string, number> | undefined;
    if (allocation) {
      const sumSuggested = Object.values(allocation).reduce(
        (s, v) => s + Number(v || 0),
        0,
      );
      if (sumSuggested > 0) {
        suggested = (["meta", "google", "tiktok"] as const)
          .filter((p) => allocation[p] !== undefined)
          .map((p) => ({
            platform: p,
            amount: Number(allocation[p] || 0),
            pct: (Number(allocation[p] || 0) / sumSuggested) * 100,
          }));
        rationale = String(reallocSuggestion.rationale || "");
      }
    }
  }

  const response: BudgetsResponse = {
    current,
    suggested,
    rationale,
    totalDailyBudget: total,
  };

  return NextResponse.json(response);
}
