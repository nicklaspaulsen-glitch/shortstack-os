/**
 * Google Ads → Nango connect helper.
 *
 * GET /api/integrations/nango/connect/google-ads
 *
 * The actual OAuth dance happens in the browser via `@nangohq/frontend` (see
 * `src/lib/nango/browser.ts`). This route exists so the frontend can:
 *   1. Confirm the user is authenticated.
 *   2. Get the canonical `connectionId` to pass to Nango (and later use to
 *      fetch credentials server-side).
 *   3. Confirm `NANGO_SECRET_KEY` is configured before launching the popup.
 *
 * This pairs with `POST /api/integrations/nango/disconnect/google-ads` for the
 * teardown side. The Nango callback writes to `oauth_connections_nango` once
 * the popup completes — not implemented here in this PR (deferred to the next
 * Nango migration step). The popup will resolve, and we'll add a tiny
 * "/api/integrations/nango/finalize" route that writes the row.
 *
 * SECURITY: routes require an authenticated Supabase session. The user's
 * `connectionId` is derived from their auth UID — they cannot pass a foreign
 * connection ID and trick us into returning someone else's connection state.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { NANGO_INTEGRATIONS, buildConnectionId } from "@/lib/nango/client";

const INTEGRATION_ID = NANGO_INTEGRATIONS.GOOGLE_ADS;

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NANGO_SECRET_KEY || !process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY) {
    return NextResponse.json(
      {
        error: "Nango not configured",
        missing_env: [
          !process.env.NANGO_SECRET_KEY ? "NANGO_SECRET_KEY" : null,
          !process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY ? "NEXT_PUBLIC_NANGO_PUBLIC_KEY" : null,
        ].filter(Boolean),
      },
      { status: 503 },
    );
  }

  const connectionId = buildConnectionId(user.id, INTEGRATION_ID);

  // Look up an existing row so the UI can decide whether to show
  // "Connect" or "Reconnect".
  const { data: existing } = await supabase
    .from("oauth_connections_nango")
    .select("id, integration_id, nango_connection_id, display_name, connected_at, last_used_at")
    .eq("user_id", user.id)
    .eq("integration_id", INTEGRATION_ID)
    .maybeSingle();

  return NextResponse.json({
    integration_id: INTEGRATION_ID,
    connection_id: connectionId,
    public_key_present: true,
    existing_connection: existing || null,
  });
}
