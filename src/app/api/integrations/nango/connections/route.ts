/**
 * Nango → list current user's connections.
 *
 * GET /api/integrations/nango/connections
 *
 * Returns every row in `oauth_connections_nango` belonging to the
 * authenticated user. The Integrations Hub UI calls this on mount and after
 * each successful connect/disconnect to re-render the per-card status badges.
 *
 * Response:
 *   200 { connections: Array<{
 *     integration_id: string,
 *     nango_connection_id: string,
 *     display_name: string | null,
 *     connected_at: string,
 *     last_used_at: string | null,
 *   }> }
 *   401 not authenticated
 *
 * SECURITY:
 *   - Auth required.
 *   - We rely on RLS (`auth.uid() = user_id`) to scope the SELECT to the
 *     caller's rows; the `.eq("user_id", user.id)` is a belt-and-braces
 *     defense in depth so a misconfigured policy can't leak cross-tenant.
 *   - No raw token data is returned — Nango holds the secrets, this route
 *     only exposes "what's connected".
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("oauth_connections_nango")
    .select(
      "integration_id, nango_connection_id, display_name, connected_at, last_used_at",
    )
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("[nango-connections] select failed", error);
    return NextResponse.json(
      { error: "Failed to fetch connections", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    connections: data ?? [],
  });
}
