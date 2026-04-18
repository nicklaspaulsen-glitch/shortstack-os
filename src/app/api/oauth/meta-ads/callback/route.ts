import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  decodeState,
  getRedirectUri,
  uiRedirectOnError,
  uiRedirectOnSuccess,
} from "@/lib/ads/oauth-helpers";

// GET /api/oauth/meta-ads/callback
// Exchanges the auth code for tokens, fetches ad accounts, saves to DB.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(uiRedirectOnError("meta_ads", error));
  }
  if (!code || !stateStr) {
    return NextResponse.redirect(uiRedirectOnError("meta_ads", "missing_code"));
  }

  const state = decodeState(stateStr);
  if (!state) {
    return NextResponse.redirect(uiRedirectOnError("meta_ads", "invalid_state"));
  }

  // Verify the signed-in user matches the user from state
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== state.user_id) {
    return NextResponse.redirect(uiRedirectOnError("meta_ads", "auth_mismatch", state.return_to));
  }

  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const redirectUri = getRedirectUri("meta_ads");

  try {
    // 1) Exchange code for short-lived token
    const tokenUrl =
      `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(
        uiRedirectOnError("meta_ads", tokenData.error?.message || "token_failed", state.return_to)
      );
    }

    // 2) Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`
    );
    const longData = await longRes.json();
    const accessToken: string = longData.access_token || tokenData.access_token;

    // 3) Get user profile (for metadata)
    const meRes = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
    const meData = await meRes.json();

    // 4) Fetch ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,account_id,name,currency,account_status,timezone_name&access_token=${encodeURIComponent(accessToken)}`
    );
    const adAccountsData = await adAccountsRes.json();
    const adAccounts: Array<Record<string, unknown>> = adAccountsData.data || [];

    const service = createServiceClient();

    // 5) Upsert into oauth_connections
    const tokenExpiresAt = new Date(Date.now() + 60 * 86400000).toISOString();
    const { data: connRow } = await service
      .from("oauth_connections")
      .upsert(
        {
          user_id: user.id,
          profile_id: user.id,
          platform: "meta_ads",
          platform_type: "ads",
          scope: "ads_read,ads_management,business_management,pages_read_engagement",
          access_token: accessToken,
          refresh_token: null,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          account_id: adAccounts[0]?.account_id ? String(adAccounts[0].account_id) : null,
          account_name: adAccounts[0]?.name ? String(adAccounts[0].name) : null,
          metadata: {
            oauth: true,
            connected_at: new Date().toISOString(),
            user_name: meData.name,
            fb_user_id: meData.id,
            ad_account_count: adAccounts.length,
          },
        },
        { onConflict: "user_id,platform" }
      )
      .select("id")
      .single();

    const connectionId = connRow?.id || null;

    // 6) Upsert ad_accounts rows — one per ad account
    if (adAccounts.length > 0) {
      const rows = adAccounts.map((a, idx) => ({
        user_id: user.id,
        platform: "meta_ads",
        account_id: String(a.account_id || a.id || ""),
        account_name: String(a.name || "Meta Ad Account"),
        currency: a.currency ? String(a.currency) : null,
        timezone: a.timezone_name ? String(a.timezone_name) : null,
        status: a.account_status === 1 ? "active" : "inactive",
        oauth_connection_id: connectionId,
        is_default: idx === 0,
        last_synced_at: null,
        metadata: { raw: a },
      }));
      await service
        .from("ad_accounts")
        .upsert(rows, { onConflict: "user_id,platform,account_id" });
    }

    return NextResponse.redirect(uiRedirectOnSuccess("meta_ads", state.return_to));
  } catch (err) {
    return NextResponse.redirect(uiRedirectOnError("meta_ads", String(err), state.return_to));
  }
}
