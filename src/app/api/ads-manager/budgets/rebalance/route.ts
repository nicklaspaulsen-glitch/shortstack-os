/**
 * POST /api/ads-manager/budgets/rebalance
 *
 * One-click apply of the AI-suggested per-platform budget allocation.
 *
 * Strategy:
 *   1. Read the latest pending "reallocate" suggestion.
 *   2. Compute the per-platform delta vs current allocation.
 *   3. For each platform with a positive delta, scale the daily_budget of the
 *      top-spending active campaign on that platform proportionally.
 *      For platforms with a negative delta, reduce the lowest-ROAS campaign.
 *   4. Mark the suggestion as accepted.
 *
 * This is intentionally conservative — we never create new campaigns and we
 * cap any single change at 50% of the current daily budget. Anything more
 * aggressive should require explicit approval per campaign in the
 * Campaigns tab.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient, type UnifiedPlatform } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_CHANGE_PCT = 0.5;

interface RebalanceResult {
  applied: Array<{
    platform: UnifiedPlatform;
    campaignId: string;
    oldBudget: number;
    newBudget: number;
  }>;
  skipped: Array<{
    platform: UnifiedPlatform;
    reason: string;
  }>;
}

export async function POST(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: suggestion } = await supabase
    .from("ads_optimization_suggestions")
    .select("*")
    .eq("user_id", ownerId)
    .eq("suggestion_type", "reallocate")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!suggestion) {
    return NextResponse.json(
      { error: "No pending reallocate suggestion found. Generate insights first." },
      { status: 404 },
    );
  }

  const suggested = (suggestion.suggested_state as Record<string, unknown>) || {};
  const allocation = suggested.allocation as Record<string, number> | undefined;
  if (!allocation) {
    return NextResponse.json(
      { error: "Suggestion missing allocation data — cannot rebalance automatically." },
      { status: 400 },
    );
  }

  const client = new UnifiedAdsClient(supabase, ownerId);
  const campaigns = await client.listCampaigns({ status: "active" });

  // Current per-platform daily budget totals.
  const current: Record<UnifiedPlatform, number> = { meta: 0, google: 0, tiktok: 0 };
  for (const c of campaigns) {
    if (c.dailyBudget !== null) current[c.platform] += c.dailyBudget;
  }

  const result: RebalanceResult = { applied: [], skipped: [] };

  for (const platform of ["meta", "google", "tiktok"] as const) {
    const target = Number(allocation[platform] || 0);
    if (target === 0) {
      result.skipped.push({ platform, reason: "Not in suggested allocation" });
      continue;
    }

    const platformCampaigns = campaigns.filter(
      (c) => c.platform === platform && c.dailyBudget !== null,
    );
    if (platformCampaigns.length === 0) {
      result.skipped.push({ platform, reason: "No active campaigns with daily budget" });
      continue;
    }

    const delta = target - current[platform];
    if (Math.abs(delta) < 1) {
      result.skipped.push({ platform, reason: "Delta too small to apply" });
      continue;
    }

    // Pick which campaign to adjust:
    //   Positive delta (more budget): scale the top-spending active campaign.
    //   Negative delta (less budget): reduce the lowest-ROAS active campaign.
    let target_campaign;
    if (delta > 0) {
      target_campaign = [...platformCampaigns].sort(
        (a, b) => b.totalSpend - a.totalSpend,
      )[0];
    } else {
      target_campaign = [...platformCampaigns].sort((a, b) => {
        const ra = a.roas ?? 999;
        const rb = b.roas ?? 999;
        return ra - rb;
      })[0];
    }

    if (!target_campaign || target_campaign.dailyBudget === null) {
      result.skipped.push({ platform, reason: "Could not pick target campaign" });
      continue;
    }

    const oldBudget = target_campaign.dailyBudget;
    // Cap the change at MAX_CHANGE_PCT of the current campaign budget.
    const maxDelta = oldBudget * MAX_CHANGE_PCT;
    const cappedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
    const newBudget = Math.max(0, oldBudget + cappedDelta);

    if (Math.abs(newBudget - oldBudget) < 0.01) {
      result.skipped.push({ platform, reason: "Capped delta is zero" });
      continue;
    }

    const update = await client.updateBudget(
      platform,
      target_campaign.externalId,
      newBudget,
    );
    if (update.success) {
      result.applied.push({
        platform,
        campaignId: target_campaign.externalId,
        oldBudget,
        newBudget,
      });
    } else {
      result.skipped.push({
        platform,
        reason: update.error || "Update failed",
      });
    }
  }

  await supabase
    .from("ads_optimization_suggestions")
    .update({ status: "accepted", acted_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  return NextResponse.json({ success: true, ...result });
}
