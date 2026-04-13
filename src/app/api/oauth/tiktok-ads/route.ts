import { NextRequest, NextResponse } from "next/server";

// Redirect user to TikTok Marketing API OAuth (separate from content TikTok OAuth)
// TikTok Business Center auth uses a different flow than TikTok Login Kit
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");

  const appId = process.env.TIKTOK_ADS_APP_ID || process.env.TIKTOK_CLIENT_KEY;
  if (!appId) return NextResponse.json({ error: "TikTok Ads App ID not configured" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const redirectUri = `${baseUrl}/api/oauth/tiktok-ads/callback`;
  const state = JSON.stringify({ client_id: clientId });

  // TikTok Marketing API auth endpoint
  const authUrl = `https://business-api.tiktok.com/portal/auth?app_id=${appId}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
