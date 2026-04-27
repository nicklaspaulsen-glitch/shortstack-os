/**
 * Pretty redirect URL for affiliate links.
 *
 *   GET /go/{REF_CODE}
 *
 * Records a click and 302's to the landing page. Default destination is
 * the marketing home page; affiliates can pass `?to=...` to deep-link, but
 * the URL must be same-origin to prevent the redirect being abused for
 * phishing on our domain.
 */
import { NextRequest, NextResponse } from "next/server";
import { AFFILIATE_COOKIE_NAME, trackClick } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

type Params = { params: { refCode: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const url = new URL(request.url);
  const targetParam = url.searchParams.get("to");
  const source = url.searchParams.get("source");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  const { cookieValue, cookieMaxAgeSeconds } = await trackClick({
    rawRefCode: params.refCode,
    source,
    ip,
    userAgent,
    referer,
  });

  // Redirect to same-origin landing only — never let an attacker bounce off
  // /go/CODE?to=https://attacker.example.
  let target = "/";
  if (targetParam) {
    try {
      const parsed = new URL(targetParam, request.url);
      if (parsed.origin === url.origin) target = parsed.pathname + parsed.search + parsed.hash;
    } catch {
      // ignore — fall back to "/"
    }
  }

  // Always pass the ref code through as a query param too — the signup form
  // can pull it from there if the cookie was blocked.
  const sep = target.includes("?") ? "&" : "?";
  const refForUrl = cookieValue || params.refCode;
  const finalTarget = `${target}${sep}ref=${encodeURIComponent(refForUrl)}`;

  const response = NextResponse.redirect(new URL(finalTarget, request.url));
  if (cookieValue && cookieMaxAgeSeconds) {
    response.cookies.set({
      name: AFFILIATE_COOKIE_NAME,
      value: cookieValue,
      maxAge: cookieMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
  }
  return response;
}
