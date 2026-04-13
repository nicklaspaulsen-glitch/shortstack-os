import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// TikTok Marketing API OAuth callback
export async function GET(request: NextRequest) {
  const authCode = request.nextUrl.searchParams.get("auth_code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  if (!authCode) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=denied`);
  }

  let state: { client_id: string } = { client_id: "" };
  try { state = JSON.parse(stateStr || "{}"); } catch {}

  const appId = process.env.TIKTOK_ADS_APP_ID || process.env.TIKTOK_CLIENT_KEY || "";
  const secret = process.env.TIKTOK_ADS_APP_SECRET || process.env.TIKTOK_CLIENT_SECRET || "";

  try {
    // Exchange auth code for access token (Marketing API uses different endpoint)
    const tokenRes = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        secret,
        auth_code: authCode,
      }),
    });
    const tokenData = await tokenRes.json();

    const accessToken = tokenData.data?.access_token;
    if (!accessToken) {
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_failed`);
    }

    // Get advertiser IDs associated with this token
    const advRes = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?app_id=${appId}&secret=${secret}&access_token=${accessToken}`,
      { headers: { "Access-Token": accessToken } }
    );
    const advData = await advRes.json();
    const advertisers = advData.data?.list || [];
    const advertiser = advertisers[0]; // Use first advertiser

    const advertiserId = advertiser?.advertiser_id ? String(advertiser.advertiser_id) : "";
    const advertiserName = advertiser?.advertiser_name || "TikTok Ad Account";

    const supabase = createServiceClient();

    if (state.client_id && advertiserId) {
      const record = {
        client_id: state.client_id,
        platform: "tiktok_ads",
        account_name: advertiserName,
        account_id: advertiserId,
        access_token: accessToken,
        refresh_token: null,
        is_active: true,
        token_expires_at: new Date(Date.now() + 86400 * 1000).toISOString(), // TikTok tokens typically 24h
        metadata: {
          connected_at: new Date().toISOString(),
          advertiser_count: advertisers.length,
          oauth: true,
        },
      };

      const { data: existing } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", state.client_id)
        .eq("platform", "tiktok_ads")
        .single();

      if (existing) {
        await supabase.from("social_accounts").update(record).eq("id", existing.id);
      } else {
        await supabase.from("social_accounts").insert(record);
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=TikTok+Ads`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
