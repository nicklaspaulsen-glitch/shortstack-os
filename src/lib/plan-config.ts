/**
 * Plan configuration — shared between frontend and backend.
 * Defines limits, labels, visual styling, and feature gates for each tier.
 */

export const PLAN_TIERS = {
  Starter: {
    max_clients: 5,
    team_members: 1,
    price_monthly: 497,
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.15)",
    badge_label: "Starter",
    tokens_monthly: 250_000,
    tokens_label: "250K",
    social_platforms: 3,
    // Upload limits (bytes)
    max_reference_file: 100 * 1024 * 1024,       // 100 MB — video editor reference files
    max_storage_upload: 500 * 1024 * 1024,        // 500 MB — client uploads to storage
    // Rate limits
    ai_requests_per_min: 20,
    // AI Caller
    caller_minutes: 0,
    // Feature gates
    has_agents: false,
    has_workflows: false,
    has_design_studio: false,
    has_video_editor: false,
    has_white_label: false,
    has_api_access: false,
    has_custom_ai: false,
    has_sla: false,
    has_dedicated_support: false,
  },
  Growth: {
    max_clients: 15,
    team_members: 3,
    price_monthly: 997,
    color: "#10b981",
    glow: "rgba(16,185,129,0.15)",
    badge_label: "Growth",
    tokens_monthly: 1_000_000,
    tokens_label: "1M",
    social_platforms: -1, // unlimited
    max_reference_file: 250 * 1024 * 1024,        // 250 MB
    max_storage_upload: 2 * 1024 * 1024 * 1024,   // 2 GB
    ai_requests_per_min: 50,
    caller_minutes: 200,
    has_agents: true,
    has_workflows: true,
    has_design_studio: true,
    has_video_editor: true,
    has_white_label: false,
    has_api_access: false,
    has_custom_ai: false,
    has_sla: false,
    has_dedicated_support: false,
  },
  Pro: {
    max_clients: 50,
    team_members: 10,
    price_monthly: 2497,
    color: "#c8a855",
    glow: "rgba(200,168,85,0.2)",
    badge_label: "Pro",
    tokens_monthly: 5_000_000,
    tokens_label: "5M",
    social_platforms: -1,
    max_reference_file: 500 * 1024 * 1024,        // 500 MB
    max_storage_upload: 5 * 1024 * 1024 * 1024,   // 5 GB
    ai_requests_per_min: 100,
    caller_minutes: 500,
    has_agents: true,
    has_workflows: true,
    has_design_studio: true,
    has_video_editor: true,
    has_white_label: false,
    has_api_access: true,
    has_custom_ai: false,
    has_sla: false,
    has_dedicated_support: false,
  },
  Business: {
    max_clients: 150,
    team_members: 25,
    price_monthly: 4997,
    color: "#a855f7",
    glow: "rgba(168,85,247,0.2)",
    badge_label: "Business",
    tokens_monthly: 20_000_000,
    tokens_label: "20M",
    social_platforms: -1,
    max_reference_file: 1 * 1024 * 1024 * 1024,   // 1 GB
    max_storage_upload: 10 * 1024 * 1024 * 1024,   // 10 GB
    ai_requests_per_min: 200,
    caller_minutes: 2000,
    has_agents: true,
    has_workflows: true,
    has_design_studio: true,
    has_video_editor: true,
    has_white_label: true,
    has_api_access: true,
    has_custom_ai: true,
    has_sla: false,
    has_dedicated_support: true,
  },
  Unlimited: {
    max_clients: -1, // unlimited
    team_members: -1,
    price_monthly: 9997,
    color: "#ef4444",
    glow: "rgba(239,68,68,0.2)",
    badge_label: "Unlimited",
    tokens_monthly: -1, // unlimited
    tokens_label: "Unlimited",
    social_platforms: -1,
    max_reference_file: 2 * 1024 * 1024 * 1024,   // 2 GB
    max_storage_upload: -1,                         // no limit
    ai_requests_per_min: -1,                        // unlimited
    caller_minutes: -1,
    has_agents: true,
    has_workflows: true,
    has_design_studio: true,
    has_video_editor: true,
    has_white_label: true,
    has_api_access: true,
    has_custom_ai: true,
    has_sla: true,
    has_dedicated_support: true,
  },
  Founder: {
    max_clients: -1,
    team_members: -1,
    price_monthly: 0,
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.25)",
    badge_label: "Founder",
    tokens_monthly: -1,
    tokens_label: "Unlimited",
    social_platforms: -1,
    max_reference_file: 2 * 1024 * 1024 * 1024,
    max_storage_upload: -1,
    ai_requests_per_min: -1,
    caller_minutes: -1,
    has_agents: true,
    has_workflows: true,
    has_design_studio: true,
    has_video_editor: true,
    has_white_label: true,
    has_api_access: true,
    has_custom_ai: true,
    has_sla: true,
    has_dedicated_support: true,
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
  // Legacy tier names — map old "Enterprise" to "Business"
  if (key === "Enterprise") return PLAN_TIERS.Business;
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

/** Get the max reference file size in bytes for the video editor */
export function getMaxReferenceFile(tier: string | null | undefined): number {
  return getPlanConfig(tier).max_reference_file;
}

/** Get the max storage upload size in bytes for client uploads */
export function getMaxStorageUpload(tier: string | null | undefined): number {
  return getPlanConfig(tier).max_storage_upload;
}

/** Get AI rate limit (requests per minute). -1 = unlimited */
export function getAiRateLimit(tier: string | null | undefined): number {
  return getPlanConfig(tier).ai_requests_per_min;
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === -1) return "Unlimited";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
