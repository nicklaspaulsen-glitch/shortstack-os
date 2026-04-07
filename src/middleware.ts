import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip auth for static/public files
  const path = request.nextUrl.pathname;
  if (
    path.endsWith(".txt") ||
    path.endsWith(".xml") ||
    path.startsWith("/.well-known") ||
    path.includes("tiktok")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons|api/cron|api/webhooks|api/tts|api/app|api/license|api/oauth|api/telegram|tiktok.*\\.txt|manifest\\.json|\\.well-known).*)",
  ],
};
