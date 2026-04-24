/**
 * GET /api/portal/[clientId]/files/gdrive/list
 *   Returns the client's most recently modified Google Drive files.
 *   Requires a connected (non-revoked) row in `client_oauth_tokens`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { gdriveFromTokens, listGDriveFiles } from "@/lib/cloud-drive/gdrive";
import { decryptToken } from "@/lib/crypto/token-cipher";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: tokenRow, error } = await service
    .from("client_oauth_tokens")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("client_id", params.clientId)
    .eq("provider", "gdrive")
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!tokenRow) {
    return NextResponse.json(
      { connected: false, error: "Google Drive not connected" },
      { status: 404 },
    );
  }

  let access_token: string;
  let refresh_token: string | null = null;
  try {
    access_token = decryptToken(tokenRow.access_token);
    if (tokenRow.refresh_token) refresh_token = decryptToken(tokenRow.refresh_token);
  } catch (e) {
    console.error("[gdrive list] decrypt failed:", e);
    return NextResponse.json(
      { error: "Stored token could not be decrypted — please reconnect" },
      { status: 500 },
    );
  }

  try {
    const drive = gdriveFromTokens({
      access_token,
      refresh_token,
      expires_at: tokenRow.expires_at,
    });
    const files = await listGDriveFiles(drive, 100);
    return NextResponse.json({ connected: true, files });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown Drive error";
    console.error("[gdrive list] drive error:", e);
    return NextResponse.json(
      { connected: true, error: `Drive API error: ${msg}` },
      { status: 502 },
    );
  }
}
