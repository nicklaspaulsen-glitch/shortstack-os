import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  decodeState,
  uiRedirectOnError,
  uiRedirectOnSuccess,
} from "@/lib/ads/oauth-helpers";
import { canUserWriteForClient, verifyOAuthState } from "@/lib/oauth-state";

// GET /api/oauth/tiktok-ads/callback
// Handles both:
//  - the new Ads Manager flow (state is signed, carries user_id)
//  - the legacy client-specific flow (state is plain JSON { client_id })
export async function GET(request: NextRequest) {
  const authCode = request.nextUrl.searchParams.get("auth_code") || request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  if (!authCode) {
    return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "denied"));
  }

  // Try the new signed state first (ads-flow encodeState format)
  const signedState = stateStr ? decodeState(stateStr) : null;

  // Legacy path — used by /dashboard/ads page hitting /api/oauth/tiktok-ads
  // (the per-client social_accounts flow). Pre-Apr 26 this trusted raw
  // JSON state which let attackers craft a state with a victim's
  // client_id. Now verifies via signOAuthState/verifyOAuthState (HMAC) —
  // matches the same hardening applied to Google/LinkedIn/TikTok-content/
  // Discord callbacks earlier today.
  //
  // We also keep `uid` so the persistence step can enforce that the
  // session completing the callback is the same user who initiated the
  // OAuth flow (defense-in-depth — closes the codex round-1 nit on this
  // route).
  let legacy: { client_id: string; uid: string } | null = null;
  if (!signedState && stateStr) {
    const verified = verifyOAuthState(stateStr);
    if (verified?.client_id && verified.platform === "tiktok_ads" && verified.uid) {
      legacy = { client_id: verified.client_id, uid: verified.uid };
    }
  }

  if (!signedState && !legacy) {
    return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "invalid_state"));
  }

  const appId =
    process.env.TIKTOK_APP_ID ||
    process.env.TIKTOK_ADS_APP_ID ||
    process.env.TIKTOK_CLIENT_KEY ||
    "";
  const secret =
    process.env.TIKTOK_SECRET ||
    process.env.TIKTOK_ADS_APP_SECRET ||
    process.env.TIKTOK_CLIENT_SECRET ||
    "";

  try {
    // Exchange auth_code for an access_token
    const tokenRes = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
      }
    );
    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.data?.access_token;
    if (!accessToken) {
      return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "token_failed"));
    }

    // Fetch advertiser list
    const advRes = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/",
      {
        method: "GET",
        headers: {
          "Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    const advData = await advRes.json();
    const advertisers: Array<Record<string, unknown>> = advData.data?.list || [];
    const primary = advertisers[0];
    const primaryId = primary?.advertiser_id ? String(primary.advertiser_id) : null;
    const primaryName = primary?.advertiser_name ? String(primary.advertiser_name) : "TikTok Ad Account";

    const service = createServiceClient();
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    if (signedState) {
      // New flow — save to oauth_connections + ad_accounts
      const supabase = createServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== signedState.user_id) {
        return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "auth_mismatch", signedState.return_to));
      }

      const { data: connRow } = await service
        .from("oauth_connections")
        .upsert(
          {
            user_id: user.id,
            profile_id: user.id,
            platform: "tiktok_ads",
            platform_type: "ads",
            scope: "advertiser.all",
            access_token: accessToken,
            refresh_token: null,
            token_expires_at: expiresAt,
            is_active: true,
            account_id: primaryId,
            account_name: primaryName,
            metadata: {
              oauth: true,
              connected_at: new Date().toISOString(),
              advertiser_count: advertisers.length,
            },
          },
          { onConflict: "user_id,platform" }
        )
        .select("id")
        .single();

      const connectionId = connRow?.id || null;

      if (advertisers.length > 0) {
        const rows = advertisers.map((a, idx) => ({
          user_id: user.id,
          platform: "tiktok_ads",
          account_id: String(a.advertiser_id || ""),
          account_name: String(a.advertiser_name || "TikTok Ad Account"),
          currency: a.currency ? String(a.currency) : null,
          timezone: a.timezone ? String(a.timezone) : null,
          status: "active",
          oauth_connection_id: connectionId,
          is_default: idx === 0,
          metadata: { raw: a },
        }));
        await service
          .from("ad_accounts")
          .upsert(rows, { onConflict: "user_id,platform,account_id" });
      }

      return NextResponse.redirect(uiRedirectOnSuccess("tiktok_ads", signedState.return_to));
    }

    // Legacy path — per-client social_accounts persistence
    if (legacy?.client_id && primaryId) {
      // Defense-in-depth: confirm the currently-authenticated session is
      // the same user that initiated the OAuth flow, AND that they still
      // have write rights for the target client_id. Either check failing
      // means we refuse to write tokens onto somebody else's row.
      const supabase = createServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== legacy.uid) {
        return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "auth_mismatch"));
      }
      const allowed = await canUserWriteForClient(
        supabase as unknown as Parameters<typeof canUserWriteForClient>[0],
        user.id,
        legacy.client_id,
      );
      if (!allowed) {
        return NextResponse.redirect(uiRedirectOnError("tiktok_ads", "forbidden"));
      }

      const record = {
        client_id: legacy.client_id,
        platform: "tiktok_ads",
        account_name: primaryName,
        account_id: primaryId,
        access_token: accessToken,
        refresh_token: null,
        is_active: true,
        token_expires_at: expiresAt,
        metadata: {
          connected_at: new Date().toISOString(),
          advertiser_count: advertisers.length,
          oauth: true,
        },
      };

      const { data: existing } = await service
        .from("social_accounts")
        .select("id")
        .eq("client_id", legacy.client_id)
        .eq("platform", "tiktok_ads")
        .single();

      if (existing) {
        await service.from("social_accounts").update(record).eq("id", existing.id);
      } else {
        await service.from("social_accounts").insert(record);
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=TikTok+Ads`);
  } catch (err) {
    return NextResponse.redirect(uiRedirectOnError("tiktok_ads", String(err)));
  }
}
