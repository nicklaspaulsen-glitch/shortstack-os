import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Server-side sign-out: clears all Supabase auth cookies and redirects to login.
// Used when the client-side signOut() can't function due to broken cookies.
export async function GET() {
  const cookieStore = cookies();

  // Delete all Supabase auth cookies (including chunked ones)
  const allCookies = cookieStore.getAll();
  // Apr 28 audit: this route was reading NEXT_PUBLIC_SITE_URL — an
  // undocumented env var nobody else uses. The whole codebase reads
  // NEXT_PUBLIC_APP_URL. Switched for consistency so preview deploys
  // don't silently redirect to the production URL when the right env
  // var is set on the branch.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const response = NextResponse.redirect(new URL("/login", baseUrl));

  for (const cookie of allCookies) {
    if (cookie.name.includes("supabase") || cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}
