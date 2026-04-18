import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * /api/extension/generate-token
 *
 * Called by the /extension-auth handshake page once the user is signed in.
 * We return the existing Supabase access token + refresh token so the
 * extension can authenticate subsequent /api/extension/* calls using the
 * standard Bearer flow validated by requireExtensionUser.
 *
 * SECURITY: this endpoint itself requires a logged-in cookie session
 * (createServerSupabase uses cookies). It does NOT mint new long-lived
 * credentials — it only hands the extension the same short-lived tokens
 * Supabase already issued to the browser. If tokens leak, rotating the
 * user's session invalidates them.
 */
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
