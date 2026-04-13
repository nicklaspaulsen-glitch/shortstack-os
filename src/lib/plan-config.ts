/**
 * Plan configuration — shared between frontend and backend.
 * Defines limits, labels, and visual styling for each tier.
 */

export const PLAN_TIERS = {
  Starter: {
    max_clients: 5,
    team_members: 1,
    price_monthly: 997,
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.15)",
    badge_label: "Starter",
  },
  Growth: {
    max_clients: 25,
    team_members: 5,
    price_monthly: 2497,
    color: "#c8a855",
    glow: "rgba(200,168,85,0.2)",
    badge_label: "Growth",
  },
  Enterprise: {
    max_clients: -1, // unlimited
    team_members: -1,
    price_monthly: 4997,
    color: "#a855f7",
    glow: "rgba(168,85,247,0.2)",
    badge_label: "Enterprise",
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

/** Type guard: check if a string is a valid plan tier */
export function isValidPlanTier(tier: string): tier is PlanTier {
  return tier in PLAN_TIERS;
}

export function getPlanConfig(tier: string | null | undefined) {
  const key = tier || "Starter";
  if (isValidPlanTier(key)) {
    return PLAN_TIERS[key];
  }
  // Unknown tier — fall back to Starter. This can happen if a user has a
  // legacy or corrupted plan_tier value in the database.
  return PLAN_TIERS.Starter;
}

export function getClientLimit(tier: string | null | undefined): number {
  const config = getPlanConfig(tier);
  return config.max_clients;
}

export function isAtClientLimit(tier: string | null | undefined, currentCount: number): boolean {
  const limit = getClientLimit(tier);
  if (limit === -1) return false; // unlimited
  return currentCount >= limit;
}
