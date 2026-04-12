import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Google Ads API — campaign management, performance data
// Requires: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Uses same Google OAuth tokens with ads scope

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", "google_ads")
    .eq("is_active", true)
    .single();

  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Ads not connected", connected: false }, { status: 404 });
  }

  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) return NextResponse.json({ error: "Google Ads developer token not configured" }, { status: 500 });

  const customerId = (account.account_id || "").replace(/-/g, "");
  const action = request.nextUrl.searchParams.get("action") || "campaigns";

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${account.access_token}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
    };
    if (account.metadata?.manager_id) {
      headers["login-customer-id"] = String(account.metadata.manager_id).replace(/-/g, "");
    }

    if (action === "campaigns") {
      const res = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                    metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
                    metrics.ctr, metrics.average_cpc
                    FROM campaign
                    WHERE segments.date DURING LAST_30_DAYS
                    ORDER BY metrics.cost_micros DESC
                    LIMIT 50`,
          }),
        }
      );
      const data = await res.json();
      const campaigns = (data[0]?.results || []).map((r: Record<string, Record<string, unknown>>) => ({
        id: r.campaign?.id,
        name: r.campaign?.name,
        status: r.campaign?.status,
        channel: r.campaign?.advertisingChannelType,
        impressions: Number(r.metrics?.impressions || 0),
        clicks: Number(r.metrics?.clicks || 0),
        cost: Number(r.metrics?.costMicros || 0) / 1000000,
        conversions: Number(r.metrics?.conversions || 0),
        ctr: Number(r.metrics?.ctr || 0),
        avg_cpc: Number(r.metrics?.averageCpc || 0) / 1000000,
      }));
      return NextResponse.json({ success: true, campaigns });
    }

    if (action === "account_summary") {
      const res = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
                    metrics.ctr, metrics.average_cpc, metrics.conversions_value
                    FROM customer
                    WHERE segments.date DURING LAST_30_DAYS`,
          }),
        }
      );
      const data = await res.json();
      const m = data[0]?.results?.[0]?.metrics || {};
      return NextResponse.json({
        success: true,
        summary: {
          impressions: Number(m.impressions || 0),
          clicks: Number(m.clicks || 0),
          cost: Number(m.costMicros || 0) / 1000000,
          conversions: Number(m.conversions || 0),
          ctr: Number(m.ctr || 0),
          avg_cpc: Number(m.averageCpc || 0) / 1000000,
          conversion_value: Number(m.conversionsValue || 0),
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Google Ads API error: ${err}` }, { status: 500 });
  }
}

// Pause/enable campaigns
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, action, campaign_id, status } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("client_id", client_id)
    .eq("platform", "google_ads")
    .eq("is_active", true)
    .single();

  if (!account?.access_token) return NextResponse.json({ error: "Google Ads not connected" }, { status: 404 });

  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) return NextResponse.json({ error: "Developer token not configured" }, { status: 500 });

  const customerId = (account.account_id || "").replace(/-/g, "");

  try {
    if (action === "update_campaign_status") {
      const res = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "developer-token": devToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operations: [{
              update: { resourceName: `customers/${customerId}/campaigns/${campaign_id}`, status },
              updateMask: "status",
            }],
          }),
        }
      );
      const data = await res.json();

      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `Google Ads campaign ${campaign_id} set to ${status}`,
        client_id,
        status: "completed",
        result: { type: "google_ads_update", campaign_id, new_status: status },
      });

      return NextResponse.json({ success: true, result: data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Google Ads API error: ${err}` }, { status: 500 });
  }
}
