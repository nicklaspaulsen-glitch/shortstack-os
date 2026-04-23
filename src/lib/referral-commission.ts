/**
 * Commission rate per referee's plan tier. Rates are paid on the referee's
 * MONTHLY subscription for 12 months from their signup date.
 *
 * These numbers match the /dashboard/referrals page marketing copy — keep
 * in sync with any pricing page that advertises a commission %.
 */

export const COMMISSION_RATES: Record<string, number> = {
  Starter: 0.10,
  Growth: 0.15,
  Pro: 0.20,
  Business: 0.25,
  Unlimited: 0.30,
  Founder: 0, // internal/free — no commission
};

export const COMMISSION_MONTHS = 12;

export function getCommissionRate(planTier: string | null | undefined): number {
  if (!planTier) return 0;
  return COMMISSION_RATES[planTier] ?? 0;
}

/** Percent as integer (for display, e.g. "15%") */
export function getCommissionPct(planTier: string | null | undefined): number {
  return Math.round(getCommissionRate(planTier) * 100);
}
