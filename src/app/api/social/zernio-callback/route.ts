/**
 * Zernio OAuth Callback Webhook — /api/social/zernio-callback
 *
 * Zernio calls this endpoint (server-to-server) when a user successfully
 * completes OAuth on a social platform via Zernio's managed OAuth flow.
 *
 * The webhook writes the access_token to the matching social_accounts row
 * so that /api/social/post can use it for direct platform API calls.
 *
 * Webhook payload shape (Zernio spec):
 *   {
 *     event:       "account.connected" | "account.refreshed" | "account.disconnected",
 *     profile_id:  string,   // Zernio profile ID → maps to clients.zernio_profile_id
 *     account: {
 *       id:            string,
 *       platform:      string,  // "instagram" | "tiktok" | "facebook" | …
 *       name:          string,
 *       username?:     string,
 *       access_token:  string,
 *       refresh_token?: string,
 *       expires_at?:   string,  // ISO timestamp
 *       status:        "connected" | "disconnected",
 *     }
 *   }
 *
 * Security: requests are authenticated via the x-zernio-signature header
 * (HMAC-SHA256 of the raw body signed with ZERNIO_WEBHOOK_SECRET).
 * If that env var is absent we fall back to checking the Authorization header
 * matches ZERNIO_API_KEY — less secure but still gated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

const ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET;
const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

function verifySignature(rawBody: string, signature: string): boolean {
  if (!ZERNIO_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", ZERNIO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(`sha256=${expected}`),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

function isAuthorized(request: NextRequest, rawBody: string): boolean {
  // Preferred: HMAC signature header
  const sig = request.headers.get("x-zernio-signature");
  if (sig && ZERNIO_WEBHOOK_SECRET) {
    return verifySignature(rawBody, sig);
  }

  // Fallback: bare API key in Authorization header
  const auth = request.headers.get("authorization");
  if (auth && ZERNIO_API_KEY) {
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(ZERNIO_API_KEY),
      );
    } catch {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Read raw body first so we can verify the HMAC before parsing JSON
  const rawBody = await request.text();

  if (!isAuthorized(request, rawBody)) {
    console.error("[zernio-callback] Unauthorized webhook — signature mismatch or missing API key");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    event: string;
    profile_id: string;
    account: {
      id: string;
      platform: string;
      name?: string;
      username?: string;
      access_token?: string;
      refresh_token?: string;
      expires_at?: string;
      status: string;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, profile_id, account } = payload;

  if (!profile_id || !account?.id || !account?.platform) {
    return NextResponse.json(
      { error: "Missing required fields: profile_id, account.id, account.platform" },
      { status: 400 },
    );
  }

  // Service-role client so we can write without a user session
  const supabase = createServiceClient();

  // Look up the client that owns this Zernio profile
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("zernio_profile_id", profile_id)
    .single();

  if (clientErr || !client) {
    console.error("[zernio-callback] Unknown profile_id:", profile_id, clientErr?.message);
    // Return 200 so Zernio doesn't retry indefinitely for unknown profiles
    return NextResponse.json({ received: true, skipped: "unknown_profile" });
  }

  const clientId = client.id;

  if (event === "account.disconnected") {
    // Mark the account inactive locally
    await supabase
      .from("social_accounts")
      .update({ is_active: false, access_token: null })
      .eq("client_id", clientId)
      .eq("platform", account.platform)
      .eq("account_id", account.id);

    console.log(`[zernio-callback] Account disconnected: client=${clientId} platform=${account.platform}`);
    return NextResponse.json({ received: true });
  }

  // account.connected / account.refreshed — upsert with the fresh token
  const accountName = account.name || account.username || account.platform;
  const isConnected = account.status === "connected";

  const upsertData: Record<string, unknown> = {
    client_id: clientId,
    platform: account.platform,
    account_id: account.id,
    account_name: accountName,
    is_active: isConnected,
    metadata: {
      oauth: true,
      zernio: true,
      zernio_event: event,
      synced_at: new Date().toISOString(),
    },
  };

  if (account.access_token) {
    upsertData.access_token = account.access_token;
  }
  if (account.refresh_token) {
    upsertData.refresh_token = account.refresh_token;
  }
  if (account.expires_at) {
    upsertData.token_expires_at = account.expires_at;
  }

  const { error: upsertErr } = await supabase
    .from("social_accounts")
    .upsert(upsertData, {
      onConflict: "client_id,platform,account_id",
      ignoreDuplicates: false,
    });

  if (upsertErr) {
    console.error("[zernio-callback] Upsert failed:", upsertErr.message);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  console.log(
    `[zernio-callback] ${event}: client=${clientId} platform=${account.platform} account=${account.id} hasToken=${!!account.access_token}`,
  );

  return NextResponse.json({ received: true });
}
