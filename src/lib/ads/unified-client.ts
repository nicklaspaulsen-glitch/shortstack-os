/**
 * UnifiedAdsClient — single facade over Meta / Google / TikTok ad APIs.
 *
 * The unified Ads Manager dashboard (`/dashboard/ads-manager`) uses this client
 * so the UI doesn't need to branch on platform for every operation. Internally
 * we dispatch to the existing per-platform clients in `src/lib/ads/platforms.ts`
 * (Meta + Google + TikTok) plus the Zernio fallback for accounts connected via
 * Zernio's hosted OAuth.
 *
 * Design notes:
 *   - The client is supabase-aware: `listCampaigns` reads from `ad_campaigns`
 *     (the synced cache populated by /api/ads/{platform}/campaigns) so the UI
 *     doesn't hit upstream APIs on every render. Mutations (`pauseCampaign`,
 *     `updateBudget`) DO hit the upstream API — there's no point in caching a
 *     mutation.
 *   - Result shapes are normalised across platforms. A Meta CTR (decimal) and
 *     a Google CTR (decimal) both come out as a percentage in the 0-100 range.
 *   - TikTok ad management routes through `tiktokAds` in platforms.ts, which
 *     calls the TikTok Marketing API. Until the TikTok app is approved for
 *     production access, calls return a "pending_approval" status rather than
 *     throwing — the UI can render an explanatory pill.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { metaAds, googleAds, tiktokAds, getPlatformCredentials } from "./platforms";

export type UnifiedPlatform = "meta" | "google" | "tiktok";

/** Map UI-facing platform key to the internal `oauth_connections.platform`. */
const PLATFORM_TO_OAUTH: Record<UnifiedPlatform, string> = {
  meta: "meta_ads",
  google: "google_ads",
  tiktok: "tiktok_ads",
};

export interface UnifiedCampaign {
  /** Internal Supabase row id (uuid) when sourced from cache. */
  id: string;
  /** Platform-native campaign id (Meta act_*, Google customers/*, etc). */
  externalId: string;
  platform: UnifiedPlatform;
  name: string;
  status: "active" | "paused" | "ended" | "draft" | "unknown";
  objective: string | null;
  dailyBudget: number | null;
  totalSpend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
  startDate: string | null;
  endDate: string | null;
  /** ISO timestamp of the last sync from the upstream API. */
  lastSyncedAt: string | null;
}

export interface UnifiedActionResult {
  success: boolean;
  error?: string;
  /** Set when the platform isn't yet approved (e.g. TikTok pending review). */
  pendingApproval?: boolean;
}

export interface UnifiedListFilters {
  platform?: UnifiedPlatform;
  status?: "active" | "paused" | "ended" | "all";
  /** ISO date — only campaigns whose start_date >= this. */
  fromDate?: string;
  /** ISO date — only campaigns whose end_date <= this (or open-ended). */
  toDate?: string;
}

/** Normalise a raw `ad_campaigns` row into a UnifiedCampaign. */
function rowToCampaign(row: Record<string, unknown>): UnifiedCampaign {
  const platformRaw = String(row.platform || "");
  const platform: UnifiedPlatform =
    platformRaw === "meta_ads" || platformRaw === "meta"
      ? "meta"
      : platformRaw === "google_ads" || platformRaw === "google"
      ? "google"
      : platformRaw === "tiktok_ads" || platformRaw === "tiktok"
      ? "tiktok"
      : "meta";

  const statusRaw = String(row.status || "").toLowerCase();
  const status: UnifiedCampaign["status"] =
    statusRaw === "active" || statusRaw === "enabled"
      ? "active"
      : statusRaw === "paused" || statusRaw === "disable" || statusRaw === "disabled"
      ? "paused"
      : statusRaw === "ended" || statusRaw === "completed"
      ? "ended"
      : statusRaw === "draft"
      ? "draft"
      : "unknown";

  const totalSpend = Number(row.total_spend ?? row.spend ?? 0);
  const conversions = Number(row.conversions ?? 0);
  const cpa =
    row.cpa !== null && row.cpa !== undefined
      ? Number(row.cpa)
      : conversions > 0
      ? totalSpend / conversions
      : null;
  const roasVal = row.roas;
  const roas = roasVal === null || roasVal === undefined ? null : Number(roasVal);

  return {
    id: String(row.id || ""),
    externalId: String(row.external_id || row.external_campaign_id || ""),
    platform,
    name: String(row.name || ""),
    status,
    objective: row.objective ? String(row.objective) : null,
    dailyBudget:
      row.daily_budget !== null && row.daily_budget !== undefined
        ? Number(row.daily_budget)
        : null,
    totalSpend,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions,
    ctr: Number(row.ctr ?? 0),
    cpa,
    roas,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
  };
}

export class UnifiedAdsClient {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
  ) {}

  /**
   * List campaigns from the cached `ad_campaigns` table (refreshed nightly
   * by /api/cron/refresh-ads-metrics, or on-demand via the per-platform
   * /api/ads/{platform}/campaigns endpoints).
   */
  async listCampaigns(filters: UnifiedListFilters = {}): Promise<UnifiedCampaign[]> {
    let query = this.supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .order("total_spend", { ascending: false });

    if (filters.platform) {
      const oauthPlatform = PLATFORM_TO_OAUTH[filters.platform];
      query = query.in("platform", [filters.platform, oauthPlatform]);
    }
    if (filters.status && filters.status !== "all") {
      // Match both UI-facing status and platform-native variants.
      const variants = statusVariants(filters.status);
      query = query.in("status", variants);
    }
    if (filters.fromDate) {
      query = query.gte("start_date", filters.fromDate);
    }
    if (filters.toDate) {
      query = query.or(`end_date.is.null,end_date.lte.${filters.toDate}`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[UnifiedAdsClient] listCampaigns error:", error);
      return [];
    }
    const rows = (data || []) as Array<Record<string, unknown>>;
    return rows.map(rowToCampaign);
  }

  /** Pause a campaign on the upstream platform. */
  async pauseCampaign(
    platform: UnifiedPlatform,
    externalCampaignId: string,
  ): Promise<UnifiedActionResult> {
    return this.setStatus(platform, externalCampaignId, "paused");
  }

  /** Resume (activate) a paused campaign. */
  async resumeCampaign(
    platform: UnifiedPlatform,
    externalCampaignId: string,
  ): Promise<UnifiedActionResult> {
    return this.setStatus(platform, externalCampaignId, "active");
  }

  /**
   * Update the daily budget on a campaign. `amount` is in account currency
   * units (NOT cents). Caller is responsible for currency conversion.
   */
  async updateBudget(
    platform: UnifiedPlatform,
    externalCampaignId: string,
    amount: number,
  ): Promise<UnifiedActionResult> {
    if (!Number.isFinite(amount) || amount < 0) {
      return { success: false, error: "Budget must be a non-negative number" };
    }

    try {
      const creds = await this.creds(platform);
      if (!creds) return { success: false, error: `${platform} not connected` };

      if (platform === "meta") {
        await metaAds.updateCampaignBudget(creds.access_token, externalCampaignId, amount);
      } else if (platform === "google") {
        await googleAds.updateCampaignBudget(
          creds.access_token,
          creds.account_id,
          externalCampaignId,
          amount,
        );
      } else if (platform === "tiktok") {
        // Soft-fail: TikTok Marketing API requires app approval. Routes to
        // tiktokAds anyway so we benefit when approval lands.
        try {
          await tiktokAds.updateCampaignBudget(
            creds.access_token,
            creds.account_id,
            externalCampaignId,
            amount,
          );
        } catch (err) {
          console.warn("[UnifiedAdsClient] TikTok budget update failed:", err);
          return {
            success: false,
            pendingApproval: true,
            error: "TikTok ad management is awaiting app approval.",
          };
        }
      }

      // Update cache so the UI reflects the change immediately.
      await this.supabase
        .from("ad_campaigns")
        .update({ daily_budget: amount, last_synced_at: new Date().toISOString() })
        .eq("user_id", this.userId)
        .eq("external_id", externalCampaignId);

      return { success: true };
    } catch (err) {
      console.error("[UnifiedAdsClient] updateBudget error:", err);
      return { success: false, error: errMsg(err) };
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async setStatus(
    platform: UnifiedPlatform,
    externalCampaignId: string,
    target: "active" | "paused",
  ): Promise<UnifiedActionResult> {
    try {
      const creds = await this.creds(platform);
      if (!creds) return { success: false, error: `${platform} not connected` };

      if (platform === "meta") {
        const metaStatus = target === "active" ? "ACTIVE" : "PAUSED";
        await metaAds.updateCampaignStatus(creds.access_token, externalCampaignId, metaStatus);
      } else if (platform === "google") {
        const googleStatus = target === "active" ? "ENABLED" : "PAUSED";
        await googleAds.updateCampaignStatus(
          creds.access_token,
          creds.account_id,
          externalCampaignId,
          googleStatus,
        );
      } else if (platform === "tiktok") {
        try {
          const tiktokStatus = target === "active" ? "ENABLE" : "DISABLE";
          await tiktokAds.updateCampaignStatus(
            creds.access_token,
            creds.account_id,
            externalCampaignId,
            tiktokStatus,
          );
        } catch (err) {
          console.warn("[UnifiedAdsClient] TikTok status update failed:", err);
          return {
            success: false,
            pendingApproval: true,
            error: "TikTok ad management is awaiting app approval.",
          };
        }
      }

      await this.supabase
        .from("ad_campaigns")
        .update({ status: target, last_synced_at: new Date().toISOString() })
        .eq("user_id", this.userId)
        .eq("external_id", externalCampaignId);

      return { success: true };
    } catch (err) {
      console.error("[UnifiedAdsClient] setStatus error:", err);
      return { success: false, error: errMsg(err) };
    }
  }

  /**
   * Look up upstream OAuth credentials for the user. Reads `oauth_connections`
   * directly (the same table that getPlatformCredentials in platforms.ts uses
   * for client-scoped social connections — different schema, hence we don't
   * call it here).
   */
  private async creds(
    platform: UnifiedPlatform,
  ): Promise<{ access_token: string; account_id: string } | null> {
    const oauthPlatform = PLATFORM_TO_OAUTH[platform];
    const { data } = await this.supabase
      .from("oauth_connections")
      .select("access_token, account_id, is_active")
      .eq("user_id", this.userId)
      .in("platform", [oauthPlatform, platform])
      .eq("is_active", true)
      .maybeSingle();

    if (!data?.access_token || !data?.account_id) return null;
    return { access_token: data.access_token, account_id: data.account_id };
  }
}

/** Status filter helper — match UI status against DB-stored variants. */
function statusVariants(status: "active" | "paused" | "ended"): string[] {
  if (status === "active") return ["active", "ACTIVE", "ENABLED", "enabled"];
  if (status === "paused") return ["paused", "PAUSED", "DISABLE", "DISABLED", "disabled"];
  return ["ended", "ENDED", "completed", "COMPLETED"];
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Re-export getPlatformCredentials for downstream consumers that already
// import from platforms.ts.
export { getPlatformCredentials };
