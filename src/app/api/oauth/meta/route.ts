import { NextRequest, NextResponse } from "next/server";

// Redirect user to Meta (Facebook/Instagram) OAuth login
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  const platform = request.nextUrl.searchParams.get("platform") || "facebook"; // facebook or instagram

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.json({ error: "Meta App ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/api/oauth/meta/callback`;

  // Scopes for full control
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_manage_metadata",
    "pages_read_user_content",
    "pages_messaging",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "instagram_manage_messages",
    "ads_management",
    "ads_read",
    "business_management",
  ].join(",");

  const state = JSON.stringify({ client_id: clientId, platform });

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
