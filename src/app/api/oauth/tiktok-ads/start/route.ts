import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  encodeState,
  getRedirectUri,
  missingEnvFor,
  missingEnvResponse,
} from "@/lib/ads/oauth-helpers";

// GET /api/oauth/tiktok-ads/start
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = missingEnvFor("tiktok_ads");
  if (missing.length > 0) {
    return missingEnvResponse("tiktok_ads", missing);
  }

  const returnTo = request.nextUrl.searchParams.get("return_to") || "/dashboard/ads-manager";
  const state = encodeState({ user_id: user.id, return_to: returnTo, platform: "tiktok_ads" });

  const appId =
    process.env.TIKTOK_APP_ID ||
    process.env.TIKTOK_ADS_APP_ID ||
    process.env.TIKTOK_CLIENT_KEY ||
    "";
  const redirectUri = getRedirectUri("tiktok_ads");

  const authUrl =
    `https://business-api.tiktok.com/portal/auth` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&state=${encodeURIComponent(state)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
