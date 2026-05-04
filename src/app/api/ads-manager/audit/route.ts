/**
 * GET /api/ads-manager/audit
 *
 * Runs the claude-ads-inspired 200+ check audit against the agency owner's
 * current ad campaign cache. Returns a weighted health score (0–100) and the
 * list of failing checks, ordered by severity.
 *
 * No upstream API calls — reads only from the local `ad_campaigns` cache and
 * `oauth_connections`. If the cache is empty the checks that need campaign data
 * are skipped (returned as null) rather than failing — the score only reflects
 * checks that could actually be evaluated.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient, type UnifiedPlatform } from "@/lib/ads/unified-client";
import { runAudit } from "@/lib/ads/audit-engine";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch cached campaigns via the UnifiedAdsClient (handles normalisation).
  const client = new UnifiedAdsClient(supabase, ownerId);
  let campaigns = await client.listCampaigns();

  // Cap to 500 to avoid runaway memory on large accounts.
  campaigns = campaigns.slice(0, 500);

  // Determine which platforms are actively connected.
  const PLATFORM_OAUTH_MAP: Record<string, UnifiedPlatform> = {
    meta_ads: "meta",
    google_ads: "google",
    tiktok_ads: "tiktok",
    linkedin_ads: "linkedin",
    pinterest_ads: "pinterest",
  };

  const { data: oauthRows } = await supabase
    .from("oauth_connections")
    .select("platform")
    .eq("agency_owner_id", ownerId)
    .in("platform", Object.keys(PLATFORM_OAUTH_MAP))
    .eq("status", "active");

  const connectedPlatforms: UnifiedPlatform[] = (oauthRows ?? [])
    .map((r) => PLATFORM_OAUTH_MAP[r.platform as string])
    .filter(Boolean);

  const { results, score } = runAudit({ campaigns, connectedPlatforms });

  // Only surface failing checks to the client (passing + skipped are implicit).
  const failingChecks = results
    .filter((r) => r.passed === false)
    .map((r) => ({
      id: r.check.id,
      name: r.check.name,
      description: r.check.description,
      severity: r.check.severity,
      category: r.check.category,
      platform: r.check.platform,
      recommendation: r.check.recommendation,
    }));

  return NextResponse.json({ score, failingChecks });
}
