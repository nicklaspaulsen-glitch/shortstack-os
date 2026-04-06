import { NextRequest, NextResponse } from "next/server";

// Redirect to Google OAuth (YouTube + Google Business)
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  const platform = request.nextUrl.searchParams.get("platform") || "youtube";

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/api/oauth/google/callback`;
  const state = JSON.stringify({ client_id: clientId, platform });

  const scopes = platform === "youtube"
    ? "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly"
    : "https://www.googleapis.com/auth/business.manage";

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
