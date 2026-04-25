import { NextRequest, NextResponse } from "next/server";

// Redirect user to TikTok OAuth login
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return NextResponse.json({ error: "TikTok client key not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/tiktok/callback`;
  const state = JSON.stringify({ client_id: clientId });

  const scopes = "user.info.basic,video.list,video.upload,video.publish";
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
