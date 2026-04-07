import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons|api/cron|api/webhooks|api/tts|api/app|api/license|api/oauth|api/telegram|tiktok-developers-site-verification\\.txt|manifest\\.json|\\.well-known).*)",
  ],
};
