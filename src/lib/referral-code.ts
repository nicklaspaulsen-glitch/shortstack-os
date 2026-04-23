/**
 * Shared referral-code helpers.
 *
 * Codes are 6-char alphanumeric (uppercase, no ambiguous 0/O/I/1/L). Short
 * enough to type, long enough to avoid collisions in the foreseeable user
 * base (32^6 = ~1B combos). `SS-` prefix is intentionally OMITTED here so
 * the code lives in a single DB column; display code uses plain form.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I, L
const CODE_LEN = 6;

export function generateReferralCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Normalize a user-supplied referral code.
 * - Uppercases
 * - Strips whitespace
 * - Strips leading "SS-" prefix if somebody pastes the display form
 * - Returns null if the result doesn't match the expected shape
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toString().trim().toUpperCase().replace(/^SS-/, "");
  if (!/^[A-Z0-9]{4,12}$/.test(cleaned)) return null;
  return cleaned;
}
