import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Meta OAuth callback — exchange code for access token and save
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=denied`);
  }

  let state: { client_id: string; platform: string } = { client_id: "", platform: "facebook" };
  try { state = JSON.parse(stateStr || "{}"); } catch {}

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${baseUrl}/api/oauth/meta/callback`;

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_failed`);
    }

    // Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = await longRes.json();
    const accessToken = longData.access_token || tokenData.access_token;

    // Get user info
    const meRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`);
    const meData = await meRes.json();

    // Get pages
    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesRes.json();

    const supabase = createServiceClient();
    const page = pagesData.data?.[0];
    const pageId = page?.id;
    const pageToken = page?.access_token || accessToken;

    // Fetch ad accounts for the ads manager integration
    let adAccountId: string | null = null;
    let adAccountName: string | null = null;
    try {
      const adAccountsRes = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=account_id,name,account_status&access_token=${accessToken}`
      );
      const adAccountsData = await adAccountsRes.json();
      const activeAdAccount = (adAccountsData.data || []).find(
        (a: Record<string, unknown>) => a.account_status === 1
      ) || adAccountsData.data?.[0];
      if (activeAdAccount) {
        adAccountId = String(activeAdAccount.account_id);
        adAccountName = String(activeAdAccount.name || "Meta Ad Account");
      }
    } catch (err) { console.error("[oauth/meta] ad accounts fetch failed:", err); }

    // Try to get Instagram business account linked to the Facebook page
    let igAccount: { id?: string; username?: string; name?: string; followers_count?: number } | null = null;
    if (pageId) {
      try {
        const igRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
        const igData = await igRes.json();
        if (igData.instagram_business_account?.id) {
          try {
            const igProfileRes = await fetch(`https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=username,name,followers_count,profile_picture_url&access_token=${pageToken}`);
            igAccount = await igProfileRes.json();
          } catch (err) {
            console.error("[oauth/meta] IG profile fetch failed:", err);
            igAccount = { id: igData.instagram_business_account.id, username: "Instagram Business" };
          }
        }
      } catch (err) { console.error("[oauth/meta] IG business account lookup failed:", err); }
    }

    if (state.client_id) {
      // Always save Facebook page if found
      if (page) {
        const fbRecord = {
          client_id: state.client_id, platform: "facebook", account_name: page.name, account_id: page.id,
          access_token: pageToken, is_active: true, token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
          metadata: { connected_at: new Date().toISOString(), user_name: meData.name, user_id: meData.id, page_id: page.id, page_count: pagesData.data?.length || 0, oauth: true },
        };
        const { data: existingFb } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "facebook").single();
        if (existingFb) { await supabase.from("social_accounts").update(fbRecord).eq("id", existingFb.id); }
        else { await supabase.from("social_accounts").insert(fbRecord); }
      }

      // Always save Instagram if linked to the page
      if (igAccount?.id) {
        const igRecord = {
          client_id: state.client_id, platform: "instagram", account_name: igAccount.username || igAccount.name || "Instagram", account_id: igAccount.id,
          access_token: pageToken, is_active: true, token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
          metadata: { connected_at: new Date().toISOString(), page_id: pageId, followers: igAccount.followers_count || 0, oauth: true },
        };
        const { data: existingIg } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "instagram").single();
        if (existingIg) { await supabase.from("social_accounts").update(igRecord).eq("id", existingIg.id); }
        else { await supabase.from("social_accounts").insert(igRecord); }
      }

      // Save meta_ads record for the Ads Manager (separate from social posting)
      if (adAccountId) {
        const adsRecord = {
          client_id: state.client_id, platform: "meta_ads", account_name: adAccountName || "Meta Ad Account", account_id: adAccountId,
          access_token: accessToken, is_active: true, token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
          metadata: { connected_at: new Date().toISOString(), user_name: meData.name, user_id: meData.id, page_id: pageId, oauth: true },
        };
        const { data: existingAds } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "meta_ads").single();
        if (existingAds) { await supabase.from("social_accounts").update(adsRecord).eq("id", existingAds.id); }
        else { await supabase.from("social_accounts").insert(adsRecord); }
      }
    }

    const parts = ["Facebook"];
    if (igAccount?.id) parts.push("Instagram");
    if (adAccountId) parts.push("Meta Ads");
    const connected = parts.join(" & ");
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=${encodeURIComponent(connected)}`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
