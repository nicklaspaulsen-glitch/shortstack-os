import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

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

export async function middleware(request: NextRequest) {
  // White-label custom domain detection: pass the host forward via
  // x-whitelabel-host so server components can resolve the brand
  // without per-request DB lookups in middleware.
  const hostHeader = request.headers.get("host") ?? "";
  const hostNoPort = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  const requestHeaders = new Headers(request.headers);
  if (hostNoPort && !isProductHost(hostHeader.toLowerCase())) {
    requestHeaders.set("x-whitelabel-host", hostNoPort);
  }

  // Skip auth for static/public files and public pages
  const path = request.nextUrl.pathname;
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

  return await updateSession(request, requestHeaders);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons|api/cron|api/webhooks|api/billing/webhook|api/health|api/tts|api/app|api/license|api/oauth|api/telegram|api/twilio/sms-webhook|api/twilio/voice-webhook|api/discord/webhook|tiktok.*\\.txt|manifest\\.json|\\.well-known).*)",
  ],
};
