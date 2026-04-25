import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

// Redirect user to Meta (Facebook/Instagram) OAuth login.
// Requires an authenticated session; the caller must own the target client_id.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  const platform = request.nextUrl.searchParams.get("platform") || "facebook"; // facebook or instagram

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await canUserWriteForClient(supabase as unknown as Parameters<typeof canUserWriteForClient>[0], user.id, clientId);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.json({ error: "Meta App ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/meta/callback`;

  // Scopes for Facebook Login for Business
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_messaging",
    "ads_management",
    "ads_read",
    "business_management",
  ].join(",");

  const state = signOAuthState({ client_id: clientId, platform, uid: user.id });

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
