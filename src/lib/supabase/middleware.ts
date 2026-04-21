import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 1. Update request cookies (for server-side reading downstream)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // 2. Recreate response ONCE with all updated request headers
          supabaseResponse = NextResponse.next({
            request,
          });
          // 3. Set ALL cookies on the single response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  // Allow: /login, /auth/* (OAuth callback), /api/auth/* (password reset etc.)
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login")
    || request.nextUrl.pathname.startsWith("/auth")
    || request.nextUrl.pathname.startsWith("/api/auth");
  if (!user && !isAuthRoute) {
    // API routes get 401 JSON (idiomatic for programmatic callers + what the
    // Apr 21 E2E audit flagged). Browser/page routes keep the redirect
    // behaviour so users get bounced to /login.
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
