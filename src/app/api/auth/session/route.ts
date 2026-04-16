import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Returns the current server-side session tokens so the browser client
// can sync its auth state. The middleware guarantees fresh cookies on
// every request, so this always returns a valid session if the user
// is authenticated.
//
// Uses getUser() first (validates with Supabase server) then getSession()
// to extract the raw tokens. getSession() alone can return stale data.
export async function GET() {
  try {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Can't set cookies in certain contexts
            }
          },
        },
      }
    );

    // Validate user first (server-side check, not just cookie read)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return NextResponse.json({ session: null }, { status: 401 });
    }

    // Now get session tokens (safe because user is validated)
    const { data: { session }, error } = await supabase.auth.getSession();

    if (!session || error) {
      return NextResponse.json({ session: null }, { status: 401 });
    }

    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (err) {
    console.error("[auth/session] Error:", err);
    return NextResponse.json({ session: null, error: "Server error" }, { status: 500 });
  }
}
