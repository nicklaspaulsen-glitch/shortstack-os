import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

// Redirect user to TikTok OAuth login.
//
// SECURITY: requires an authenticated session AND verifies the caller owns
// the target client_id. The `state` is HMAC-signed so the callback can prove
// it was issued by us — prevents attackers from crafting OAuth start URLs
// that stash victim tokens against attacker-controlled client_ids.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await canUserWriteForClient(
    supabase as unknown as Parameters<typeof canUserWriteForClient>[0],
    user.id,
    clientId,
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return NextResponse.json({ error: "TikTok client key not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/tiktok/callback`;
  const state = signOAuthState({ client_id: clientId, platform: "tiktok", uid: user.id });

  const scopes = "user.info.basic,video.list,video.upload,video.publish";
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
