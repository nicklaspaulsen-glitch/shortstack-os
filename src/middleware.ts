import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip auth for static/public files and public pages
  const path = request.nextUrl.pathname;
  if (
    path === "/" ||
    path.endsWith(".txt") ||
    path.endsWith(".xml") ||
    path.startsWith("/.well-known") ||
    // TikTok domain verification files only — pattern is /tiktok<hex>.txt
    // `path.includes("tiktok")` was too broad (would match /dashboard/tiktok-ads, etc.)
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
    path.startsWith("/terms") ||
    // Chat widget API is loaded from customer domains with no session cookie.
    // Auth happens via the public widget token (chat_widgets.token). CORS is
    // handled inside the route handlers themselves.
    path.startsWith("/api/widget")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, icons, manifest.json (static assets)
     * - api/cron (Vercel cron — uses Bearer token auth)
     * - api/webhooks (Stripe/GHL/Telegram webhooks — verify signatures)
     * - api/tts, api/app (public utility endpoints)
     * - api/license (desktop app license validation)
     * - api/oauth (OAuth redirect flows)
     * - api/telegram (Telegram bot webhooks)
     * - api/twilio/sms-webhook (Twilio inbound SMS webhook)
     * - api/discord/webhook (Discord interaction webhook)
     * - api/widget (public chat-widget API called from customer sites)
     * - tiktok*.txt, .well-known (domain verification)
     *
     * NOTE: api/agents is NOT excluded — those routes must do their own
     * auth checks. Excluding them would leave sensitive AI endpoints open.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons|api/cron|api/webhooks|api/billing/webhook|api/health|api/tts|api/app|api/license|api/oauth|api/telegram|api/twilio/sms-webhook|api/twilio/voice-webhook|api/discord/webhook|api/widget|tiktok.*\\.txt|manifest\\.json|\\.well-known).*)",
  ],
};
