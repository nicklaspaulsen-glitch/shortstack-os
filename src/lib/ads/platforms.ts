// Unified Ads Platform Service — Meta Ads, Google Ads, TikTok Ads
// Provides API wrappers called from API routes for campaign management and sync

import { createServiceClient } from "@/lib/supabase/server";
import { AdAction } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PlatformCampaignData {
  external_id: string;
  name: string;
  status: string;
  budget_daily: number | null;
  budget_total: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
}

interface PlatformCredentials {
  access_token: string;
  account_id: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

// ─── Credentials Helper ─────────────────────────────────────────────────────────

export async function getPlatformCredentials(
  clientId: string,
  platform: string
): Promise<PlatformCredentials> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("social_accounts")
    .select("access_token, account_id, refresh_token, token_expires_at, metadata")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .single();

  if (error || !data) {
    throw new Error(`No ${platform} credentials found for client ${clientId}`);
  }

  return data as PlatformCredentials;
}

// ─── META ADS (Facebook Marketing API v21.0) ────────────────────────────────────

const META_BASE = "https://graph.facebook.com/v21.0";

async function metaFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${META_BASE}${endpoint}${separator}access_token=${accessToken}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || `Meta API error: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const metaAds = {
  async getCampaigns(
    accessToken: string,
    adAccountId: string
  ): Promise<PlatformCampaignData[]> {
    // Fetch campaigns with inline insights
    const campaignsData = await metaFetch(
      `/act_${adAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&limit=100`,
      accessToken
    );

    const campaigns = campaignsData.data || [];

    // Fetch insights for all campaigns in parallel
    const withInsights = await Promise.allSettled(
      campaigns.map(async (c: Record<string, unknown>) => {
        try {
          const insights = await metaFetch(
            `/${c.id}/insights?fields=spend,impressions,clicks,actions,ctr,cpc&date_preset=maximum`,
            accessToken
          );
          return { campaign: c, insights: insights.data?.[0] || {} };
        } catch {
          return { campaign: c, insights: {} };
        }
      })
    );

    return withInsights.map((result) => {
      if (result.status === "rejected") {
        return null;
      }
      const { campaign: c, insights: i } = result.value;
      const conversions = (i.actions || [])
        .filter((a: Record<string, string>) =>
          ["offsite_conversion", "lead", "purchase", "complete_registration"].includes(a.action_type)
        )
        .reduce((sum: number, a: Record<string, string>) => sum + parseFloat(a.value || "0"), 0);

      const spend = parseFloat(i.spend || "0");
      const revenue = (i.actions || [])
        .filter((a: Record<string, string>) => a.action_type === "purchase")
        .reduce((sum: number, a: Record<string, string>) => sum + parseFloat(a.value || "0"), 0);

      return {
        external_id: String(c.id),
        name: String(c.name),
        status: mapMetaStatus(String(c.status)),
        budget_daily: c.daily_budget ? parseFloat(String(c.daily_budget)) / 100 : null,
        budget_total: c.lifetime_budget ? parseFloat(String(c.lifetime_budget)) / 100 : null,
        spend,
        impressions: parseInt(i.impressions || "0", 10),
        clicks: parseInt(i.clicks || "0", 10),
        conversions,
        ctr: parseFloat(i.ctr || "0"),
        cpc: parseFloat(i.cpc || "0"),
        roas: spend > 0 ? revenue / spend : 0,
      };
    }).filter(Boolean) as PlatformCampaignData[];
  },

  async getCampaignInsights(
    accessToken: string,
    campaignId: string,
    dateRange?: { since: string; until: string }
  ) {
    const dateParam = dateRange
      ? `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
      : "&date_preset=last_30d";

    return metaFetch(
      `/${campaignId}/insights?fields=spend,impressions,clicks,actions,ctr,cpc,cpm,reach,frequency,cost_per_action_type${dateParam}`,
      accessToken
    );
  },

  async updateCampaignBudget(
    accessToken: string,
    campaignId: string,
    dailyBudget: number
  ) {
    // Meta expects budget in cents
    return metaFetch(`/${campaignId}`, accessToken, {
      method: "POST",
      body: JSON.stringify({ daily_budget: Math.round(dailyBudget * 100) }),
    });
  },

  async updateCampaignStatus(
    accessToken: string,
    campaignId: string,
    status: "ACTIVE" | "PAUSED"
  ) {
    return metaFetch(`/${campaignId}`, accessToken, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  async createAd(
    accessToken: string,
    adAccountId: string,
    adData: {
      name: string;
      campaign_id: string;
      creative: { title: string; body: string; image_url?: string; link_url: string; cta_type?: string };
      targeting?: Record<string, unknown>;
      daily_budget?: number;
    }
  ) {
    // 1. Create ad creative
    const creative = await metaFetch(`/act_${adAccountId}/adcreatives`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        name: `${adData.name} Creative`,
        object_story_spec: {
          page_id: adData.creative.image_url
            ? undefined
            : undefined, // Caller should set page_id in metadata
          link_data: {
            message: adData.creative.body,
            link: adData.creative.link_url,
            name: adData.creative.title,
            call_to_action: {
              type: adData.creative.cta_type || "LEARN_MORE",
            },
            ...(adData.creative.image_url ? { image_url: adData.creative.image_url } : {}),
          },
        },
      }),
    });

    // 2. Create ad set if targeting/budget provided
    let adSetId = adData.campaign_id;
    if (adData.targeting || adData.daily_budget) {
      const adSet = await metaFetch(`/act_${adAccountId}/adsets`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: `${adData.name} Ad Set`,
          campaign_id: adData.campaign_id,
          daily_budget: adData.daily_budget ? Math.round(adData.daily_budget * 100) : undefined,
          billing_event: "IMPRESSIONS",
          optimization_goal: "REACH",
          targeting: adData.targeting || { geo_locations: { countries: ["US"] } },
          status: "PAUSED",
        }),
      });
      adSetId = adSet.id;
    }

    // 3. Create the ad
    return metaFetch(`/act_${adAccountId}/ads`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        name: adData.name,
        adset_id: adSetId,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      }),
    });
  },
};

function mapMetaStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    DELETED: "archived",
    ARCHIVED: "archived",
  };
  return map[status] || "draft";
}

// ─── GOOGLE ADS (Google Ads API v17 REST) ────────────────────────────────────────

const GOOGLE_ADS_BASE = "https://googleads.googleapis.com/v17";

async function googleAdsFetch(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${GOOGLE_ADS_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
      ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
        ? { "login-customer-id": process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID }
        : {}),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || `Google Ads API error: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const googleAds = {
  async getCampaigns(
    accessToken: string,
    customerId: string
  ): Promise<PlatformCampaignData[]> {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        campaign_budget.type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions_value
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `;

    const data = await googleAdsFetch(
      `/customers/${customerId}/googleAds:searchStream`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ query }),
      }
    );

    // searchStream returns array of result batches
    const results = (data[0]?.results || data.results || []) as Array<Record<string, unknown>>;

    return results.map((row: Record<string, unknown>) => {
      const c = row.campaign as Record<string, unknown>;
      const m = row.metrics as Record<string, unknown>;
      const b = row.campaignBudget as Record<string, unknown>;

      const costMicros = Number(m?.costMicros || 0);
      const spend = costMicros / 1_000_000;
      const conversionsValue = Number(m?.conversionsValue || 0);
      const budgetMicros = Number(b?.amountMicros || 0);
      const budgetType = String(b?.type || "STANDARD");

      return {
        external_id: String(c?.id || ""),
        name: String(c?.name || ""),
        status: mapGoogleStatus(String(c?.status || "")),
        budget_daily: budgetType === "STANDARD" ? budgetMicros / 1_000_000 : null,
        budget_total: budgetType !== "STANDARD" ? budgetMicros / 1_000_000 : null,
        spend,
        impressions: Number(m?.impressions || 0),
        clicks: Number(m?.clicks || 0),
        conversions: Number(m?.conversions || 0),
        ctr: Number(m?.ctr || 0) * 100, // Google returns as decimal
        cpc: Number(m?.averageCpc || 0) / 1_000_000,
        roas: spend > 0 ? conversionsValue / spend : 0,
      };
    });
  },

  async getCampaignMetrics(
    accessToken: string,
    customerId: string,
    campaignId: string
  ) {
    const query = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions_value
      FROM campaign
      WHERE campaign.id = ${campaignId}
      ORDER BY segments.date DESC
      LIMIT 30
    `;

    return googleAdsFetch(
      `/customers/${customerId}/googleAds:searchStream`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ query }),
      }
    );
  },

  async updateCampaignBudget(
    accessToken: string,
    customerId: string,
    campaignId: string,
    dailyBudget: number
  ) {
    // First get the campaign's budget resource name
    const query = `
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignId}
      LIMIT 1
    `;

    const result = await googleAdsFetch(
      `/customers/${customerId}/googleAds:searchStream`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ query }),
      }
    );

    const budgetResourceName =
      result[0]?.results?.[0]?.campaign?.campaignBudget ||
      result.results?.[0]?.campaign?.campaignBudget;

    if (!budgetResourceName) {
      throw new Error("Campaign budget resource not found");
    }

    return googleAdsFetch(
      `/customers/${customerId}/campaignBudgets:mutate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: budgetResourceName,
                amountMicros: Math.round(dailyBudget * 1_000_000).toString(),
              },
              updateMask: "amount_micros",
            },
          ],
        }),
      }
    );
  },

  async updateCampaignStatus(
    accessToken: string,
    customerId: string,
    campaignId: string,
    status: "ENABLED" | "PAUSED"
  ) {
    return googleAdsFetch(
      `/customers/${customerId}/campaigns:mutate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: `customers/${customerId}/campaigns/${campaignId}`,
                status,
              },
              updateMask: "status",
            },
          ],
        }),
      }
    );
  },
};

function mapGoogleStatus(status: string): string {
  const map: Record<string, string> = {
    ENABLED: "active",
    PAUSED: "paused",
    REMOVED: "archived",
  };
  return map[status] || "draft";
}

// ─── TIKTOK ADS (TikTok Marketing API v1.3) ─────────────────────────────────────

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";

async function tiktokFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`${TIKTOK_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(data.message || `TikTok API error: code ${data.code}`);
  }

  if (!res.ok) {
    throw new Error(`TikTok API HTTP error: ${res.status}`);
  }

  return data;
}

export const tiktokAds = {
  async getCampaigns(
    accessToken: string,
    advertiserId: string
  ): Promise<PlatformCampaignData[]> {
    // Fetch campaigns list
    const campaignsRes = await tiktokFetch(
      `/campaign/get/?advertiser_id=${advertiserId}&page_size=100`,
      accessToken
    );

    const campaigns = campaignsRes.data?.list || [];

    if (campaigns.length === 0) return [];

    // Fetch metrics for all campaigns
    const campaignIds = campaigns.map((c: Record<string, unknown>) => String(c.campaign_id));

    const metrics: Record<string, Record<string, unknown>> = {};
    try {
      const metricsRes = await tiktokFetch(
        "/report/integrated/get/",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            advertiser_id: advertiserId,
            report_type: "BASIC",
            data_level: "AUCTION_CAMPAIGN",
            dimensions: ["campaign_id"],
            metrics: ["spend", "impressions", "clicks", "conversion", "ctr", "cpc", "complete_payment_roas"],
            filters: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) }],
            lifetime: true,
          }),
        }
      );

      for (const row of metricsRes.data?.list || []) {
        const dims = row.dimensions || {};
        metrics[String(dims.campaign_id)] = row.metrics || {};
      }
    } catch {
      // Proceed without metrics if report fails
    }

    return campaigns.map((c: Record<string, unknown>) => {
      const id = String(c.campaign_id);
      const m = metrics[id] || {};

      const spend = parseFloat(String(m.spend || "0"));

      return {
        external_id: id,
        name: String(c.campaign_name || ""),
        status: mapTiktokStatus(String(c.operation_status || c.secondary_status || "")),
        budget_daily: c.budget_mode === "BUDGET_MODE_DAY" ? parseFloat(String(c.budget || "0")) : null,
        budget_total: c.budget_mode === "BUDGET_MODE_TOTAL" ? parseFloat(String(c.budget || "0")) : null,
        spend,
        impressions: parseInt(String(m.impressions || "0"), 10),
        clicks: parseInt(String(m.clicks || "0"), 10),
        conversions: parseInt(String(m.conversion || "0"), 10),
        ctr: parseFloat(String(m.ctr || "0")),
        cpc: parseFloat(String(m.cpc || "0")),
        roas: parseFloat(String(m.complete_payment_roas || "0")),
      };
    });
  },

  async getCampaignMetrics(
    accessToken: string,
    advertiserId: string,
    campaignId: string
  ) {
    return tiktokFetch(
      "/report/integrated/get/",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: ["campaign_id", "stat_time_day"],
          metrics: ["spend", "impressions", "clicks", "conversion", "ctr", "cpc", "cpm", "complete_payment_roas"],
          filters: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([campaignId]) }],
          start_date: getDateDaysAgo(30),
          end_date: getToday(),
        }),
      }
    );
  },

  async updateCampaignBudget(
    accessToken: string,
    advertiserId: string,
    campaignId: string,
    dailyBudget: number
  ) {
    return tiktokFetch(
      "/campaign/update/",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          budget: dailyBudget,
          budget_mode: "BUDGET_MODE_DAY",
        }),
      }
    );
  },

  async updateCampaignStatus(
    accessToken: string,
    advertiserId: string,
    campaignId: string,
    status: "ENABLE" | "DISABLE"
  ) {
    return tiktokFetch(
      "/campaign/status/update/",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_ids: [campaignId],
          opt_status: status,
        }),
      }
    );
  },
};

function mapTiktokStatus(status: string): string {
  const map: Record<string, string> = {
    CAMPAIGN_STATUS_ENABLE: "active",
    CAMPAIGN_STATUS_DISABLE: "paused",
    CAMPAIGN_STATUS_DELETE: "archived",
    ENABLE: "active",
    DISABLE: "paused",
  };
  return map[status] || "draft";
}

// ─── UNIFIED: Sync Campaigns ────────────────────────────────────────────────────

export async function syncPlatformCampaigns(
  clientId: string,
  platform: string
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const creds = await getPlatformCredentials(clientId, platform);

    let campaigns: PlatformCampaignData[];

    switch (platform) {
      case "meta_ads":
        campaigns = await metaAds.getCampaigns(creds.access_token, creds.account_id);
        break;
      case "google_ads":
        campaigns = await googleAds.getCampaigns(creds.access_token, creds.account_id);
        break;
      case "tiktok_ads":
        campaigns = await tiktokAds.getCampaigns(creds.access_token, creds.account_id);
        break;
      default:
        return { synced: 0, errors: [`Unsupported platform: ${platform}`] };
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    for (const campaign of campaigns) {
      try {
        // Check if campaign already exists
        const { data: existing } = await supabase
          .from("campaigns")
          .select("id")
          .eq("external_campaign_id", campaign.external_id)
          .eq("client_id", clientId)
          .maybeSingle();

        const campaignRow = {
          client_id: clientId,
          platform,
          external_campaign_id: campaign.external_id,
          name: campaign.name,
          status: campaign.status,
          budget_daily: campaign.budget_daily,
          budget_total: campaign.budget_total,
          spend: campaign.spend,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          roas: campaign.roas,
          last_synced_at: now,
        };

        if (existing?.id) {
          const { error } = await supabase
            .from("campaigns")
            .update(campaignRow)
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("campaigns")
            .insert({ ...campaignRow, settings: {} });

          if (error) throw error;
        }

        synced++;
      } catch (err) {
        errors.push(`Failed to sync campaign ${campaign.external_id}: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Platform sync failed: ${String(err)}`);
  }

  return { synced, errors };
}

// ─── UNIFIED: Execute Ad Action ─────────────────────────────────────────────────

export async function executePlatformAction(
  action: AdAction
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    if (!action.client_id) {
      return { success: false, error: "No client_id on action" };
    }

    const creds = await getPlatformCredentials(action.client_id, action.platform);
    const changes = action.proposed_changes;

    let result: unknown;

    switch (action.action_type) {
      case "budget_increase":
      case "budget_decrease": {
        const newBudget = Number(changes.new_budget || changes.daily_budget);
        if (!newBudget || !changes.external_campaign_id) {
          return { success: false, error: "Missing new_budget or external_campaign_id in proposed_changes" };
        }

        const campaignId = String(changes.external_campaign_id);

        if (action.platform === "meta_ads") {
          result = await metaAds.updateCampaignBudget(creds.access_token, campaignId, newBudget);
        } else if (action.platform === "google_ads") {
          result = await googleAds.updateCampaignBudget(creds.access_token, creds.account_id, campaignId, newBudget);
        } else if (action.platform === "tiktok_ads") {
          result = await tiktokAds.updateCampaignBudget(creds.access_token, creds.account_id, campaignId, newBudget);
        }
        break;
      }

      case "pause_campaign": {
        const campaignId = String(changes.external_campaign_id);
        if (!campaignId) {
          return { success: false, error: "Missing external_campaign_id in proposed_changes" };
        }

        if (action.platform === "meta_ads") {
          result = await metaAds.updateCampaignStatus(creds.access_token, campaignId, "PAUSED");
        } else if (action.platform === "google_ads") {
          result = await googleAds.updateCampaignStatus(creds.access_token, creds.account_id, campaignId, "PAUSED");
        } else if (action.platform === "tiktok_ads") {
          result = await tiktokAds.updateCampaignStatus(creds.access_token, creds.account_id, campaignId, "DISABLE");
        }
        break;
      }

      case "activate_campaign": {
        const campaignId = String(changes.external_campaign_id);
        if (!campaignId) {
          return { success: false, error: "Missing external_campaign_id in proposed_changes" };
        }

        if (action.platform === "meta_ads") {
          result = await metaAds.updateCampaignStatus(creds.access_token, campaignId, "ACTIVE");
        } else if (action.platform === "google_ads") {
          result = await googleAds.updateCampaignStatus(creds.access_token, creds.account_id, campaignId, "ENABLED");
        } else if (action.platform === "tiktok_ads") {
          result = await tiktokAds.updateCampaignStatus(creds.access_token, creds.account_id, campaignId, "ENABLE");
        }
        break;
      }

      case "create_ad": {
        if (action.platform === "meta_ads") {
          result = await metaAds.createAd(creds.access_token, creds.account_id, {
            name: String(changes.name || action.title),
            campaign_id: String(changes.campaign_id || changes.external_campaign_id),
            creative: {
              title: String(changes.headline || ""),
              body: String(changes.body_text || ""),
              image_url: changes.image_url ? String(changes.image_url) : undefined,
              link_url: String(changes.link_url || ""),
              cta_type: changes.cta_type ? String(changes.cta_type) : undefined,
            },
            targeting: changes.targeting as Record<string, unknown> | undefined,
            daily_budget: changes.daily_budget ? Number(changes.daily_budget) : undefined,
          });
        } else {
          return { success: false, error: `create_ad not yet supported for ${action.platform}` };
        }
        break;
      }

      default:
        return { success: false, error: `Unsupported action type: ${action.action_type}` };
    }

    // Update the action record as executed
    const supabase = createServiceClient();
    await supabase
      .from("ad_actions")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        execution_result: result ? (typeof result === "object" ? result : { result }) : {},
      })
      .eq("id", action.id);

    return { success: true, result };
  } catch (err) {
    // Mark action as failed
    try {
      const supabase = createServiceClient();
      await supabase
        .from("ad_actions")
        .update({
          status: "failed",
          error_message: String(err),
        })
        .eq("id", action.id);
    } catch {
      // Best effort status update
    }

    return { success: false, error: String(err) };
  }
}

// ─── Date Helpers ────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
