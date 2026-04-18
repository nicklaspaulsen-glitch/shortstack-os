import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/ads/tiktok-ads/campaigns — pull campaigns from the TikTok Marketing API
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("id, access_token, account_id, is_active")
    .eq("user_id", user.id)
    .eq("platform", "tiktok_ads")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: "TikTok Ads not connected. Visit /api/oauth/tiktok-ads/start to connect." },
      { status: 400 }
    );
  }

  const requestedAccount = request.nextUrl.searchParams.get("ad_account_id");
  let advertiserId = requestedAccount || conn.account_id;
  let adAccountRowId: string | null = null;

  if (advertiserId) {
    const { data: adAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "tiktok_ads")
      .eq("account_id", advertiserId)
      .maybeSingle();
    if (adAccount) adAccountRowId = adAccount.id;
  } else {
    const { data: defaultAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "tiktok_ads")
      .eq("is_default", true)
      .maybeSingle();
    if (defaultAccount) {
      adAccountRowId = defaultAccount.id;
      advertiserId = defaultAccount.account_id;
    }
  }

  if (!advertiserId) {
    return NextResponse.json({ error: "No TikTok advertiser id available" }, { status: 400 });
  }

  try {
    const fields = [
      "campaign_id",
      "campaign_name",
      "objective_type",
      "status",
      "operation_status",
      "budget",
      "budget_mode",
      "create_time",
    ];
    const campaignsRes = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/campaign/get/` +
        `?advertiser_id=${encodeURIComponent(advertiserId)}` +
        `&page_size=100` +
        `&fields=${encodeURIComponent(JSON.stringify(fields))}`,
      {
        headers: {
          "Access-Token": conn.access_token,
          "Content-Type": "application/json",
        },
      }
    );
    const campaignsData = await campaignsRes.json();
    if (campaignsData.code !== 0) {
      return NextResponse.json(
        { error: campaignsData.message || "TikTok API error" },
        { status: 500 }
      );
    }

    const campaigns: Array<Record<string, unknown>> = campaignsData.data?.list || [];
    const campaignIds = campaigns.map((c) => String(c.campaign_id));

    // Pull 30-day metrics for all campaigns
    const metrics: Record<string, Record<string, unknown>> = {};
    if (campaignIds.length > 0) {
      try {
        const reportRes = await fetch(
          "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
          {
            method: "POST",
            headers: {
              "Access-Token": conn.access_token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              advertiser_id: advertiserId,
              report_type: "BASIC",
              data_level: "AUCTION_CAMPAIGN",
              dimensions: ["campaign_id"],
              metrics: [
                "spend",
                "impressions",
                "clicks",
                "conversion",
                "ctr",
                "complete_payment_roas",
              ],
              filters: [
                { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
              ],
              lifetime: true,
            }),
          }
        );
        const reportData = await reportRes.json();
        for (const row of reportData.data?.list || []) {
          const dims = (row as { dimensions?: Record<string, unknown> }).dimensions || {};
          metrics[String(dims.campaign_id)] = (row as { metrics?: Record<string, unknown> }).metrics || {};
        }
      } catch {
        // ignore metrics error — we still upsert what we have
      }
    }

    const now = new Date().toISOString();
    const rows = campaigns.map((c) => {
      const id = String(c.campaign_id);
      const m = metrics[id] || {};
      const spend = Number(m.spend || 0);
      const conversions = Number(m.conversion || 0);
      const status = String(c.operation_status || c.status || "").toLowerCase();
      return {
        user_id: user.id,
        ad_account_id: adAccountRowId,
        platform: "tiktok_ads",
        external_id: id,
        name: String(c.campaign_name || ""),
        objective: c.objective_type ? String(c.objective_type).toLowerCase() : null,
        status,
        daily_budget: c.budget_mode === "BUDGET_MODE_DAY" ? Number(c.budget || 0) : null,
        total_spend: spend,
        impressions: Number(m.impressions || 0),
        clicks: Number(m.clicks || 0),
        conversions: Math.round(conversions),
        ctr: Number(m.ctr || 0),
        cpa: conversions > 0 ? spend / conversions : null,
        roas: Number(m.complete_payment_roas || 0) || null,
        start_date: c.create_time ? new Date(String(c.create_time)).toISOString().slice(0, 10) : null,
        end_date: null,
        last_synced_at: now,
        raw_data: { campaign: c, metrics: m },
      };
    });

    if (rows.length > 0) {
      await service
        .from("ad_campaigns")
        .upsert(rows, { onConflict: "user_id,platform,external_id" });
    }
    if (adAccountRowId) {
      await service
        .from("ad_accounts")
        .update({ last_synced_at: now })
        .eq("id", adAccountRowId);
    }

    return NextResponse.json({ success: true, count: rows.length, campaigns: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
