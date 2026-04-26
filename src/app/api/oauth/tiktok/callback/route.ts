import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=denied`);
  }

  // SECURITY: state must be a valid HMAC-signed payload issued by /api/oauth/tiktok
  // (rejects forged or replayed state). The signed payload includes the user.id
  // that initiated the flow — we re-check that the current session matches.
  const verified = verifyOAuthState(stateStr);
  if (!verified) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=invalid_state`);
  }
  const supabaseAuth = createServerSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user || user.id !== verified.uid) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=auth_mismatch`);
  }

  const state = { client_id: verified.client_id };

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: `${baseUrl}/api/oauth/tiktok/callback`,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_failed`);
    }

    // Get user info
    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const userInfo = userData.data?.user || {};

    const supabase = createServiceClient();

    if (state.client_id) {
      const { data: existing } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "tiktok").single();
      const record = {
        client_id: state.client_id,
        platform: "tiktok",
        account_name: userInfo.display_name || "TikTok User",
        account_id: tokenData.open_id || userInfo.open_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        is_active: true,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
        metadata: { connected_at: new Date().toISOString(), avatar: userInfo.avatar_url, oauth: true },
      };
      if (existing) {
        await supabase.from("social_accounts").update(record).eq("id", existing.id);
      } else {
        await supabase.from("social_accounts").insert(record);
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=tiktok`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
