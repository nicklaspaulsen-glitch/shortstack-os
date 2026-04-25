import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");

  const linkedinClientId = process.env.LINKEDIN_CLIENT_ID;
  if (!linkedinClientId) return NextResponse.json({ error: "LinkedIn Client ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/oauth/linkedin/callback`;
  const state = JSON.stringify({ client_id: clientId });
  const scopes = "openid profile w_member_social r_organization_admin w_organization_social rw_organization_admin";

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedinClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
