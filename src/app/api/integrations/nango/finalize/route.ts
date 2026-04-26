/**
 * Nango → finalize a connection.
 *
 * POST /api/integrations/nango/finalize
 *
 * Called by the client AFTER the Nango popup resolves successfully. The popup
 * itself never touches our DB — it just hands the browser an "auth succeeded"
 * signal. This route is what writes the row to `oauth_connections_nango` so
 * the rest of the app can see "user X has integration Y connected".
 *
 * Request body:
 *   {
 *     integrationId: string,        // must be one of NANGO_INTEGRATIONS
 *     displayName?:  string,        // human label shown in UI ("Acme Ads")
 *     metadata?:     object,        // optional provider-specific payload
 *   }
 *
 * Response:
 *   200 { success: true, connection_id: string }
 *   400 invalid body / unknown integration
 *   401 not authenticated
 *
 * SECURITY:
 *   - Auth required — caller must be a logged-in Supabase user.
 *   - The user_id is taken from the session, never from the request body.
 *   - The Nango connection ID is derived from the user's UID — they cannot
 *     forge ownership of a foreign connection.
 *   - integrationId is validated against the `NANGO_INTEGRATIONS` allow-list
 *     so callers can't insert arbitrary text.
 *
 * Idempotency:
 *   We upsert on the (user_id, integration_id) unique constraint so a user
 *   re-running the connect flow (e.g. to refresh scopes) just bumps the
 *   `connected_at` and `display_name` instead of erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  NANGO_INTEGRATIONS,
  buildConnectionId,
  type NangoIntegrationId,
} from "@/lib/nango/client";

const ALLOWED_INTEGRATION_IDS = new Set<string>(
  Object.values(NANGO_INTEGRATIONS),
);

interface FinalizeBody {
  integrationId: NangoIntegrationId;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

interface ValidationResult {
  ok: true;
  body: FinalizeBody;
}

interface ValidationError {
  ok: false;
  message: string;
}

function validateBody(raw: unknown): ValidationResult | ValidationError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Body must be a JSON object" };
  }

  const obj = raw as Record<string, unknown>;
  const integrationId = obj.integrationId;
  if (typeof integrationId !== "string" || integrationId.length === 0) {
    return { ok: false, message: "integrationId is required" };
  }
  if (!ALLOWED_INTEGRATION_IDS.has(integrationId)) {
    return {
      ok: false,
      message: `integrationId must be one of: ${Array.from(ALLOWED_INTEGRATION_IDS).join(", ")}`,
    };
  }

  let displayName: string | undefined;
  if (obj.displayName !== undefined) {
    if (typeof obj.displayName !== "string") {
      return { ok: false, message: "displayName must be a string" };
    }
    if (obj.displayName.length > 120) {
      return { ok: false, message: "displayName must be at most 120 chars" };
    }
    displayName = obj.displayName;
  }

  let metadata: Record<string, unknown> | undefined;
  if (obj.metadata !== undefined) {
    if (
      !obj.metadata ||
      typeof obj.metadata !== "object" ||
      Array.isArray(obj.metadata)
    ) {
      return { ok: false, message: "metadata must be a JSON object" };
    }
    metadata = obj.metadata as Record<string, unknown>;
  }

  return {
    ok: true,
    body: {
      integrationId: integrationId as NangoIntegrationId,
      displayName,
      metadata,
    },
  };
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = validateBody(raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: 400 },
    );
  }

  const { integrationId, displayName, metadata } = result.body;
  const connectionId = buildConnectionId(user.id, integrationId);

  // Upsert into the per-tenant connections table. RLS enforces user_id =
  // auth.uid() on insert/update, but we set user_id explicitly for clarity
  // and to preserve the conflict target.
  const { data, error } = await supabase
    .from("oauth_connections_nango")
    .upsert(
      {
        user_id: user.id,
        integration_id: integrationId,
        nango_connection_id: connectionId,
        display_name: displayName ?? null,
        connected_at: new Date().toISOString(),
        metadata: metadata ?? {},
      },
      { onConflict: "user_id,integration_id" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("[nango-finalize] upsert failed", error);
    return NextResponse.json(
      { error: "Failed to record connection", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    connection_id: connectionId,
    row_id: data?.id ?? null,
  });
}
