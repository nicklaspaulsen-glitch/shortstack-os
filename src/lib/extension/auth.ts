import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabase, createSupabaseFromToken } from "@/lib/supabase/server";

/**
 * Shared auth helper for /api/extension/* routes.
 *
 * The Chrome extension sends a Bearer access token obtained via the
 * extension-auth handshake page. When the token is missing or invalid we
 * fall back to cookie-based auth (useful when the extension popup iframe
 * shares the app origin). Either path returns a validated Supabase user.
 *
 * SECURITY: Before this helper existed, the extension routes only checked
 * for the literal prefix "Bearer " on the Authorization header without
 * verifying the token — that let anyone with a bogus header call the
 * endpoints (including the Claude-proxying chat route). This helper fixes
 * that by actually validating the token with Supabase.
 */
export async function requireExtensionUser(
  req: NextRequest,
): Promise<
  | { supabase: SupabaseClient; user: User; error?: undefined }
  | { error: NextResponse; supabase?: undefined; user?: undefined }
> {
  const authHeader = req.headers.get("authorization");

  // Primary path: Bearer access token (how the extension authenticates)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    const supabase = createSupabaseFromToken(token);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        error: NextResponse.json(
          { error: "Unauthorized: invalid or expired token" },
          { status: 401 },
        ),
      };
    }
    return { supabase, user };
  }

  // Fallback: cookie session (used when hitting routes from the web)
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { supabase, user };
}
