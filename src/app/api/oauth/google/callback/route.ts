import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  if (error || !code) return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=denied`);

  let state: { client_id: string; platform: string } = { client_id: "", platform: "youtube" };
  try { state = JSON.parse(stateStr || "{}"); } catch {}

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${baseUrl}/api/oauth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_failed`);

    // Get channel/profile info
    let accountName = "Google Account";
    let accountId = "";

    if (state.platform === "youtube") {
      const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const chData = await chRes.json();
      if (chData.items?.[0]) {
        accountName = chData.items[0].snippet.title;
        accountId = chData.items[0].id;
      }
    } else if (state.platform === "google_ads") {
      // Fetch accessible Google Ads customer IDs
      const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
      if (devToken) {
        try {
          const custRes = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "developer-token": devToken,
            },
          });
          const custData = await custRes.json();
          const resourceNames: string[] = custData.resourceNames || [];
          if (resourceNames.length > 0) {
            // resourceNames look like "customers/1234567890"
            accountId = resourceNames[0].replace("customers/", "");
            accountName = `Google Ads (${accountId})`;
          }
        } catch {}
      }
    }

    const supabase = createServiceClient();
    if (state.client_id) {
      const { data: existing } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", state.platform).single();
      const record = {
        client_id: state.client_id,
        platform: state.platform,
        account_name: accountName,
        account_id: accountId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        is_active: true,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        metadata: { connected_at: new Date().toISOString(), oauth: true },
      };
      if (existing) {
        await supabase.from("social_accounts").update(record).eq("id", existing.id);
      } else {
        await supabase.from("social_accounts").insert(record);
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=${state.platform}`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
