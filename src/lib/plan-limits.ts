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
}

/**
 * Hard monthly caps per Stripe plan tier. `Infinity` = no cap.
 * Keep this in sync with the Stripe products the `setup-stripe-prices`
 * script creates.
 */
export const LIMITS_BY_TIER: Record<string, TierLimits> = {
  Starter:   { emails:     500, tokens:    250_000, clients:   5, sms:    100, call_minutes:     60, phone_numbers:  1 },
  Growth:    { emails:   5_000, tokens:  1_000_000, clients:  15, sms:  1_000, call_minutes:    300, phone_numbers:  3 },
  Pro:       { emails:  25_000, tokens:  5_000_000, clients:  50, sms:  5_000, call_minutes:  2_000, phone_numbers: 10 },
  Business:  { emails: 100_000, tokens: 20_000_000, clients: 150, sms: 25_000, call_minutes: 10_000, phone_numbers: 50 },
  Unlimited: { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity, phone_numbers: Infinity },
  Founder:   { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity, phone_numbers: Infinity },
};

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
