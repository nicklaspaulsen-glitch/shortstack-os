/**
 * Ads Manager Audit Engine — inspired by the claude-ads 200+ check methodology.
 *
 * Scoring formula (per claude-ads scoring-system.md):
 *   S_total = Σ(C_pass × W_sev × W_cat) / Σ(C_total × W_sev × W_cat) × 100
 *
 * Severity weights: Critical=5, High=3, Medium=1.5, Low=0.5
 * Category weights: tracking=1.4, bidding=1.3, structure=1.2, creative=1.1,
 *                   audiences=1.0, competitive=0.9
 *
 * Grades: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)
 *
 * Checks are evaluated against live campaign data fetched from the ad_campaigns
 * cache. null return from evaluate() = "skip" (insufficient data to judge).
 */

import type { UnifiedCampaign, UnifiedPlatform } from "@/lib/ads/unified-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditSeverity = "critical" | "high" | "medium" | "low";
export type AuditCategory =
  | "structure"
  | "tracking"
  | "bidding"
  | "creative"
  | "audiences"
  | "competitive";
export type AuditPlatform = UnifiedPlatform | "all";
export type AuditGrade = "A" | "B" | "C" | "D" | "F";

export interface AuditInput {
  campaigns: UnifiedCampaign[];
  connectedPlatforms: UnifiedPlatform[];
}

export interface AuditCheck {
  id: string;
  name: string;
  description: string;
  severity: AuditSeverity;
  category: AuditCategory;
  platform: AuditPlatform;
  /** Returns true = pass, false = fail, null = skip (insufficient data). */
  evaluate: (input: AuditInput) => boolean | null;
  /** Human-readable recommendation shown when the check fails. */
  recommendation: string;
}

export interface AuditCheckResult {
  check: AuditCheck;
  /** null means the check was skipped — not enough data. */
  passed: boolean | null;
}

export interface AuditScore {
  score: number;
  grade: AuditGrade;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  byCategory: Record<AuditCategory, { passed: number; total: number }>;
  criticalIssues: AuditCheckResult[];
  highIssues: AuditCheckResult[];
  mediumIssues: AuditCheckResult[];
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<AuditSeverity, number> = {
  critical: 5,
  high: 3,
  medium: 1.5,
  low: 0.5,
};

const CATEGORY_WEIGHT: Record<AuditCategory, number> = {
  tracking: 1.4,
  bidding: 1.3,
  structure: 1.2,
  creative: 1.1,
  audiences: 1.0,
  competitive: 0.9,
};

// ─── Check definitions (representative subset of claude-ads checks) ───────────

export const AUDIT_CHECKS: AuditCheck[] = [
  // ────────────────────────────── STRUCTURE ──────────────────────────────────

  {
    id: "no-active-campaigns",
    name: "No active campaigns",
    description:
      "Account has no campaigns in active status — zero reach, zero impressions.",
    severity: "critical",
    category: "structure",
    platform: "all",
    evaluate: ({ campaigns }) => {
      if (campaigns.length === 0) return null;
      return campaigns.some((c) => c.status === "active");
    },
    recommendation:
      "Launch at least one active campaign. Paused accounts generate no impressions or conversions.",
  },

  {
    id: "single-campaign-risk",
    name: "Account relies on a single active campaign",
    description:
      "Running only one campaign creates a single point of failure with no budget flexibility or funnel coverage.",
    severity: "medium",
    category: "structure",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter((c) => c.status === "active");
      if (active.length === 0) return null;
      return active.length >= 2;
    },
    recommendation:
      "Split into at least 2 active campaigns: one for prospecting (top-of-funnel) and one for retargeting (bottom-of-funnel).",
  },

  {
    id: "missing-objectives",
    name: "Campaigns missing objectives",
    description:
      "Campaigns without a set objective cannot benefit from platform algorithm optimisation for a specific goal.",
    severity: "medium",
    category: "structure",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter((c) => c.status === "active");
      if (active.length === 0) return null;
      const missing = active.filter(
        (c) =>
          !c.objective ||
          c.objective.toUpperCase() === "UNKNOWN" ||
          c.objective === ""
      );
      return missing.length === 0;
    },
    recommendation:
      "Set an objective aligned to your funnel stage (awareness → traffic → conversions) on every campaign.",
  },

  {
    id: "excessive-paused-campaigns",
    name: "High proportion of paused campaigns",
    description:
      "More than 50% paused campaigns often indicates budget fragmentation — too many underfunded campaigns that were paused rather than deleted.",
    severity: "low",
    category: "structure",
    platform: "all",
    evaluate: ({ campaigns }) => {
      if (campaigns.length < 3) return null;
      const paused = campaigns.filter((c) => c.status === "paused").length;
      return paused / campaigns.length < 0.5;
    },
    recommendation:
      "Archive or delete paused campaigns that have been inactive for 90+ days to reduce clutter and budget confusion.",
  },

  // ────────────────────────────── TRACKING ───────────────────────────────────

  {
    id: "zero-conversion-campaigns",
    name: "Active campaigns with zero conversions",
    description:
      "Active campaigns with >$50 spend but zero conversions likely have a broken pixel, wrong attribution window, or off-target audience.",
    severity: "critical",
    category: "tracking",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter(
        (c) => c.status === "active" && c.totalSpend > 50
      );
      if (active.length === 0) return null;
      const zeroConv = active.filter((c) => c.conversions === 0);
      return zeroConv.length === 0;
    },
    recommendation:
      "Verify your conversion pixel fires on the thank-you / confirmation page. Use the Meta Pixel Helper or Google Tag Assistant to debug. Check attribution window settings.",
  },

  {
    id: "low-conversion-volume",
    name: "Insufficient conversion volume for smart bidding",
    description:
      "Smart bidding algorithms (Target CPA, Maximize Conversions) need ≥30 conversions / 30 days to exit the learning phase and perform reliably.",
    severity: "high",
    category: "tracking",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter((c) => c.status === "active");
      if (active.length === 0) return null;
      const total = active.reduce((sum, c) => sum + c.conversions, 0);
      return total >= 15; // 15 as a 30-day proxy given partial data
    },
    recommendation:
      "Consolidate campaigns to pool conversion signals, or switch to a softer micro-conversion event (add-to-cart, initiate-checkout, lead form open) that fires more frequently.",
  },

  {
    id: "no-platform-connected",
    name: "No ad platform connected",
    description:
      "Without a connected ad account, the Ads Manager cannot sync data or apply AI optimisations.",
    severity: "critical",
    category: "audiences",
    platform: "all",
    evaluate: ({ connectedPlatforms }) => connectedPlatforms.length > 0,
    recommendation:
      "Connect at least one platform under Settings → Integrations (Meta Ads, Google Ads, or TikTok Ads).",
  },

  // ────────────────────────────── BIDDING ────────────────────────────────────

  {
    id: "roas-below-2x",
    name: "ROAS below 2× across active campaigns",
    description:
      "Average ROAS below 2× means you're spending more than $0.50 per dollar of revenue — typically unprofitable before factoring in COGS and overheads.",
    severity: "critical",
    category: "bidding",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter(
        (c) =>
          c.status === "active" && c.roas !== null && c.totalSpend > 100
      );
      if (active.length === 0) return null;
      const avg =
        active.reduce((s, c) => s + (c.roas ?? 0), 0) / active.length;
      return avg >= 2;
    },
    recommendation:
      "Audit audience quality, creative relevance, and landing-page conversion rate. Shift budget to higher-ROAS campaigns. Set a Target ROAS bid strategy once you have ≥30 conversions.",
  },

  {
    id: "high-cpa",
    name: "CPA above $200 on active campaigns",
    description:
      "Cost per acquisition above $200 is unsustainable for most business models unless your average order value significantly exceeds that figure.",
    severity: "high",
    category: "bidding",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const withCpa = campaigns.filter(
        (c) =>
          c.status === "active" &&
          c.cpa !== null &&
          (c.cpa as number) > 0
      );
      if (withCpa.length === 0) return null;
      const highCpa = withCpa.filter((c) => (c.cpa as number) > 200);
      return highCpa.length === 0;
    },
    recommendation:
      "Set a target CPA in your bidding strategy. Pause ad sets performing above 2× your target CPA. Scale the ones at or below target to absorb the freed budget.",
  },

  {
    id: "no-budget-set",
    name: "Active campaigns without a daily budget",
    description:
      "Campaigns without a defined daily budget may overspend unpredictably or be throttled by account-level caps.",
    severity: "high",
    category: "bidding",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter((c) => c.status === "active");
      if (active.length === 0) return null;
      const noBudget = active.filter(
        (c) => c.dailyBudget === null || c.dailyBudget === 0
      );
      return noBudget.length === 0;
    },
    recommendation:
      "Set an explicit daily budget on every active campaign. Use lifetime budgets only for fixed-duration promotions with a hard end date.",
  },

  {
    id: "low-daily-budget",
    name: "Active campaigns with very low daily budget (<$5)",
    description:
      "Campaigns with a daily budget below $5 rarely exit the learning phase — the algorithm cannot gather enough signals to optimise delivery.",
    severity: "medium",
    category: "bidding",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter(
        (c) => c.status === "active" && c.dailyBudget !== null
      );
      if (active.length === 0) return null;
      const tooLow = active.filter(
        (c) => (c.dailyBudget as number) < 5
      );
      return tooLow.length === 0;
    },
    recommendation:
      "Consolidate micro-budgets: pause low-budget campaigns and reallocate spend to your top performer to give the algorithm enough daily volume.",
  },

  // ────────────────────────────── CREATIVE ───────────────────────────────────

  {
    id: "low-ctr-google",
    name: "CTR below 1% on Google campaigns",
    description:
      "Google Ads industry average CTR is 3–5%. Below 1% signals weak ad copy, keyword–ad relevance mismatch, or Quality Score issues.",
    severity: "high",
    category: "creative",
    platform: "google",
    evaluate: ({ campaigns }) => {
      const googleActive = campaigns.filter(
        (c) =>
          c.platform === "google" &&
          c.status === "active" &&
          c.impressions > 500
      );
      if (googleActive.length === 0) return null;
      const lowCtr = googleActive.filter((c) => c.ctr < 1);
      return lowCtr.length === 0;
    },
    recommendation:
      "Rewrite headlines to mirror search intent more closely. Add negative keywords to filter irrelevant traffic. Test Responsive Search Ad variations — aim for 5+ unique headlines.",
  },

  {
    id: "low-ctr-meta",
    name: "CTR below 0.5% on Meta campaigns",
    description:
      "Meta Ads typical CTR is 0.9–1.5%. Below 0.5% suggests creative fatigue, audience mismatch, or misaligned ad placement.",
    severity: "high",
    category: "creative",
    platform: "meta",
    evaluate: ({ campaigns }) => {
      const metaActive = campaigns.filter(
        (c) =>
          c.platform === "meta" &&
          c.status === "active" &&
          c.impressions > 500
      );
      if (metaActive.length === 0) return null;
      const lowCtr = metaActive.filter((c) => c.ctr < 0.5);
      return lowCtr.length === 0;
    },
    recommendation:
      "Refresh ad creative every 4–6 weeks. Test video vs. static, UGC vs. polished studio. If frequency exceeds 3, expand your audience or launch a new creative set.",
  },

  {
    id: "low-ctr-tiktok",
    name: "CTR below 0.5% on TikTok campaigns",
    description:
      "TikTok native ad CTR averages 0.5–1.5%. Below 0.5% usually means the hook (first 3 seconds) isn't compelling enough to interrupt the scroll.",
    severity: "medium",
    category: "creative",
    platform: "tiktok",
    evaluate: ({ campaigns }) => {
      const tiktokActive = campaigns.filter(
        (c) =>
          c.platform === "tiktok" &&
          c.status === "active" &&
          c.impressions > 500
      );
      if (tiktokActive.length === 0) return null;
      const lowCtr = tiktokActive.filter((c) => c.ctr < 0.5);
      return lowCtr.length === 0;
    },
    recommendation:
      "Lead with a strong visual or text hook in the first 3 seconds. Use text overlays to convey the value proposition before audio. Test native-feeling UGC over polished ads.",
  },

  // ────────────────────────────── AUDIENCES ──────────────────────────────────

  {
    id: "single-platform",
    name: "Running on only one ad platform",
    description:
      "Diversifying across Google (intent-based) + Meta (interest-based) de-risks platform dependency and reaches different stages of the buyer journey.",
    severity: "low",
    category: "audiences",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const activePlatforms = new Set(
        campaigns
          .filter((c) => c.status === "active")
          .map((c) => c.platform)
      );
      if (activePlatforms.size === 0) return null;
      return activePlatforms.size >= 2;
    },
    recommendation:
      "Test a second platform with a small budget (10–15% of total). Google + Meta together cover the majority of digital ad inventory.",
  },

  // ────────────────────────────── COMPETITIVE ────────────────────────────────

  {
    id: "budget-concentration",
    name: "Over 80% of budget concentrated in one campaign",
    description:
      "Concentrating the majority of spend in a single campaign creates significant performance risk if that campaign underperforms, is paused, or gets disapproved.",
    severity: "medium",
    category: "competitive",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const active = campaigns.filter(
        (c) => c.status === "active" && c.totalSpend > 0
      );
      if (active.length < 2) return null;
      const totalSpend = active.reduce((s, c) => s + c.totalSpend, 0);
      const topSpend = Math.max(...active.map((c) => c.totalSpend));
      return topSpend / totalSpend < 0.8;
    },
    recommendation:
      "Distribute budget across at least 3 campaigns at different funnel stages to reduce concentration risk and enable cross-funnel optimisation.",
  },

  {
    id: "roas-variance",
    name: "High ROAS variance across campaigns",
    description:
      "When ROAS varies by more than 3× between active campaigns, there are underperforming campaigns draining budget from profitable ones.",
    severity: "medium",
    category: "competitive",
    platform: "all",
    evaluate: ({ campaigns }) => {
      const withRoas = campaigns.filter(
        (c) =>
          c.status === "active" &&
          c.roas !== null &&
          (c.roas as number) > 0 &&
          c.totalSpend > 100
      );
      if (withRoas.length < 2) return null;
      const roasValues = withRoas.map((c) => c.roas as number);
      const maxRoas = Math.max(...roasValues);
      const minRoas = Math.min(...roasValues);
      return maxRoas / minRoas < 3;
    },
    recommendation:
      "Pause the lowest-ROAS campaigns and reallocate budget to top performers. Consider using Portfolio Bid Strategies to let the algorithm balance spend across campaigns automatically.",
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

function gradeFromScore(score: number): AuditGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function runAudit(input: AuditInput): {
  results: AuditCheckResult[];
  score: AuditScore;
} {
  const results: AuditCheckResult[] = AUDIT_CHECKS.map((check) => ({
    check,
    passed: check.evaluate(input),
  }));

  let numerator = 0;
  let denominator = 0;

  const byCategory: AuditScore["byCategory"] = {
    structure: { passed: 0, total: 0 },
    tracking: { passed: 0, total: 0 },
    bidding: { passed: 0, total: 0 },
    creative: { passed: 0, total: 0 },
    audiences: { passed: 0, total: 0 },
    competitive: { passed: 0, total: 0 },
  };

  const criticalIssues: AuditCheckResult[] = [];
  const highIssues: AuditCheckResult[] = [];
  const mediumIssues: AuditCheckResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of results) {
    if (r.passed === null) {
      skipped++;
      continue;
    }

    const w =
      SEVERITY_WEIGHT[r.check.severity] * CATEGORY_WEIGHT[r.check.category];

    if (r.passed) {
      numerator += w;
      passed++;
      byCategory[r.check.category].passed++;
    } else {
      failed++;
      if (r.check.severity === "critical") criticalIssues.push(r);
      else if (r.check.severity === "high") highIssues.push(r);
      else if (r.check.severity === "medium") mediumIssues.push(r);
    }

    denominator += w;
    byCategory[r.check.category].total++;
  }

  const score =
    denominator === 0 ? 100 : Math.round((numerator / denominator) * 100);

  return {
    results,
    score: {
      score,
      grade: gradeFromScore(score),
      total: passed + failed,
      passed,
      failed,
      skipped,
      byCategory,
      criticalIssues,
      highIssues,
      mediumIssues,
    },
  };
}
