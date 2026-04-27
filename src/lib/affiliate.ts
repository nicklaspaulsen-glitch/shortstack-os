/**
 * Shared helpers for the affiliate program.
 *
 * The affiliate program is distinct from the existing `referrals` feature in
 * scope: referrals reward users who bring in their *own* signups; affiliate
 * programs let agency owners run their *own* affiliate program with their
 * own ToS, commissions, and payouts via Stripe Connect.
 *
 * Code shape: 8-char alphanumeric uppercase (no ambiguous 0/O/I/1/L). Longer
 * than the personal referral code (6 chars) because the affiliate space
 * across many programs needs a wider key. Codes are stored uppercase and
 * accepted case-insensitively on the public tracking endpoint.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I, L
const CODE_LEN = 8;

export function generateAffiliateRefCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeAffiliateRefCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toString().trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(cleaned)) return null;
  return cleaned;
}

export type CommissionType = "flat" | "percentage";

/**
 * Calculate the commission earned for a single sale.
 *
 * - flat: `commissionValue` is the dollar amount in cents.
 * - percentage: `commissionValue` is the rate as a percent (e.g. 30 for 30%).
 *
 * Always returns whole cents. Negative inputs are clamped to 0.
 */
export function calculateCommissionCents(
  saleAmountCents: number,
  commissionType: CommissionType,
  commissionValue: number,
): number {
  if (saleAmountCents <= 0) return 0;
  if (commissionValue <= 0) return 0;
  if (commissionType === "flat") {
    return Math.round(commissionValue);
  }
  // percentage
  return Math.max(0, Math.round((saleAmountCents * commissionValue) / 100));
}

/**
 * SHA-256 of an IP address with a server-side salt to avoid storing
 * raw client IPs. Used for soft-deduping clicks. Returns a hex string.
 *
 * Uses the global `crypto` available in both Node 18+ and Edge runtimes.
 */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.AFFILIATE_IP_SALT || "ssoa-affiliate-default-salt";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cookie name used by the public tracking redirect to attribute later signups. */
export const AFFILIATE_COOKIE_NAME = "ssoa_ref";
export const AFFILIATE_COOKIE_DEFAULT_DAYS = 30;
