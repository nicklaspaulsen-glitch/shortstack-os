import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Server-side sign-out: clears all Supabase auth cookies and redirects to login.
// Used when the client-side signOut() can't function due to broken cookies.
export async function GET() {
  const cookieStore = cookies();

  // Delete all Supabase auth cookies (including chunked ones)
  const allCookies = cookieStore.getAll();
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "https://shortstack-os.vercel.app"));

  for (const cookie of allCookies) {
    if (cookie.name.includes("supabase") || cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}
