import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  if (error || !code) return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=denied`);

  let state: { client_id: string } = { client_id: "" };
  try { state = JSON.parse(stateStr || "{}"); } catch {}

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${baseUrl}/api/oauth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_failed`);

    // Get profile
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileRes.json();

    const supabase = createServiceClient();
    if (state.client_id) {
      const { data: existing } = await supabase.from("social_accounts").select("id").eq("client_id", state.client_id).eq("platform", "linkedin").single();
      const record = {
        client_id: state.client_id,
        platform: "linkedin",
        account_name: profileData.name || "LinkedIn User",
        account_id: profileData.sub || "",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        is_active: true,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString(),
        metadata: { connected_at: new Date().toISOString(), picture: profileData.picture, oauth: true },
      };
      if (existing) {
        await supabase.from("social_accounts").update(record).eq("id", existing.id);
      } else {
        await supabase.from("social_accounts").insert(record);
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?connected=linkedin`);
  } catch (err) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(String(err))}`);
  }
}
