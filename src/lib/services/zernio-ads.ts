// Zernio Ads — unified ad management across Meta / Google / TikTok / LinkedIn /
// Pinterest / X via a single REST API.
//
// We use Zernio for two things:
//  1. Social posting (existing — see src/lib/services/zernio.ts)
//  2. Cross-platform ad management (this module)
//
// The advantage over our own per-platform OAuth flows (in /api/oauth/{meta,
// google,tiktok}-ads) is that Zernio handles:
//   - The OAuth dance for all 7 platforms (one bearer token to us)
//   - API normalization (one campaign/ad object shape)
//   - Token refresh automatically
// So agencies that don't want to register their own Meta App ID + Google App
// ID + TikTok App ID can connect ad accounts via Zernio instead.
//
// Existing zernio.ts already manages per-client profiles (one Zernio profile
// per ShortStack client). Ad accounts attach to those profiles, so the
// per-client scoping is automatic.
//
// Zernio Ads API docs: https://zernio.com/social-media-ads
// Bearer auth: ZERNIO_API_KEY env (same key as social posting).

import { BRAND } from "@/lib/brand-config";

const ZERNIO_BASE = "https://api.zernio.com/v1";

async function zernioFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error("Zernio API key not configured (ZERNIO_API_KEY)");
  return fetch(`${ZERNIO_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

// Platforms Zernio supports for ads (different list from social posting!).
export const ZERNIO_AD_PLATFORMS = [
  "meta",
  "google",
  "tiktok",
  "linkedin",
  "pinterest",
  "x",
] as const;
export type ZernioAdPlatform = (typeof ZERNIO_AD_PLATFORMS)[number];

export interface ZernioAdConnection {
  platform: ZernioAdPlatform;
  status: "connected" | "expired" | "error" | "disconnected";
  account_id: string | null;
  account_name: string | null;
  /** Account currency (USD, EUR, etc) when reported by Zernio. */
  currency?: string | null;
}

export interface ZernioCampaign {
  id: string;
  platform: ZernioAdPlatform;
  account_id: string;
  name: string;
  status: "active" | "paused" | "ended" | "draft";
  objective: string | null;
  daily_budget: number | null;
  total_spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
  start_date: string | null;
  end_date: string | null;
}

export interface ZernioAdAnalytics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number | null;
  revenue: number;
  roas: number | null;
  /** Optional time-series breakdown if Zernio returns it. */
  daily?: Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
}

/**
 * Fetch the current ad-platform connections for a Zernio profile.
 *
 * Each ShortStack client has one Zernio profile (created via setupClientInZernio
 * in zernio.ts). Ad accounts (Meta/Google/TikTok/etc) connect to that profile.
 */
export async function getAdConnections(
  profileId: string,
): Promise<ZernioAdConnection[]> {
  try {
    const res = await zernioFetch(`/profiles/${profileId}/ad-connections`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.connections || data || []) as Array<Record<string, unknown>>;
    return list
      .filter((c) =>
        (ZERNIO_AD_PLATFORMS as readonly string[]).includes(String(c.platform || "")),
      )
      .map((c) => ({
        platform: String(c.platform) as ZernioAdPlatform,
        status:
          (c.status as ZernioAdConnection["status"]) || "connected",
        account_id: c.accountId ? String(c.accountId) : null,
        account_name: c.accountName ? String(c.accountName) : null,
        currency: c.currency ? String(c.currency) : null,
      }));
  } catch {
    return [];
  }
}

/**
 * Get a Zernio-hosted URL the client follows to connect a new ad account on
 * a specific platform. Zernio handles the full OAuth flow and stores the
 * tokens against the profile.
 *
 * The returned URL should be opened in a new tab — Zernio redirects back to
 * its own success/error page and updates the connection state via webhook.
 */
export async function getAdConnectUrl(params: {
  profileId: string;
  platform: ZernioAdPlatform;
  /** URL to redirect to after connection completes. */
  returnTo?: string;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await zernioFetch(
      `/profiles/${params.profileId}/ad-connections/connect`,
      {
        method: "POST",
        body: JSON.stringify({
          platform: params.platform,
          ...(params.returnTo ? { returnTo: params.returnTo } : {}),
          appLabel: `${BRAND.product_name} on ${BRAND.company_name}`,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `Error ${res.status}`,
      };
    }
    return { success: true, url: data.url || data.connectUrl || data.redirect };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * List campaigns across all (or one) connected ad platforms for a profile.
 * Returns the Zernio-normalised campaign shape — so a Meta campaign and a
 * TikTok campaign land in the same fields.
 */
export async function listCampaigns(params: {
  profileId: string;
  platform?: ZernioAdPlatform;
  status?: "active" | "paused" | "all";
  limit?: number;
}): Promise<ZernioCampaign[]> {
  try {
    const qs = new URLSearchParams();
    qs.set("profileId", params.profileId);
    if (params.platform) qs.set("platform", params.platform);
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    const res = await zernioFetch(`/ads/campaigns?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.campaigns || data || []) as Array<Record<string, unknown>>;
    return list.map(normaliseCampaign);
  } catch {
    return [];
  }
}

/**
 * Boost an organic post into a paid ad. Zernio's lowest-friction ad-creation
 * surface — give it a post URL/ID and a budget, and it spawns a paid campaign
 * for that post on the specified platform.
 *
 * Endpoint: POST /api/v1/ads/boost (per Zernio docs).
 */
export async function boostPost(params: {
  profileId: string;
  platform: ZernioAdPlatform;
  /** Either a Zernio post id (from schedulePost) or a platform-native post URL. */
  postId?: string;
  postUrl?: string;
  /** Daily budget in account currency (NOT cents). */
  dailyBudget: number;
  /** How many days to run for. */
  durationDays: number;
  /** Optional targeting. Zernio normalises this across platforms. */
  targeting?: {
    locations?: string[]; // ISO country codes
    ageMin?: number;
    ageMax?: number;
    interests?: string[];
  };
}): Promise<{ success: boolean; adId?: string; error?: string }> {
  if (!params.postId && !params.postUrl) {
    return { success: false, error: "postId or postUrl is required" };
  }
  try {
    const res = await zernioFetch("/ads/boost", {
      method: "POST",
      body: JSON.stringify({
        profileId: params.profileId,
        platform: params.platform,
        ...(params.postId ? { postId: params.postId } : {}),
        ...(params.postUrl ? { postUrl: params.postUrl } : {}),
        dailyBudget: params.dailyBudget,
        durationDays: params.durationDays,
        ...(params.targeting ? { targeting: params.targeting } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `Error ${res.status}`,
      };
    }
    return { success: true, adId: data.id || data.adId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Set ad status — pause / resume / delete a campaign or ad. Mirrors the
 * pause/resume buttons in /dashboard/ads-manager.
 */
export async function updateAdStatus(params: {
  adId: string;
  status: "active" | "paused" | "deleted";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await zernioFetch(`/ads/${params.adId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: params.status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data.message || data.error || `Error ${res.status}`,
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Per-ad analytics — spend, impressions, clicks, conversions, ROAS.
 * Endpoint: GET /api/v1/ads/{ad_id}/analytics (per Zernio docs).
 */
export async function getAdAnalytics(params: {
  adId: string;
  from?: string; // ISO date
  to?: string;
}): Promise<ZernioAdAnalytics | null> {
  try {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const path = `/ads/${params.adId}/analytics${qs.toString() ? `?${qs}` : ""}`;
    const res = await zernioFetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    return normaliseAnalytics(data);
  } catch {
    return null;
  }
}

// ─── Internal normalisers ──────────────────────────────────────────────

function normaliseCampaign(c: Record<string, unknown>): ZernioCampaign {
  const insights = (c.insights as Record<string, unknown> | undefined) || {};
  const spend = num(insights.spend ?? c.spend);
  const impressions = num(insights.impressions ?? c.impressions);
  const clicks = num(insights.clicks ?? c.clicks);
  const conversions = num(insights.conversions ?? c.conversions);
  const ctr = num(insights.ctr ?? c.ctr);
  const cpa = conversions > 0 ? spend / conversions : null;
  const revenue = num(insights.revenue ?? c.revenue);
  const roas = spend > 0 ? revenue / spend : null;
  return {
    id: String(c.id),
    platform: String(c.platform || "meta") as ZernioAdPlatform,
    account_id: String(c.accountId || c.account_id || ""),
    name: String(c.name || ""),
    status: (c.status as ZernioCampaign["status"]) || "active",
    objective: c.objective ? String(c.objective) : null,
    daily_budget:
      c.dailyBudget !== undefined && c.dailyBudget !== null ? num(c.dailyBudget) : null,
    total_spend: spend,
    impressions,
    clicks,
    conversions,
    ctr,
    cpa,
    roas,
    start_date: c.startDate ? String(c.startDate).slice(0, 10) : null,
    end_date: c.endDate ? String(c.endDate).slice(0, 10) : null,
  };
}

function normaliseAnalytics(d: Record<string, unknown>): ZernioAdAnalytics {
  const spend = num(d.spend);
  const conversions = num(d.conversions);
  const revenue = num(d.revenue);
  return {
    spend,
    impressions: num(d.impressions),
    clicks: num(d.clicks),
    ctr: num(d.ctr),
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    revenue,
    roas: spend > 0 ? revenue / spend : null,
    daily: Array.isArray(d.daily)
      ? (d.daily as Array<Record<string, unknown>>).map((row) => ({
          date: String(row.date),
          spend: num(row.spend),
          impressions: num(row.impressions),
          clicks: num(row.clicks),
          conversions: num(row.conversions),
        }))
      : undefined,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
