import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/upstash-rate-limit";

// ---------------------------------------------------------------------------
// White-label host helpers
// ---------------------------------------------------------------------------

// Hosts that are NEVER white-label tenants -- the canonical product
// hostnames + the Vercel preview wildcard. Any other hostname is a
// candidate for white-label resolution.
const PRODUCT_HOSTS = new Set<string>([
  "shortstack.work",
  "www.shortstack.work",
  "app.shortstack.work",
  "shortstack-os.vercel.app",
  "localhost",
  "127.0.0.1",
]);

function isProductHost(host: string): boolean {
  if (PRODUCT_HOSTS.has(host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Rate-limit config
// ---------------------------------------------------------------------------

/**
 * Routes excluded from rate limiting entirely.
 *   - /api/health  — uptime probes; no auth, very high cadence
 *   - /api/webhooks/* — have their own HMAC / signature validation
 */
function isRateLimitExcluded(path: string): boolean {
  return (
    path === "/api/health" ||
    path.startsWith("/api/webhooks/")
  );
}

/**
 * Return [limit, windowSeconds] for a given API path.
 * Lower limits for sensitive/expensive routes; broad limit for everything else.
 */
function getRateLimitConfig(path: string): [number, string] {
  if (path.startsWith("/api/auth/")) return [10, "1 m"];
  if (path.startsWith("/api/stripe/") || path.startsWith("/api/billing/")) return [20, "1 m"];
  if (path.startsWith("/api/ai/") || path.startsWith("/api/trinity/")) return [30, "1 m"];
  return [60, "1 m"];
}

/**
 * Best-effort IP extraction from Next.js middleware request.
 * Prefers the Vercel forwarding header; falls back to "unknown".
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ------------------------------------------------------------------
  // 1. White-label custom domain detection
  //    Pass the host forward via x-whitelabel-host so server components
  //    can resolve the brand without per-request DB lookups.
  // ------------------------------------------------------------------
  const hostHeader = request.headers.get("host") ?? "";
  const hostNoPort = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  const requestHeaders = new Headers(request.headers);
  if (hostNoPort && !isProductHost(hostHeader.toLowerCase())) {
    requestHeaders.set("x-whitelabel-host", hostNoPort);
  }

  // ------------------------------------------------------------------
  // 2. Skip auth for static/public files and public pages
  // ------------------------------------------------------------------
  if (
    path === "/" ||
    path.endsWith(".txt") ||
    path.endsWith(".xml") ||
    path.startsWith("/.well-known") ||
    /^\/tiktok[A-Za-z0-9]*\.txt$/.test(path) ||
    path.startsWith("/api/agents/auth") ||
    (path.startsWith("/api/agents/") && request.headers.get("authorization")?.startsWith("Bearer ")) ||
    path.startsWith("/api/forms") ||
    path.startsWith("/book") ||
    path.startsWith("/pricing") ||
    path.startsWith("/changelog") ||
    path.startsWith("/survey") ||
    path.startsWith("/api/surveys") ||
    path.startsWith("/demo") ||
    path.startsWith("/style-preview") ||
    path.startsWith("/sound-preview") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms")
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ------------------------------------------------------------------
  // 3. Distributed rate limiting for /api/* routes
  // ------------------------------------------------------------------
  if (path.startsWith("/api/") && !isRateLimitExcluded(path)) {
    const [limit, window] = getRateLimitConfig(path);
    const ip = getClientIp(request);
    const identifier = `ip:${ip}:${path.split("/")[2] ?? "api"}`;

    const result = await rateLimit(identifier, limit, window);

    if (!result.success) {
      const retryAfter = result.reset
        ? Math.max(0, result.reset - Math.floor(Date.now() / 1000))
        : 60;

      return NextResponse.json(
        { error: "Too many requests", retryAfter },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.reset),
          },
        }
      );
    }
  }

  // ------------------------------------------------------------------
  // 4. Supabase session refresh + auth gate
  // ------------------------------------------------------------------
  return await updateSession(request, requestHeaders);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\.ico|icons|api/cron|api/webhooks|api/billing/webhook|api/health|api/tts|api/app|api/license|api/oauth|api/telegram|api/twilio/sms-webhook|api/twilio/voice-webhook|api/discord/webhook|tiktok.*\.txt|manifest\.json|\.well-known).*)",
  ],
};
