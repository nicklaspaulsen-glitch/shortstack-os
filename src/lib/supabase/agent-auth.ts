import { NextRequest } from "next/server";
import { createServerSupabase, createSupabaseFromToken } from "./server";

/**
 * Get an authenticated Supabase client from either:
 * 1. Bearer token in Authorization header (Electron agent)
 * 2. Cookies (web browser)
 *
 * Returns { supabase, user } or { error }.
 */
export async function getAgentAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  // Bearer token from Electron
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createSupabaseFromToken(token);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { error: "Invalid or expired token" } as const;
    }

    return { supabase, user } as const;
  }

  // Cookie-based auth from web
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" } as const;
  }

  return { supabase, user } as const;
}
