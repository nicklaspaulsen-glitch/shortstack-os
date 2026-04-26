import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

// Redirect user to TikTok Marketing API OAuth (separate from content TikTok OAuth).
// TikTok Business Center auth uses a different flow than TikTok Login Kit.
//
// SECURITY (Apr 26 — round-9-coda hardening):
// Pre-fix this route had NO auth check, no client-ownership check, and
// signed `state` as raw JSON `{client_id}`. The matching callback's legacy
// branch trusted that raw JSON without re-verifying the session — meaning
// an unauthed attacker could craft a state with a victim's client_id,
// complete OAuth on the attacker's TikTok account, and have the callback
// write the attacker's tokens onto the victim's `social_accounts.client_id`
// row.
//
// Same shape as the OAuth IDORs we closed earlier today on Google/LinkedIn/
// TikTok-content/Discord (`ec32cc7`, `3230e65`). This is the deferred
// final OAuth route — now closed.
//
// What changed:
//   1. Added auth check (createServerSupabase + getUser)
//   2. Added canUserWriteForClient ownership verification
//   3. State now signed via signOAuthState (HMAC-SHA256, 10-min TTL)
//   4. Callback's legacy branch updated separately (in callback/route.ts) to
//      use verifyOAuthState instead of raw JSON.parse
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await canUserWriteForClient(
    supabase as unknown as Parameters<typeof canUserWriteForClient>[0],
    user.id,
    clientId,
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const appId = process.env.TIKTOK_ADS_APP_ID || process.env.TIKTOK_CLIENT_KEY;
  if (!appId) return NextResponse.json({ error: "TikTok Ads App ID not configured" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const redirectUri = `${baseUrl}/api/oauth/tiktok-ads/callback`;

  // Signed state (HMAC) — replaces the raw JSON that was the IDOR vector.
  const state = signOAuthState({
    client_id: clientId,
    platform: "tiktok_ads",
    uid: user.id,
  });

  // TikTok Marketing API auth endpoint
  const authUrl = `https://business-api.tiktok.com/portal/auth?app_id=${appId}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
