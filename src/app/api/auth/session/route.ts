import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Returns the current server-side session tokens so the browser client
// can sync its auth state. The middleware guarantees fresh cookies on
// every request, so this always returns a valid session if the user
// is authenticated.
export async function GET() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {}, // read-only
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session || error) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}
