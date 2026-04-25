import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdAnalytics } from "@/lib/services/zernio-ads";

/**
 * GET /api/ads/zernio/analytics?ad_id=<id>&from=<iso>&to=<iso>
 *
 * Per-ad analytics from Zernio. The ad_id is the Zernio-side id returned
 * by /api/ads/zernio/boost or listed via /api/ads/zernio/campaigns.
 *
 * Auth: requires session (no client-id ownership check needed because the
 * ad_id is opaque and not enumerable — Zernio rejects requests for ad_ids
 * outside our agency's bearer token scope).
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adId = request.nextUrl.searchParams.get("ad_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!adId) return NextResponse.json({ error: "ad_id required" }, { status: 400 });

  const analytics = await getAdAnalytics({
    adId,
    from: from || undefined,
    to: to || undefined,
  });

  if (!analytics) {
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 502 });
  }

  return NextResponse.json({ analytics });
}
