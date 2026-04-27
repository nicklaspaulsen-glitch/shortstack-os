/**
 * GET /api/ads-manager/overview
 *
 * Aggregates metrics across all platforms (Meta + Google + TikTok) for the
 * dashboard's Overview tab. Reads from `ad_campaigns` (the synced cache),
 * not from upstream APIs. Returns:
 *   - totals: spend / impressions / clicks / conversions / avg ROAS / CTR
 *   - perPlatform: same metrics broken out per platform
 *   - dailySeries: 30-day time-series of daily totals from ads_metrics_cache
 *   - topCampaigns: top 5 by spend
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

interface PlatformTotals {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  roas: number | null;
  campaigns: number;
}

interface OverviewResponse {
  totals: PlatformTotals;
  perPlatform: Record<"meta" | "google" | "tiktok", PlatformTotals>;
  dailySeries: Array<{
    date: string;
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    platform: "meta" | "google" | "tiktok";
    spend: number;
    roas: number | null;
    status: string;
  }>;
  bestPlatform: "meta" | "google" | "tiktok" | null;
}

function emptyTotals(): PlatformTotals {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    roas: null,
    campaigns: 0,
  };
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

  const totals = emptyTotals();
  const perPlatform: OverviewResponse["perPlatform"] = {
    meta: emptyTotals(),
    google: emptyTotals(),
    tiktok: emptyTotals(),
  };

  let weightedRoasSum = 0;
  let roasWeight = 0;

  for (const c of campaigns) {
    totals.spend += c.totalSpend;
    totals.impressions += c.impressions;
    totals.clicks += c.clicks;
    totals.conversions += c.conversions;
    totals.campaigns += 1;

    const p = perPlatform[c.platform];
    p.spend += c.totalSpend;
    p.impressions += c.impressions;
    p.clicks += c.clicks;
    p.conversions += c.conversions;
    p.campaigns += 1;

    if (c.roas !== null && c.totalSpend > 0) {
      weightedRoasSum += c.roas * c.totalSpend;
      roasWeight += c.totalSpend;
    }
  }

  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.roas = roasWeight > 0 ? weightedRoasSum / roasWeight : null;

  for (const platform of Object.keys(perPlatform) as Array<"meta" | "google" | "tiktok">) {
    const p = perPlatform[platform];
    p.ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
    // Per-platform weighted ROAS — collapse to null if no spend.
    const platformCampaigns = campaigns.filter(
      (c) => c.platform === platform && c.roas !== null && c.totalSpend > 0,
    );
    if (platformCampaigns.length > 0) {
      const ws = platformCampaigns.reduce((s, c) => s + (c.roas ?? 0) * c.totalSpend, 0);
      const w = platformCampaigns.reduce((s, c) => s + c.totalSpend, 0);
      p.roas = w > 0 ? ws / w : null;
    } else {
      p.roas = null;
    }
  }

  // Best performing platform = highest weighted ROAS with non-zero spend.
  let bestPlatform: OverviewResponse["bestPlatform"] = null;
  let bestRoas = -Infinity;
  for (const platform of Object.keys(perPlatform) as Array<"meta" | "google" | "tiktok">) {
    const p = perPlatform[platform];
    if (p.roas !== null && p.spend > 0 && p.roas > bestRoas) {
      bestRoas = p.roas;
      bestPlatform = platform;
    }
  }

  // Top 5 campaigns by spend.
  const topCampaigns: OverviewResponse["topCampaigns"] = [...campaigns]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      spend: c.totalSpend,
      roas: c.roas,
      status: c.status,
    }));

  // Daily series from ads_metrics_cache (last 30 days).
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromIso = fromDate.toISOString().slice(0, 10);

  const { data: dailyRows } = await supabase
    .from("ads_metrics_cache")
    .select("date, spend_cents, conversions, impressions, clicks")
    .eq("user_id", ownerId)
    .gte("date", fromIso)
    .order("date", { ascending: true });

  const aggregated = new Map<
    string,
    { spend: number; conversions: number; impressions: number; clicks: number }
  >();
  for (const row of dailyRows || []) {
    const key = String(row.date);
    const prev = aggregated.get(key) || {
      spend: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
    };
    prev.spend += Number(row.spend_cents || 0) / 100;
    prev.conversions += Number(row.conversions || 0);
    prev.impressions += Number(row.impressions || 0);
    prev.clicks += Number(row.clicks || 0);
    aggregated.set(key, prev);
  }
  const dailySeries: OverviewResponse["dailySeries"] = Array.from(aggregated.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const response: OverviewResponse = {
    totals,
    perPlatform,
    dailySeries,
    topCampaigns,
    bestPlatform,
  };

  return NextResponse.json(response);
}
