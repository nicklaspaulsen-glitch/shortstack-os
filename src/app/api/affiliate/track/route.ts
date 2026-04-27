/**
 * Public click tracking endpoint.
 *
 *   GET /api/affiliate/track?ref=CODE[&source=...&redirect=URL]
 *
 * Records a 'clicked' affiliate_referrals row, sets the ssoa_ref cookie so
 * a later signup can be attributed, and either returns JSON (for fetch
 * pixel use) or 302's the user to ?redirect=... if provided.
 *
 * The pretty `/go/[refCode]` route is implemented as a Next.js page route
 * that calls into this internal handler — it lives at
 * src/app/go/[refCode]/route.ts. Keeping the click-recording logic here
 * means both the fetch and the redirect path share identical attribution
 * semantics.
 *
 * Uses the service-role client so it works for unauthenticated visitors
 * (RLS would block the insert otherwise). All writes are constrained to
 * affiliate_referrals and only after we resolve the ref code → known
 * affiliate, so this is not a write-amplification vector.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  AFFILIATE_COOKIE_DEFAULT_DAYS,
  AFFILIATE_COOKIE_NAME,
  hashIp,
  normalizeAffiliateRefCode,
} from "@/lib/affiliate";

export const dynamic = "force-dynamic";

interface TrackResult {
  ok: boolean;
  ref_code?: string;
  affiliate_id?: string;
  cookie_days?: number;
  error?: string;
}

/**
 * Internal helper used both by this route and by /go/[refCode] redirect.
 * Returns the JSON-serializable result and a Set-Cookie header value to
 * apply on the response.
 */
export async function trackClick(opts: {
  rawRefCode: string | null;
  source: string | null;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
}): Promise<{
  result: TrackResult;
  cookieValue: string | null;
  cookieMaxAgeSeconds: number | null;
}> {
  const ref_code = normalizeAffiliateRefCode(opts.rawRefCode);
  if (!ref_code) {
    return {
      result: { ok: false, error: "Missing or invalid ref code" },
      cookieValue: null,
      cookieMaxAgeSeconds: null,
    };
  }

  const supabase = createServiceClient();

  // Resolve ref code → affiliate + cookie window from the parent program.
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

  // Best-effort insert. Click failures must NEVER block the redirect — so we
  // log and swallow the error rather than 500'ing.
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
    // Don't surface the DB error to the client — return ok with a hint.
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  const source = url.searchParams.get("source");
  const redirectUrl = url.searchParams.get("redirect");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  const { result, cookieValue, cookieMaxAgeSeconds } = await trackClick({
    rawRefCode: ref,
    source,
    ip,
    userAgent,
    referer,
  });

  // Build the response — JSON by default, or a redirect if requested.
  const response = redirectUrl
    ? NextResponse.redirect(safeRedirectTarget(redirectUrl, request.url))
    : NextResponse.json(result, { status: result.ok ? 200 : 400 });

  if (cookieValue && cookieMaxAgeSeconds) {
    response.cookies.set({
      name: AFFILIATE_COOKIE_NAME,
      value: cookieValue,
      maxAge: cookieMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // readable by client signup form
    });
  }

  return response;
}

/**
 * Open-redirect guard: only allow same-origin or relative URLs. Anything
 * else falls back to "/" — better to lose the destination than enable a
 * phishing pivot off our domain.
 */
function safeRedirectTarget(target: string, requestUrl: string): string {
  try {
    const parsed = new URL(target, requestUrl);
    const origin = new URL(requestUrl).origin;
    if (parsed.origin === origin) return parsed.toString();
  } catch {
    // fall through
  }
  return "/";
}
