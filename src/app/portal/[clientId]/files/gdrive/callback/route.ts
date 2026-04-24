/**
 * GET /portal/[clientId]/files/gdrive/callback?code=...&state=...
 *   Google's OAuth consent redirect lands here. We:
 *     1. Verify `state` HMAC + TTL.
 *     2. Exchange the `code` for tokens.
 *     3. Encrypt tokens (AES-256-GCM) and upsert a row in
 *        `client_oauth_tokens` (revoking any prior active row for the same
 *        client+provider first).
 *     4. Redirect back to the files page with ?connected=gdrive or an
 *        error code.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { exchangeGDriveCode } from "@/lib/cloud-drive/gdrive";
import { decodeGDriveState } from "@/lib/cloud-drive/client-files-helpers";
import { encryptToken, encryptTokenOrNull } from "@/lib/crypto/token-cipher";

function fail(req: NextRequest, clientId: string, reason: string) {
  const url = new URL(`/portal/${clientId}/files`, req.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail(req, params.clientId, "unauthorized");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return fail(req, params.clientId, `google_${oauthError}`);
  if (!code || !state) return fail(req, params.clientId, "missing_code_or_state");

  const decoded = decodeGDriveState(state);
  if (!decoded) return fail(req, params.clientId, "invalid_state");
  if (decoded.client_id !== params.clientId) return fail(req, params.clientId, "state_client_mismatch");
  if (decoded.user_id !== user.id) return fail(req, params.clientId, "state_user_mismatch");

  let tokens;
  try {
    tokens = await exchangeGDriveCode(code);
  } catch (e) {
    console.error("[gdrive callback] exchange failed:", e);
    return fail(req, params.clientId, "exchange_failed");
  }

  const service = createServiceClient();

  // Revoke any prior active token for this client/provider so our unique index
  // stays at one active row.
  await service
    .from("client_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", params.clientId)
    .eq("provider", "gdrive")
    .is("revoked_at", null);

  const { error: insertError } = await service.from("client_oauth_tokens").insert({
    client_id: params.clientId,
    provider: "gdrive",
    access_token: encryptToken(tokens.access_token),
    refresh_token: encryptTokenOrNull(tokens.refresh_token),
    expires_at: tokens.expires_at,
    scopes: tokens.scopes,
  });
  if (insertError) {
    console.error("[gdrive callback] insert failed:", insertError);
    return fail(req, params.clientId, "db_insert_failed");
  }

  const successUrl = new URL(decoded.return_to || `/portal/${params.clientId}/files`, req.url);
  successUrl.searchParams.set("connected", "gdrive");
  return NextResponse.redirect(successUrl);
}
