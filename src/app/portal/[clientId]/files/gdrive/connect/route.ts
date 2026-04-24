/**
 * GET /portal/[clientId]/files/gdrive/connect
 *   Redirects the client into Google's OAuth consent screen for Drive
 *   readonly. The state param carries the client_id + caller user_id,
 *   HMAC-signed and TTL-capped, so the callback can verify nothing was
 *   tampered with.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { buildGDriveAuthUrl, missingGDriveEnv } from "@/lib/cloud-drive/gdrive";
import { encodeGDriveState } from "@/lib/cloud-drive/client-files-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", `/portal/${params.clientId}/files`);
    return NextResponse.redirect(login);
  }

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const missing = missingGDriveEnv();
  if (missing.length) {
    const url = new URL(`/portal/${params.clientId}/files`, req.url);
    url.searchParams.set("error", "gdrive_not_configured");
    url.searchParams.set("missing", missing.join(","));
    return NextResponse.redirect(url);
  }

  const state = encodeGDriveState({
    client_id: params.clientId,
    user_id: user.id,
    return_to: `/portal/${params.clientId}/files`,
  });

  return NextResponse.redirect(buildGDriveAuthUrl(state));
}
