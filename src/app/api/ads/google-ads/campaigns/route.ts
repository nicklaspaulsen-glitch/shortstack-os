import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/ads/google-ads/campaigns
// Runs a GAQL query against the Google Ads API and upserts campaigns into ad_campaigns.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
  if (!devToken) {
    return NextResponse.json(
      {
        error:
          "Google Ads developer token missing. Add GOOGLE_ADS_DEVELOPER_TOKEN to .env.local",
        missing_env: ["GOOGLE_ADS_DEVELOPER_TOKEN"],
      },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("id, access_token, refresh_token, account_id, is_active, token_expires_at")
    .eq("user_id", user.id)
    .eq("platform", "google_ads")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: "Google Ads not connected. Visit /api/oauth/google-ads/start to connect." },
      { status: 400 }
    );
  }

  // Refresh the access token if it's expired or close to expiring
  let accessToken = conn.access_token;
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.refresh_token && expiresAt - Date.now() < 60_000) {
    try {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          refresh_token: conn.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
        await service
          .from("oauth_connections")
          .update({ access_token: accessToken, token_expires_at: newExpiresAt })
          .eq("id", conn.id);
      }
    } catch {
      // If refresh fails, fall through — API will surface the 401.
    }
  }

  // Resolve the customer id
  const requestedAccount = request.nextUrl.searchParams.get("ad_account_id");
  let customerId = requestedAccount || conn.account_id;
  let adAccountRowId: string | null = null;
  if (customerId) {
    const { data: adAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "google_ads")
      .eq("account_id", customerId)
      .maybeSingle();
    if (adAccount) adAccountRowId = adAccount.id;
  } else {
    const { data: defaultAccount } = await service
      .from("ad_accounts")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("platform", "google_ads")
      .eq("is_default", true)
      .maybeSingle();
    if (defaultAccount) {
      adAccountRowId = defaultAccount.id;
      customerId = defaultAccount.account_id;
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "No Google Ads customer id available" }, { status: 400 });
  }

  const gaql = `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign_budget.amount_micros,
           metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ query: gaql.trim() }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Google Ads API error" }, { status: 500 });
    }

    const results: Array<Record<string, unknown>> = [];
    const batches = Array.isArray(data) ? data : [data];
    for (const batch of batches) {
      const rows = (batch as Record<string, unknown>).results;
      if (Array.isArray(rows)) results.push(...rows);
    }

    const now = new Date().toISOString();
    const rows = results.map((row) => {
      const c = (row.campaign || {}) as Record<string, unknown>;
      const m = (row.metrics || {}) as Record<string, unknown>;
      const b = (row.campaignBudget || {}) as Record<string, unknown>;
      const spend = Number(m.costMicros || 0) / 1_000_000;
      const conversions = Number(m.conversions || 0);
      const conversionsValue = Number(m.conversionsValue || 0);
      return {
        user_id: user.id,
        ad_account_id: adAccountRowId,
        platform: "google_ads",
        external_id: String(c.id || ""),
        name: String(c.name || ""),
        objective: c.advertisingChannelType ? String(c.advertisingChannelType).toLowerCase() : null,
        status: c.status ? String(c.status).toLowerCase() : null,
        daily_budget: b.amountMicros ? Number(b.amountMicros) / 1_000_000 : null,
        total_spend: spend,
        impressions: Number(m.impressions || 0),
        clicks: Number(m.clicks || 0),
        conversions: Math.round(conversions),
        ctr: Number(m.ctr || 0) * 100,
        cpa: conversions > 0 ? spend / conversions : null,
        roas: spend > 0 ? conversionsValue / spend : null,
        start_date: null,
        end_date: null,
        last_synced_at: now,
        raw_data: row,
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
