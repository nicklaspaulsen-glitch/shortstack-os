/**
 * Google Ads → Nango disconnect.
 *
 * POST /api/integrations/nango/disconnect/google-ads
 *
 * Tears down the Nango connection AND removes the row from
 * `oauth_connections_nango`. The legacy `oauth_connections` row (if any) is
 * left untouched — that table belongs to the DIY OAuth route which stays in
 * place during the migration.
 *
 * Body: empty. Auth is taken from the Supabase session.
 *
 * Idempotent: if neither the Nango connection nor the DB row exists, returns
 * 200 with `{ disconnected: false, reason: "not_connected" }`.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  NANGO_INTEGRATIONS,
  NangoError,
  buildConnectionId,
  deleteConnection,
} from "@/lib/nango/client";

const INTEGRATION_ID = NANGO_INTEGRATIONS.GOOGLE_ADS;

export async function POST(_req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NANGO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Nango not configured", missing_env: ["NANGO_SECRET_KEY"] },
      { status: 503 },
    );
  }

  const connectionId = buildConnectionId(user.id, INTEGRATION_ID);

  // 1. Delete the Nango connection (revokes the upstream refresh token where
  //    supported). We swallow connection_not_found errors — the user may have
  //    already disconnected from the Nango dashboard.
  let nangoDeleted = false;
  try {
    await deleteConnection(INTEGRATION_ID, connectionId);
    nangoDeleted = true;
  } catch (err) {
    if (err instanceof NangoError && err.code === "delete_failed") {
      // Couldn't reach Nango or connection didn't exist — keep going so we
      // still clean up the local row. Log for ops visibility.
      console.warn(
        `[nango-disconnect] google-ads delete returned ${err.code}: ${err.message}`,
      );
    } else {
      console.error("[nango-disconnect] google-ads unexpected error", err);
      return NextResponse.json(
        { error: "Failed to disconnect Nango integration" },
        { status: 500 },
      );
    }
  }

  // 2. Remove the local row. Use service-role here because we want to ensure
  //    cleanup succeeds even if RLS is misconfigured — the user_id filter
  //    keeps the blast radius scoped to the authenticated tenant.
  const service = createServiceClient();
  const { error: dbError, count } = await service
    .from("oauth_connections_nango")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("integration_id", INTEGRATION_ID);

  if (dbError) {
    console.error("[nango-disconnect] DB cleanup failed", dbError);
    return NextResponse.json(
      { error: "Disconnected from Nango but DB cleanup failed", detail: dbError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    disconnected: nangoDeleted || (count ?? 0) > 0,
    integration_id: INTEGRATION_ID,
    rows_deleted: count ?? 0,
  });
}
