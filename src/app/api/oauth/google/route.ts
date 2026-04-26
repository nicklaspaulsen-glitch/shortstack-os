import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

// Redirect to Google OAuth (YouTube + Google Business)
//
// SECURITY: requires an authenticated session AND verifies the caller owns the
// target client_id. The `state` is HMAC-signed so the callback can prove it
// was issued by us and prevent attackers from crafting OAuth start URLs that
// stash victim tokens against attacker-controlled client_ids.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  const platform = request.nextUrl.searchParams.get("platform") || "youtube";

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

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/google/callback`;
  const state = signOAuthState({ client_id: clientId, platform, uid: user.id });

  const scopeMap: Record<string, string> = {
    youtube: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly",
    google_business: "https://www.googleapis.com/auth/business.manage",
    google_ads: "https://www.googleapis.com/auth/adwords",
  };
  const scopes = scopeMap[platform] || scopeMap.youtube;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
