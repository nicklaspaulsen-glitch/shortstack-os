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

/**
 * Result returned to the public click endpoint. Lives here (not in the
 * route file) because Next.js App Router only allows HTTP-method exports
 * from `route.ts` files — any non-method exports break the build with
 * "X is not a valid Route export field". The /go/[refCode] redirect
 * route also imports `trackClick` to share attribution semantics.
 */
export interface AffiliateTrackResult {
  ok: boolean;
  ref_code?: string;
  affiliate_id?: string;
  cookie_days?: number;
  error?: string;
}

export interface AffiliateTrackOptions {
  rawRefCode: string | null;
  source: string | null;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
}

export interface AffiliateTrackOutcome {
  result: AffiliateTrackResult;
  cookieValue: string | null;
  cookieMaxAgeSeconds: number | null;
}

/**
 * Internal helper used both by /api/affiliate/track and the /go/[refCode]
 * redirect. Returns the JSON-serializable result and the Set-Cookie value
 * to apply on the response. Uses the service-role client so it works for
 * unauthenticated visitors (RLS would otherwise block the insert).
 *
 * Click failures NEVER block the redirect — DB errors are logged and
 * swallowed; the caller still gets a usable response.
 */
export async function trackClick(opts: AffiliateTrackOptions): Promise<AffiliateTrackOutcome> {
  // Lazy import to keep this lib usable from edge contexts that don't need
  // Supabase (e.g. type-only imports). The service client itself is also
  // lazy-initialised under the hood.
  const { createServiceClient } = await import("@/lib/supabase/server");

  const ref_code = normalizeAffiliateRefCode(opts.rawRefCode);
  if (!ref_code) {
    return {
      result: { ok: false, error: "Missing or invalid ref code" },
      cookieValue: null,
      cookieMaxAgeSeconds: null,
    };
  }

  const supabase = createServiceClient();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select(`
      id,
      program_id,
      status,
      affiliate_programs ( cookie_days, status )
    `)
    .eq("ref_code", ref_code)
    .maybeSingle();

  if (!affiliate) {
    return {
      result: { ok: false, error: "Unknown ref code" },
      cookieValue: null,
      cookieMaxAgeSeconds: null,
    };
  }

  // Program may surface as object or array depending on PostgREST inference;
  // normalise to a single record for the cookie-window read.
  const programRel = affiliate.affiliate_programs;
  const program = Array.isArray(programRel) ? programRel[0] : programRel;
  const programStatus = program?.status ?? "active";
  if (
    affiliate.status === "suspended" ||
    affiliate.status === "rejected" ||
    programStatus === "closed"
  ) {
    return {
      result: { ok: false, error: "Affiliate or program inactive" },
      cookieValue: null,
      cookieMaxAgeSeconds: null,
    };
  }

  const ipHash = opts.ip ? await hashIp(opts.ip) : null;

  const { error: insertErr } = await supabase.from("affiliate_referrals").insert({
    affiliate_id: affiliate.id,
    referred_email: null,
    click_id: crypto.randomUUID(),
    source: opts.source ?? null,
    ip_hash: ipHash,
    status: "clicked",
    metadata: {
      user_agent: opts.userAgent ?? null,
      referer: opts.referer ?? null,
    },
  });
  if (insertErr) {
    console.warn("[affiliate/track] click insert failed:", insertErr.message);
  }

  const cookieDays = program?.cookie_days ?? AFFILIATE_COOKIE_DEFAULT_DAYS;
  const cookieMaxAgeSeconds = cookieDays * 24 * 60 * 60;

  return {
    result: {
      ok: true,
      ref_code,
      affiliate_id: affiliate.id,
      cookie_days: cookieDays,
    },
    cookieValue: ref_code,
    cookieMaxAgeSeconds,
  };
}
