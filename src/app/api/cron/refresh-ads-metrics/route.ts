/**
 * Cron: refresh-ads-metrics
 *
 * Schedule: 0 3 * * * (daily at 03:00 UTC; see vercel.json)
 *
 * Pulls yesterday's metrics from each connected platform (Meta + Google +
 * TikTok) for every user with an active oauth_connection, and upserts into
 * `ads_metrics_cache`. The dashboard reads from that cache so page loads stay
 * fast and we don't hit upstream rate limits.
 *
 * Auth: Bearer CRON_SECRET. Fail-closed if env var is missing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { metaAds, googleAds, tiktokAds } from "@/lib/ads/platforms";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RefreshSummary {
  usersProcessed: number;
  rowsUpserted: number;
  errors: string[];
}

type Platform = "meta_ads" | "google_ads" | "tiktok_ads";
type CacheKey = "meta" | "google" | "tiktok";

const PLATFORM_TO_CACHE_KEY: Record<Platform, CacheKey> = {
  meta_ads: "meta",
  google_ads: "google",
  tiktok_ads: "tiktok",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: RefreshSummary = {
    usersProcessed: 0,
    rowsUpserted: 0,
    errors: [],
  };

  // Yesterday in YYYY-MM-DD (UTC).
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Pull every active ads OAuth connection.
  const { data: connections, error: connError } = await supabase
    .from("oauth_connections")
    .select("user_id, platform, access_token, account_id")
    .eq("is_active", true)
    .in("platform", ["meta_ads", "google_ads", "tiktok_ads"]);

  if (connError) {
    return NextResponse.json(
      { error: "Failed to load connections", details: connError.message },
      { status: 500 },
    );
  }

  const byUser = new Map<string, Array<{ platform: Platform; access_token: string; account_id: string }>>();
  for (const c of connections || []) {
    if (!c.user_id || !c.access_token || !c.account_id) continue;
    const platform = c.platform as Platform;
    if (!(platform in PLATFORM_TO_CACHE_KEY)) continue;
    const list = byUser.get(c.user_id) || [];
    list.push({
      platform,
      access_token: String(c.access_token),
      account_id: String(c.account_id),
    });
    byUser.set(c.user_id, list);
  }

  for (const [userId, conns] of byUser.entries()) {
    summary.usersProcessed += 1;
    for (const conn of conns) {
      try {
        const cacheKey = PLATFORM_TO_CACHE_KEY[conn.platform];
        const campaigns = await fetchCampaigns(conn);

        const rows = campaigns.map((c) => ({
          user_id: userId,
          platform: cacheKey,
          campaign_id: c.external_id,
          campaign_name: c.name,
          date: dateStr,
          spend_cents: Math.round(c.spend * 100),
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions,
          cpa_cents: c.conversions > 0 ? Math.round((c.spend / c.conversions) * 100) : null,
          roas: c.roas,
          raw_metrics: {
            ctr: c.ctr,
            cpc: c.cpc,
            status: c.status,
          },
          fetched_at: new Date().toISOString(),
        }));

        if (rows.length === 0) continue;

        const { error: upsertError } = await supabase
          .from("ads_metrics_cache")
          .upsert(rows, {
            onConflict: "user_id,platform,campaign_id,date",
          });

        if (upsertError) {
          summary.errors.push(
            `[${userId}/${conn.platform}] upsert: ${upsertError.message}`,
          );
        } else {
          summary.rowsUpserted += rows.length;
        }
      } catch (err) {
        summary.errors.push(
          `[${userId}/${conn.platform}] fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return NextResponse.json({ success: true, summary });
}

async function fetchCampaigns(conn: {
  platform: AdsPlatform;
  access_token: string;
  account_id: string;
}) {
  switch (conn.platform) {
    case "meta_ads":
      return metaAds.getCampaigns(conn.access_token, conn.account_id);
    case "google_ads":
      return googleAds.getCampaigns(conn.access_token, conn.account_id);
    case "tiktok_ads":
      return tiktokAds.getCampaigns(conn.access_token, conn.account_id);
  }
}
