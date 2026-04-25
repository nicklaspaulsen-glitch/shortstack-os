import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getClientZernioProfile, setupClientInZernio } from "@/lib/services/zernio";
import {
  getAdConnections,
  ZERNIO_AD_PLATFORMS,
} from "@/lib/services/zernio-ads";

/**
 * GET /api/ads/zernio/connections?client_id=<uuid>
 *
 * Returns the current Zernio ad-platform connections for one of the caller's
 * clients. The shape is:
 *   {
 *     profile_id: string | null,       // Zernio profile id, null if never set up
 *     connections: Array<{
 *       platform: "meta" | "google" | "tiktok" | "linkedin" | "pinterest" | "x",
 *       status: "connected" | "expired" | "error" | "disconnected",
 *       account_id: string | null,
 *       account_name: string | null,
 *       currency: string | null,
 *     }>
 *   }
 *
 * Auto-creates the Zernio profile if it doesn't exist yet.
 *
 * Auth: requires the caller's tenant to own the client_id.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
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

  // Resolve or auto-create the Zernio profile.
  let profileId = await getClientZernioProfile(service, clientId);
  if (!profileId) {
    const setup = await setupClientInZernio(service, clientId, client.business_name);
    if (!setup.success || !setup.profileId) {
      return NextResponse.json({
        profile_id: null,
        connections: ZERNIO_AD_PLATFORMS.map((p) => ({
          platform: p,
          status: "disconnected" as const,
          account_id: null,
          account_name: null,
        })),
        warning: setup.error || "Could not provision Zernio profile",
      });
    }
    profileId = setup.profileId;
  }

  const connections = await getAdConnections(profileId);

  // Pad with disconnected entries for any platform Zernio didn't return so
  // the UI always shows all 6 cards.
  const byPlatform = new Map(connections.map((c) => [c.platform, c]));
  const padded = ZERNIO_AD_PLATFORMS.map(
    (p) =>
      byPlatform.get(p) || {
        platform: p,
        status: "disconnected" as const,
        account_id: null,
        account_name: null,
      },
  );

  return NextResponse.json({ profile_id: profileId, connections: padded });
}
