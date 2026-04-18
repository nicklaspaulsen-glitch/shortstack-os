import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  encodeState,
  getRedirectUri,
  missingEnvFor,
  missingEnvResponse,
} from "@/lib/ads/oauth-helpers";

// GET /api/oauth/google-ads/start
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = missingEnvFor("google_ads");
  if (missing.length > 0) {
    return missingEnvResponse("google_ads", missing);
  }

  const returnTo = request.nextUrl.searchParams.get("return_to") || "/dashboard/ads-manager";
  const state = encodeState({ user_id: user.id, return_to: returnTo, platform: "google_ads" });

  const scopes = "https://www.googleapis.com/auth/adwords";
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const redirectUri = getRedirectUri("google_ads");

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
