import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  encodeState,
  getRedirectUri,
  missingEnvFor,
  missingEnvResponse,
} from "@/lib/ads/oauth-helpers";

// GET /api/oauth/meta-ads/start
// Redirects the authenticated user to Meta's OAuth consent screen for Ads access.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = missingEnvFor("meta_ads");
  if (missing.length > 0) {
    return missingEnvResponse("meta_ads", missing);
  }

  const returnTo = request.nextUrl.searchParams.get("return_to") || "/dashboard/ads-manager";
  const state = encodeState({ user_id: user.id, return_to: returnTo, platform: "meta_ads" });

  const scopes = [
    "ads_read",
    "ads_management",
    "business_management",
    "pages_read_engagement",
  ].join(",");

  const appId = process.env.META_APP_ID || "";
  const redirectUri = getRedirectUri("meta_ads");
  const authUrl =
    `https://www.facebook.com/v18.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}` +
    `&response_type=code`;

  return NextResponse.redirect(authUrl);
}
