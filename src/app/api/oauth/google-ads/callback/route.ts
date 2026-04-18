import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  decodeState,
  getRedirectUri,
  uiRedirectOnError,
  uiRedirectOnSuccess,
} from "@/lib/ads/oauth-helpers";

// GET /api/oauth/google-ads/callback
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(uiRedirectOnError("google_ads", error));
  if (!code || !stateStr) {
    return NextResponse.redirect(uiRedirectOnError("google_ads", "missing_code"));
  }

  const state = decodeState(stateStr);
  if (!state) return NextResponse.redirect(uiRedirectOnError("google_ads", "invalid_state"));

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== state.user_id) {
    return NextResponse.redirect(uiRedirectOnError("google_ads", "auth_mismatch", state.return_to));
  }

  try {
    // 1) Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: getRedirectUri("google_ads"),
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(
        uiRedirectOnError("google_ads", tokenData.error_description || "token_failed", state.return_to)
      );
    }

    // 2) List accessible Google Ads customer accounts (requires developer token)
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
    const accessibleAccounts: Array<{ id: string; resource_name: string }> = [];
    if (devToken) {
      try {
        const custRes = await fetch(
          "https://googleads.googleapis.com/v16/customers:listAccessibleCustomers",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "developer-token": devToken,
            },
          }
        );
        const custData = await custRes.json();
        const resourceNames: string[] = custData.resourceNames || [];
        for (const rn of resourceNames) {
          const id = rn.replace(/^customers\//, "");
          accessibleAccounts.push({ id, resource_name: rn });
        }
      } catch {
        // swallow — we still save the token even if listing failed
      }
    }

    const service = createServiceClient();
    const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
    const primaryAccount = accessibleAccounts[0];

    const { data: connRow } = await service
      .from("oauth_connections")
      .upsert(
        {
          user_id: user.id,
          profile_id: user.id,
          platform: "google_ads",
          platform_type: "ads",
          scope: "https://www.googleapis.com/auth/adwords",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          account_id: primaryAccount?.id || null,
          account_name: primaryAccount ? `Google Ads (${primaryAccount.id})` : null,
          metadata: {
            oauth: true,
            connected_at: new Date().toISOString(),
            ad_account_count: accessibleAccounts.length,
            dev_token_present: !!devToken,
          },
        },
        { onConflict: "user_id,platform" }
      )
      .select("id")
      .single();

    const connectionId = connRow?.id || null;

    if (accessibleAccounts.length > 0) {
      const rows = accessibleAccounts.map((a, idx) => ({
        user_id: user.id,
        platform: "google_ads",
        account_id: a.id,
        account_name: `Google Ads Customer ${a.id}`,
        currency: null,
        timezone: null,
        status: "active",
        oauth_connection_id: connectionId,
        is_default: idx === 0,
        metadata: { resource_name: a.resource_name },
      }));
      await service
        .from("ad_accounts")
        .upsert(rows, { onConflict: "user_id,platform,account_id" });
    }

    return NextResponse.redirect(uiRedirectOnSuccess("google_ads", state.return_to));
  } catch (err) {
    return NextResponse.redirect(uiRedirectOnError("google_ads", String(err), state.return_to));
  }
}
