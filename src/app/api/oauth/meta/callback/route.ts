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

    // Get Instagram business account if available
    let igAccount = null;
    if (pagesData.data?.[0]) {
      const pageId = pagesData.data[0].id;
      const pageToken = pagesData.data[0].access_token;
      const igRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        const igProfileRes = await fetch(`https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=username,name,followers_count&access_token=${pageToken}`);
        igAccount = await igProfileRes.json();
      }
    }

    const supabase = createServiceClient();

    // Save Facebook connection
    if (state.client_id) {
      // Facebook page
      if (pagesData.data?.[0]) {
        const page = pagesData.data[0];
        const { data: existing } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "facebook").single();
        const record = {
          client_id: state.client_id,
          platform: "facebook",
          account_name: page.name,
          account_id: page.id,
          access_token: page.access_token, // Page token (long-lived)
          is_active: true,
          token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
          metadata: {
            connected_at: new Date().toISOString(),
            user_name: meData.name,
            user_id: meData.id,
            page_count: pagesData.data?.length || 0,
            oauth: true,
          },
        };
        if (existing) {
          await supabase.from("social_accounts").update(record).eq("id", existing.id);
        } else {
          await supabase.from("social_accounts").insert(record);
        }
      }

      // Instagram
      if (igAccount?.username) {
        const { data: existing } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "instagram").single();
        const record = {
          client_id: state.client_id,
          platform: "instagram",
          account_name: igAccount.username,
          account_id: igAccount.id,
          access_token: pagesData.data?.[0]?.access_token || accessToken,
          is_active: true,
          token_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
          metadata: {
            connected_at: new Date().toISOString(),
            followers: igAccount.followers_count,
            oauth: true,
          },
        };
        if (existing) {
          await supabase.from("social_accounts").update(record).eq("id", existing.id);
        } else {
          await supabase.from("social_accounts").insert(record);
        }
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=meta`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
