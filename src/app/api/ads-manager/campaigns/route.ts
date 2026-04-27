/**
 * GET /api/ads-manager/campaigns
 *
 * Filterable, sortable campaign list across all platforms. Reads from the
 * cached `ad_campaigns` table — refreshed by the per-platform sync routes
 * and the nightly `/api/cron/refresh-ads-metrics` job.
 *
 * Query params:
 *   - platform: meta | google | tiktok | all (default: all)
 *   - status: active | paused | ended | all (default: all)
 *   - from: ISO date — campaign start_date >= from
 *   - to: ISO date — campaign end_date <= to (or open-ended)
 *   - sort: spend | impressions | clicks | ctr | roas | conversions
 *   - dir: asc | desc (default: desc)
 *   - limit: number (default: 100, max: 500)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  UnifiedAdsClient,
  type UnifiedPlatform,
  type UnifiedCampaign,
} from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

type SortKey = keyof Pick<
  UnifiedCampaign,
  "totalSpend" | "impressions" | "clicks" | "ctr" | "roas" | "conversions"
>;

const SORT_MAP: Record<string, SortKey> = {
  spend: "totalSpend",
  impressions: "impressions",
  clicks: "clicks",
  ctr: "ctr",
  roas: "roas",
  conversions: "conversions",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const params = request.nextUrl.searchParams;

  const platformParam = params.get("platform");
  const platform: UnifiedPlatform | undefined =
    platformParam === "meta" || platformParam === "google" || platformParam === "tiktok"
      ? platformParam
      : undefined;

  const statusParam = params.get("status");
  const status =
    statusParam === "active" || statusParam === "paused" || statusParam === "ended"
      ? statusParam
      : "all";

  const fromDate = params.get("from") || undefined;
  const toDate = params.get("to") || undefined;

  const sortKey = SORT_MAP[params.get("sort") || "spend"] || "totalSpend";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";

  const limitParam = Number(params.get("limit") || 100);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 500);

  const client = new UnifiedAdsClient(supabase, ownerId);
  const campaigns = await client.listCampaigns({
    platform,
    status: status === "all" ? "all" : status,
    fromDate,
    toDate,
  });

  // Re-sort by the requested key — listCampaigns defaults to spend-desc,
  // so this is only needed when the caller asked for a different order.
  campaigns.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const an = av === null || av === undefined ? -Infinity : Number(av);
    const bn = bv === null || bv === undefined ? -Infinity : Number(bv);
    return dir === "asc" ? an - bn : bn - an;
  });

  return NextResponse.json({
    campaigns: campaigns.slice(0, limit),
    total: campaigns.length,
  });
}
