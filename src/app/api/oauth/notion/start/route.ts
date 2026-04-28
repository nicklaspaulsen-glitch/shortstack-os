import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/oauth/notion/start
//
// Fail-closed Notion OAuth start route. Apr 28 audit: previously
// returned a JSON 501 on every request even when an authenticated
// user clicked "Connect Notion" — which broke the front-end flow
// silently and let stale links lure users into thinking the feature
// was about to ship. Now:
//
//   1. If the user isn't authed → redirect to login (unchanged).
//   2. If NOTION_CLIENT_ID / NOTION_CLIENT_SECRET are unset →
//      redirect back to /dashboard/integrations with a `?notion=
//      not_configured` query string so the page can surface a real
//      "Notion is coming soon" toast instead of a JSON blob.
//   3. When the env vars ARE set → kick off the standard Notion
//      OAuth handshake. The matching callback route still needs to
//      be implemented; until it is, env presence + this route
//      together let us flip the integration on without redeploys.
//
// Ref: https://developers.notion.com/docs/authorization
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.shortstack.work";

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    // Fail-closed but front-end-friendly. The integrations page should
    // detect ?notion=not_configured and show "Coming soon" / "Contact
    // admin" copy instead of a generic 500.
    const back = new URL("/dashboard/integrations?notion=not_configured", baseUrl);
    return NextResponse.redirect(back);
  }

  // Build the standard Notion OAuth URL. Once the callback route lands
  // at /api/oauth/notion/callback, the round-trip will work end-to-end.
  const callbackUrl = `${baseUrl}/api/oauth/notion/callback`;
  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", user.id); // ties the callback back to the user
  return NextResponse.redirect(authUrl);
}
