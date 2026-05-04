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

export type UnifiedPlatform = "meta" | "google" | "tiktok" | "linkedin" | "pinterest";

/** Map UI-facing platform key to the internal `oauth_connections.platform`. */
const PLATFORM_TO_OAUTH: Record<UnifiedPlatform, string> = {
  meta: "meta_ads",
  google: "google_ads",
  tiktok: "tiktok_ads",
  linkedin: "linkedin_ads",
  pinterest: "pinterest_ads",
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
      : platformRaw === "linkedin_ads" || platformRaw === "linkedin"
      ? "linkedin"
      : platformRaw === "pinterest_ads" || platformRaw === "pinterest"
      ? "pinterest"
      : "meta";

  const statusRaw = String(row.status || "").toLowerCase();
  const status: UnifiedCampaign["status"] =
    // active: Meta ACTIVE, Google ENABLED, TikTok RUNNING, LinkedIn ACTIVE, Pinterest ACTIVE
    statusRaw === "active" || statusRaw === "enabled" || statusRaw === "running"
      ? "active"
      // paused: Meta/TikTok PAUSED, Google PAUSED, TikTok DISABLE/DISABLED, LinkedIn PAUSED
      : statusRaw === "paused" || statusRaw === "disable" || statusRaw === "disabled"
      ? "paused"
      // ended: any terminal state — completed, archived, canceled (LinkedIn), cancelled (alt spelling)
      : statusRaw === "ended" || statusRaw === "completed" || statusRaw === "archived"
        || statusRaw === "canceled" || statusRaw === "cancelled"
      ? "ended"
      // draft: LinkedIn DRAFT (not yet submitted / pending review)
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
   * List campaigns from the cache layer (refreshed nightly by
   * /api/cron/refresh-ads-metrics, or on-demand via /api/ads/{platform}/campaigns).
   *
   * Read path per platform:
   *   - meta / google / tiktok → `ad_campaigns` table
   *   - linkedin / pinterest   → `ads_metrics_cache` (populated by Zernio sync)
   *
   * When no platform filter is supplied both tables are queried and results merged.
   */
  async listCampaigns(filters: UnifiedListFilters = {}): Promise<UnifiedCampaign[]> {
    const isZernioOnly =
      filters.platform === "linkedin" || filters.platform === "pinterest";
    const isAllPlatforms = !filters.platform;

    // ── ad_campaigns (Meta / Google / TikTok) ──────────────────────────
    const adCampaigns: UnifiedCampaign[] = [];
    if (!isZernioOnly) {
      let query = this.supabase
        .from("ad_campaigns")
        .select("*")
        .eq("user_id", this.userId)
        .order("total_spend", { ascending: false });

      if (filters.platform) {
        const oauthPlatform = PLATFORM_TO_OAUTH[filters.platform];
        query = query.in("platform", [filters.platform, oauthPlatform]);
      } else {
        // When all platforms are requested, explicitly scope this table to
        // meta/google/tiktok — linkedin/pinterest come from ads_metrics_cache.
        query = query.in("platform", [
          "meta", "meta_ads",
          "google", "google_ads",
          "tiktok", "tiktok_ads",
        ]);
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
        console.error("[UnifiedAdsClient] listCampaigns (ad_campaigns) error:", error);
      } else {
        const rows = (data || []) as Array<Record<string, unknown>>;
        adCampaigns.push(...rows.map(rowToCampaign));
      }
    }

    // ── ads_metrics_cache (LinkedIn / Pinterest via Zernio) ─────────────
    const zernioCampaigns: UnifiedCampaign[] =
      isZernioOnly || isAllPlatforms
        ? await this.listFromMetricsCache(filters)
        : [];

    return [...adCampaigns, ...zernioCampaigns];
  }

  /**
   * Read LinkedIn/Pinterest campaigns from `ads_metrics_cache`, which is
   * populated by the nightly Zernio sync in /api/cron/refresh-ads-metrics.
   * Each campaign may have multiple date-partitioned rows — we take the most
   * recent row per campaign as the source of truth for current status/metrics.
   */
  private async listFromMetricsCache(
    filters: UnifiedListFilters,
  ): Promise<UnifiedCampaign[]> {
    const platforms =
      filters.platform === "linkedin"
        ? ["linkedin"]
        : filters.platform === "pinterest"
        ? ["pinterest"]
        : ["linkedin", "pinterest"];

    // Fetch most-recent row per (platform, campaign_id). The JS client doesn't
    // support DISTINCT ON, so we order by date DESC and deduplicate in-memory.
    const { data, error } = await this.supabase
      .from("ads_metrics_cache")
      .select("*")
      .eq("user_id", this.userId)
      .in("platform", platforms)
      .order("platform")
      .order("campaign_id")
      .order("date", { ascending: false });

    if (error) {
      console.error("[UnifiedAdsClient] listFromMetricsCache error:", error);
      return [];
    }

    // Deduplicate: keep the first occurrence of each (platform, campaign_id)
    // pair — the ordering guarantees the most-recent date row comes first.
    const seen = new Set<string>();
    const rows = (data || []) as Array<Record<string, unknown>>;
    const deduped = rows.filter((row) => {
      const key = `${row.platform}:${row.campaign_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const campaigns = deduped
      .map(cacheRowToCampaign)
      .filter((c): c is UnifiedCampaign => c !== null);

    // Apply status filter in-memory — status lives inside raw_metrics JSONB
    // and was already normalised by cacheRowToCampaign.
    if (filters.status && filters.status !== "all") {
      return campaigns.filter((c) => c.status === filters.status);
    }

    return campaigns;
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
      } else if (platform === "linkedin" || platform === "pinterest") {
        // LinkedIn/Pinterest: managed via Zernio hosted API (no direct SDK).
        // Budget mutations are not yet supported — display-only platforms.
        // Wire through /api/ads/zernio/boost when Zernio adds write access.
        console.warn(`[UnifiedAdsClient] ${platform} budget update not yet supported via Zernio write API`);
        return {
          success: false,
          error: `${platform} budget management coming soon — connect via Zernio to read campaigns.`,
        };
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
      } else if (platform === "linkedin" || platform === "pinterest") {
        // LinkedIn/Pinterest: read-only via Zernio sync. Status mutations
        // will be wired when Zernio exposes write endpoints.
        console.warn(`[UnifiedAdsClient] ${platform} status update not yet supported via Zernio write API`);
        return {
          success: false,
          error: `${platform} campaign management coming soon — campaigns are available in read-only mode.`,
        };
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

/** Status filter helper — match UI status against DB-stored variants.
 *
 * DB rows may store platform-native status strings (e.g., "ACTIVE", "PAUSED",
 * "ENABLE", "DRAFT") rather than the normalised form, so queries need to
 * match both.
 *
 * Platform coverage:
 *   Meta      — ACTIVE | PAUSED | DELETED
 *   Google    — ENABLED | PAUSED | REMOVED
 *   TikTok    — ENABLE | DISABLE | DELETED
 *   LinkedIn  — ACTIVE | PAUSED | DRAFT | CANCELED | ARCHIVED
 *   Pinterest — ACTIVE | PAUSED | COMPLETED | ARCHIVED
 */
function statusVariants(status: "active" | "paused" | "ended"): string[] {
  if (status === "active") return ["active", "ACTIVE", "ENABLED", "enabled", "RUNNING"];
  if (status === "paused") return ["paused", "PAUSED", "DISABLE", "DISABLED", "disabled", "DRAFT", "draft"];
  // "ended" — all terminal states across platforms
  return [
    "ended", "ENDED",
    "completed", "COMPLETED",
    "archived", "ARCHIVED",
    "canceled", "CANCELED",   // LinkedIn (US spelling)
    "cancelled", "CANCELLED", // alt spelling guard
    "deleted", "DELETED",     // Meta / Google / TikTok hard-delete
    "removed", "REMOVED",     // Google REMOVED
  ];
}

/**
 * Normalise a row from `ads_metrics_cache` (LinkedIn/Pinterest via Zernio)
 * into a UnifiedCampaign. Schema differs from `ad_campaigns`: monetary values
 * are stored in cents, and status/objective/ctr live inside `raw_metrics` JSONB.
 */
function cacheRowToCampaign(row: Record<string, unknown>): UnifiedCampaign | null {
  const platformRaw = String(row.platform || "");
  if (platformRaw !== "linkedin" && platformRaw !== "pinterest") return null;
  const platform = platformRaw as "linkedin" | "pinterest";

  const rawMetrics = (
    row.raw_metrics !== null && typeof row.raw_metrics === "object"
      ? row.raw_metrics
      : {}
  ) as Record<string, unknown>;

  const spendCents = Number(row.spend_cents ?? 0);
  const cpaCents =
    row.cpa_cents !== null && row.cpa_cents !== undefined
      ? Number(row.cpa_cents)
      : null;
  const conversions = Number(row.conversions ?? 0);
  // Prefer the stored cpa_cents; fall back to derived cpa from spend/conversions.
  const cpa =
    cpaCents !== null
      ? cpaCents / 100
      : conversions > 0
      ? spendCents / 100 / conversions
      : null;

  const statusRaw = String(rawMetrics.status || "").toLowerCase();
  const status: UnifiedCampaign["status"] =
    statusRaw === "active" || statusRaw === "enabled" || statusRaw === "running"
      ? "active"
      : statusRaw === "paused" || statusRaw === "disable" || statusRaw === "disabled"
      ? "paused"
      : statusRaw === "ended" ||
        statusRaw === "completed" ||
        statusRaw === "archived" ||
        statusRaw === "canceled" ||
        statusRaw === "cancelled"
      ? "ended"
      : statusRaw === "draft"
      ? "draft"
      : "unknown";

  return {
    id: String(row.campaign_id || ""),
    externalId: String(row.campaign_id || ""),
    platform,
    name: String(row.campaign_name || ""),
    status,
    objective: rawMetrics.objective ? String(rawMetrics.objective) : null,
    // daily_budget is not stored in ads_metrics_cache (Zernio metrics sync).
    dailyBudget: null,
    totalSpend: spendCents / 100,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions,
    ctr: Number(rawMetrics.ctr ?? 0),
    cpa,
    roas: row.roas !== null && row.roas !== undefined ? Number(row.roas) : null,
    // start_date / end_date are not stored in ads_metrics_cache.
    startDate: null,
    endDate: null,
    lastSyncedAt: row.fetched_at ? String(row.fetched_at) : null,
  };
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Re-export getPlatformCredentials for downstream consumers that already
// import from platforms.ts.
export { getPlatformCredentials };
