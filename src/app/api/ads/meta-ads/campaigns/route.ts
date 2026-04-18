import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/ads/meta-ads/campaigns
// Fetches live campaigns from the Meta Graph API and upserts into ad_campaigns.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("id, access_token, account_id, is_active")
    .eq("user_id", user.id)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: "Meta Ads not connected. Visit /api/oauth/meta-ads/start to connect." },
      { status: 400 }
    );
  }

  const requestedAccount = request.nextUrl.searchParams.get("ad_account_id");
  let adAccountId = requestedAccount || conn.account_id;
  let adAccountRowId: string | null = null;

  // Resolve the ad_account row for FK usage
  if (adAccountId) {
    const { data: adAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "meta_ads")
      .eq("account_id", adAccountId)
      .maybeSingle();
    if (adAccount) adAccountRowId = adAccount.id;
  } else {
    const { data: defaultAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "meta_ads")
      .eq("is_default", true)
      .maybeSingle();
    if (defaultAccount) {
      adAccountRowId = defaultAccount.id;
      adAccountId = defaultAccount.account_id;
    }
  }

  if (!adAccountId) {
    return NextResponse.json({ error: "No Meta ad account available" }, { status: 400 });
  }

  try {
    const fields =
      "id,name,objective,status,daily_budget,start_time,stop_time," +
      "insights.date_preset(last_30d){spend,impressions,clicks,ctr,cpm,actions,action_values}";
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns` +
        `?fields=${encodeURIComponent(fields)}` +
        `&limit=100&access_token=${encodeURIComponent(conn.access_token)}`
    );
    const campaignsData = await campaignsRes.json();
    if (campaignsData.error) {
      return NextResponse.json(
        { error: campaignsData.error.message, details: campaignsData.error },
        { status: 500 }
      );
    }

    const campaigns: Array<Record<string, unknown>> = campaignsData.data || [];
    const now = new Date().toISOString();
    const rows = campaigns.map((c) => {
      const insights = (c.insights as { data?: Array<Record<string, unknown>> })?.data?.[0] || {};
      const spend = Number(insights.spend || 0);
      const impressions = Number(insights.impressions || 0);
      const clicks = Number(insights.clicks || 0);
      const ctr = Number(insights.ctr || 0);
      const actions = (insights.actions || []) as Array<Record<string, string>>;
      const actionValues = (insights.action_values || []) as Array<Record<string, string>>;
      const conversions = actions
        .filter((a) => ["offsite_conversion", "lead", "purchase", "complete_registration"].includes(a.action_type))
        .reduce((acc, a) => acc + Number(a.value || 0), 0);
      const revenue = actionValues
        .filter((a) => a.action_type === "purchase")
        .reduce((acc, a) => acc + Number(a.value || 0), 0);
      const cpa = conversions > 0 ? spend / conversions : null;
      const roas = spend > 0 ? revenue / spend : null;

      return {
        user_id: user.id,
        ad_account_id: adAccountRowId,
        platform: "meta_ads",
        external_id: String(c.id),
        name: String(c.name || ""),
        objective: c.objective ? String(c.objective).toLowerCase() : null,
        status: c.status ? String(c.status).toLowerCase() : null,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        total_spend: spend,
        impressions,
        clicks,
        conversions: Math.round(conversions),
        ctr,
        cpa,
        roas,
        start_date: c.start_time ? new Date(String(c.start_time)).toISOString().slice(0, 10) : null,
        end_date: c.stop_time ? new Date(String(c.stop_time)).toISOString().slice(0, 10) : null,
        last_synced_at: now,
        raw_data: c,
      };
    });

    if (rows.length > 0) {
      await service
        .from("ad_campaigns")
        .upsert(rows, { onConflict: "user_id,platform,external_id" });
    }

    // Update ad_account last_synced_at
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
