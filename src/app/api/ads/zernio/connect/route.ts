import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getClientZernioProfile, setupClientInZernio } from "@/lib/services/zernio";
import {
  getAdConnectUrl,
  ZERNIO_AD_PLATFORMS,
  type ZernioAdPlatform,
} from "@/lib/services/zernio-ads";

/**
 * POST /api/ads/zernio/connect
 * Body: { client_id: string, platform: "meta" | "google" | "tiktok" | "linkedin" | "pinterest" | "x", return_to?: string }
 *
 * Returns a Zernio-hosted URL the user opens to OAuth into the platform's
 * ad account. After they finish, Zernio updates the connection state on
 * its side; we read it back via the connections endpoint above.
 *
 * Why this exists vs the per-platform OAuth in /api/oauth/{meta,google,
 * tiktok}-ads/start: those routes require us to register a Meta App ID,
 * Google Cloud project, TikTok Business app, etc. — multiple developer
 * accounts and approval flows. Zernio handles that for us in exchange for
 * a single bearer token.
 *
 * Auth: requires caller's tenant to own client_id.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const clientId = String(body.client_id || "");
  const platform = String(body.platform || "") as ZernioAdPlatform;
  const returnTo = body.return_to ? String(body.return_to) : undefined;

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }
  if (!(ZERNIO_AD_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${ZERNIO_AD_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }

  // Verify ownership
  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Client not found in your workspace" }, { status: 404 });
  }

  const service = createServiceClient();
  let profileId = await getClientZernioProfile(service, clientId);
  if (!profileId) {
    const setup = await setupClientInZernio(service, clientId, client.business_name);
    if (!setup.success || !setup.profileId) {
      return NextResponse.json(
        { error: setup.error || "Could not provision Zernio profile" },
        { status: 500 },
      );
    }
    profileId = setup.profileId;
  }

  const result = await getAdConnectUrl({ profileId, platform, returnTo });
  if (!result.success || !result.url) {
    return NextResponse.json(
      { error: result.error || "Could not generate connect URL" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: result.url });
}
