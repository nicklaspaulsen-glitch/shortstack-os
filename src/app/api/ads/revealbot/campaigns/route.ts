/**
 * GET /api/ads/revealbot/campaigns
 *
 * Fetches campaigns from Revealbot and upserts them into ad_campaigns so they
 * surface in the unified Ads Manager dashboard under platform="revealbot".
 *
 * Query params:
 *   - account_id  (optional) — scope to a single Revealbot ad account
 *   - from        (optional) — ISO date, campaign stats start
 *   - to          (optional) — ISO date, campaign stats end
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeRevealbotClient, revealbotPlatformToSource } from "@/lib/ads/revealbot-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("access_token, is_active")
    .eq("user_id", user.id)
    .eq("platform", "revealbot")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: "Revealbot not connected." },
      { status: 400 },
    );
  }

  const params = request.nextUrl.searchParams;
  const filterAccountId = params.get("account_id") ?? undefined;
  const fromDate = params.get("from") ?? undefined;
  const toDate = params.get("to") ?? undefined;

  try {
    const client = makeRevealbotClient(conn.access_token);

    // Determine which accounts to sync
    const accounts = filterAccountId
      ? [{ id: filterAccountId, platform: "facebook" as const, name: "", account_id: filterAccountId }]
      : await client.listAccounts();

    const now = new Date().toISOString();
    let totalSynced = 0;

    for (const account of accounts) {
      const campaigns = await client.listCampaigns(account.id, fromDate, toDate);

      const rows = campaigns.map((c) => {
        const stats = c.stats;
        const spend = stats?.spend ?? 0;
        const conversions = stats?.conversions ?? 0;
        const roas = stats?.roas ?? null;
        const cpa = stats?.cpa !== undefined && stats.cpa !== null ? stats.cpa : (conversions > 0 ? spend / conversions : null);

        // Prefix external_id with account so collisions across accounts are avoided
        const externalId = `rb_${account.id}_${c.id}`;

        return {
          user_id: user.id,
          // Store as "revealbot" so the UI can filter by source platform
          platform: "revealbot",
          // Keep a note of the underlying ad platform (meta/google/tiktok)
          external_id: externalId,
          name: c.name,
          objective: null as string | null,
          status: (c.status || "unknown").toLowerCase(),
          daily_budget: c.daily_budget,
          total_spend: spend,
          impressions: stats?.impressions ?? 0,
          clicks: stats?.clicks ?? 0,
          conversions: Math.round(conversions),
          ctr: stats?.ctr ?? 0,
          cpa,
          roas,
          start_date: c.start_time
            ? new Date(c.start_time).toISOString().slice(0, 10)
            : null,
          end_date: c.stop_time
            ? new Date(c.stop_time).toISOString().slice(0, 10)
            : null,
          last_synced_at: now,
          raw_data: {
            revealbot_account_id: account.id,
            revealbot_campaign_id: c.id,
            source_platform: revealbotPlatformToSource(account.platform),
            ...c,
          },
        };
      });

      if (rows.length > 0) {
        await service
          .from("ad_campaigns")
          .upsert(rows, { onConflict: "user_id,platform,external_id" });
        totalSynced += rows.length;
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      accounts: accounts.length,
    });
  } catch (err) {
    console.error("[revealbot/campaigns] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
