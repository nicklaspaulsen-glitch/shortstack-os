/**
 * Plan-tier configuration — CLIENT-SAFE.
 *
 * Pure data + pure functions. No Supabase, no `next/headers`, no server
 * imports. Safe to import from client components (`/dashboard/upgrade`,
 * `/dashboard/billing`, etc.) without dragging the whole usage-limits
 * server module into the browser bundle.
 *
 * The server-side `checkLimit` / `recordUsage` helpers still live in
 * `src/lib/usage-limits.ts` and re-export these constants for backward
 * compatibility, so existing server imports work unchanged.
 */

export type UsageResource =
  | "emails"
  | "tokens"
  | "clients"
  | "sms"
  | "call_minutes"
  | "phone_numbers";

export interface TierLimits {
  emails: number;
  tokens: number;
  clients: number;
  sms: number;
  call_minutes: number;
  phone_numbers: number;
  /**
   * Max video duration in seconds any single render job may request on
   * /dashboard/ai-video or /dashboard/video-editor. Enforced client-side
   * (slider cap + upgrade CTA) AND server-side (402 with current/limit/
   * plan_tier when the caller tries to exceed). Not a monthly cap — a
   * per-job ceiling — so no `usage_events` tracking.
   */
  max_video_seconds: number;
}

/**
 * Hard monthly caps per Stripe plan tier. `Infinity` = no cap.
 * Keep this in sync with the Stripe products the `setup-stripe-prices`
 * script creates.
 *
 * `max_video_seconds` is a per-render ceiling (not monthly usage) — it
 * caps how long a single video the tier is allowed to generate.
 */
export const LIMITS_BY_TIER: Record<string, TierLimits> = {
  Starter:   { emails:     500, tokens:    250_000, clients:   5, sms:    100, call_minutes:     60, phone_numbers:  1, max_video_seconds:   30 },
  Growth:    { emails:   5_000, tokens:  1_000_000, clients:  15, sms:  1_000, call_minutes:    300, phone_numbers:  3, max_video_seconds:  120 },
  Pro:       { emails:  25_000, tokens:  5_000_000, clients:  50, sms:  5_000, call_minutes:  2_000, phone_numbers: 10, max_video_seconds:  600 },
  Business:  { emails: 100_000, tokens: 20_000_000, clients: 150, sms: 25_000, call_minutes: 10_000, phone_numbers: 50, max_video_seconds: 1800 },
  Unlimited: { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity, phone_numbers: Infinity, max_video_seconds: 3600 },
  Founder:   { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity, phone_numbers: Infinity, max_video_seconds: 3600 },
};

/**
 * Human-friendly label for a tier's max video duration — used in the
 * upgrade CTA lock indicator ("Pro — 10 min").
 */
export function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "Unlimited";
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) {
    const mins = seconds / 60;
    return Number.isInteger(mins) ? `${mins} min` : `${mins.toFixed(1)} min`;
  }
  const hrs = seconds / 3600;
  return Number.isInteger(hrs) ? `${hrs} hr` : `${hrs.toFixed(1)} hr`;
}

/**
 * Find the cheapest tier that would allow a given video duration.
 * Returns `null` if no tier supports that length.
 */
export function tierForVideoSeconds(seconds: number): string | null {
  const order: string[] = ["Starter", "Growth", "Pro", "Business", "Unlimited"];
  for (const name of order) {
    if ((LIMITS_BY_TIER[name]?.max_video_seconds ?? 0) >= seconds) return name;
  }
  return null;
}

/** Normalise a plan_tier value from the DB. Nulls default to "Starter". */
export function normalizePlanTier(raw: string | null | undefined): string {
  if (!raw) return "Starter";
  const v = String(raw).trim();
  // Accept lowercase too (billing checkout accepts lowercase)
  const titled = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  if (titled in LIMITS_BY_TIER) return titled;
  // Legacy "Enterprise" → Business
  if (titled === "Enterprise") return "Business";
  return "Starter";
}

export function limitsForTier(tier: string | null | undefined): TierLimits {
  const key = normalizePlanTier(tier);
  return LIMITS_BY_TIER[key] ?? LIMITS_BY_TIER.Starter;
}
