import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOAuthState, canUserWriteForClient } from "@/lib/oauth-state";

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

  const linkedinClientId = process.env.LINKEDIN_CLIENT_ID;
  if (!linkedinClientId) return NextResponse.json({ error: "LinkedIn Client ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/linkedin/callback`;
  const state = signOAuthState({ client_id: clientId, platform: "linkedin", uid: user.id });
  const scopes = "openid profile w_member_social r_organization_admin w_organization_social rw_organization_admin";

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedinClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
