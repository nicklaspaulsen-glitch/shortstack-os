/**
 * Public click tracking endpoint.
 *
 *   GET /api/affiliate/track?ref=CODE[&source=...&redirect=URL]
 *
 * Records a 'clicked' affiliate_referrals row, sets the ssoa_ref cookie so
 * a later signup can be attributed, and either returns JSON (for fetch
 * pixel use) or 302's the user to ?redirect=... if provided.
 *
 * The pretty `/go/[refCode]` route shares this attribution path by
 * importing `trackClick` from `@/lib/affiliate` (Next.js App Router
 * disallows non-HTTP-method exports from `route.ts`, so the helper has
 * to live in the lib file).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  AFFILIATE_COOKIE_NAME,
  trackClick,
} from "@/lib/affiliate";

export const dynamic = "force-dynamic";

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
