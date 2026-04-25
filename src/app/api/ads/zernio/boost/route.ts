import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getClientZernioProfile } from "@/lib/services/zernio";
import {
  boostPost,
  ZERNIO_AD_PLATFORMS,
  type ZernioAdPlatform,
} from "@/lib/services/zernio-ads";

/**
 * POST /api/ads/zernio/boost
 *
 * Body: {
 *   client_id: string,
 *   platform: ZernioAdPlatform,
 *   post_id?: string,        // Zernio post id (returned by /api/social/schedule)
 *   post_url?: string,       // Native platform post URL
 *   daily_budget: number,    // in account currency, NOT cents
 *   duration_days: number,   // 1..30 typical
 *   targeting?: { ... }
 * }
 *
 * Boosts an organic post into a paid ad on the specified platform.
 * Smallest-friction ad-creation surface — paste a post URL, set a budget,
 * and Zernio creates the campaign.
 *
 * Mirrors how the boost button on /dashboard/social-manager will fire.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const clientId = String(body.client_id || "");
  const platform = String(body.platform || "") as ZernioAdPlatform;
  const postId = body.post_id ? String(body.post_id) : undefined;
  const postUrl = body.post_url ? String(body.post_url) : undefined;
  const dailyBudget = Number(body.daily_budget);
  const durationDays = Number(body.duration_days);

  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });
  if (!(ZERNIO_AD_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${ZERNIO_AD_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!postId && !postUrl) {
    return NextResponse.json({ error: "post_id or post_url required" }, { status: 400 });
  }
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json({ error: "daily_budget must be > 0" }, { status: 400 });
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 60) {
    return NextResponse.json({ error: "duration_days must be 1-60" }, { status: 400 });
  }

  // Verify ownership
  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Client not found in your workspace" }, { status: 404 });
  }

  const service = createServiceClient();
  const profileId = await getClientZernioProfile(service, clientId);
  if (!profileId) {
    return NextResponse.json(
      { error: "Client not provisioned in Zernio. Connect ad accounts first." },
      { status: 400 },
    );
  }

  const result = await boostPost({
    profileId,
    platform,
    postId,
    postUrl,
    dailyBudget,
    durationDays,
    targeting: body.targeting,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Boost failed" }, { status: 502 });
  }

  // Log to trinity_log for audit / Telegram pings
  await service.from("trinity_log").insert({
    action_type: "ads_management",
    description: `Boosted ${platform} post — $${dailyBudget}/day × ${durationDays} days`,
    status: "completed",
    metadata: {
      source: "zernio_ads",
      ad_id: result.adId,
      client_id: clientId,
      platform,
      daily_budget: dailyBudget,
      duration_days: durationDays,
    },
  });

  return NextResponse.json({ success: true, ad_id: result.adId });
}
