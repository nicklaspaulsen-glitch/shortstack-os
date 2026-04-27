/**
 * Shared types for the unified Ads Manager UI components.
 * Mirrors the response shapes returned by /api/ads-manager/*.
 */

export type Platform = "meta" | "google" | "tiktok";

export interface PlatformTotals {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  roas: number | null;
  campaigns: number;
}

export interface OverviewResponse {
  totals: PlatformTotals;
  perPlatform: Record<Platform, PlatformTotals>;
  dailySeries: Array<{
    date: string;
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    platform: Platform;
    spend: number;
    roas: number | null;
    status: string;
  }>;
  bestPlatform: Platform | null;
}

export interface CampaignRow {
  id: string;
  externalId: string;
  platform: Platform;
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
  lastSyncedAt: string | null;
}

export interface CampaignsResponse {
  campaigns: CampaignRow[];
  total: number;
}

export interface SuggestionRow {
  id: string;
  suggestion_type: "reallocate" | "pause" | "scale" | "optimize_creative";
  platform: Platform | null;
  campaign_id: string | null;
  rationale: string | null;
  potential_lift_pct: number | null;
  current_state: Record<string, unknown> | null;
  suggested_state: Record<string, unknown> | null;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
}

export interface PlatformDailyPoint {
  date: string;
  meta: number;
  google: number;
  tiktok: number;
}

export interface InsightsResponse {
  suggestions: SuggestionRow[];
  charts: {
    spend: PlatformDailyPoint[];
    conversions: PlatformDailyPoint[];
    roas: PlatformDailyPoint[];
  };
}

export interface AllocationSlice {
  platform: Platform;
  amount: number;
  pct: number;
}

export interface BudgetsResponse {
  current: AllocationSlice[];
  suggested: AllocationSlice[] | null;
  rationale: string | null;
  totalDailyBudget: number;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  meta: "#1877F2",
  google: "#34A853",
  tiktok: "#FF0050",
};
