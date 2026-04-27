/**
 * POST /api/ads-manager/campaigns/[id]/pause
 *
 * Universal pause/resume — dispatches to the right platform API. The id in
 * the URL is the **internal** ad_campaigns row id (uuid); the upstream
 * external_id and platform are looked up from the row.
 *
 * Body:
 *   { resume?: boolean } — pass `{ resume: true }` to activate instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient, type UnifiedPlatform } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

function platformFromRow(raw: string): UnifiedPlatform | null {
  if (raw === "meta_ads" || raw === "meta") return "meta";
  if (raw === "google_ads" || raw === "google") return "google";
  if (raw === "tiktok_ads" || raw === "tiktok") return "tiktok";
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const body = await request.json().catch(() => ({}));
  const resume = !!body.resume;

  const { data: row, error } = await supabase
    .from("ad_campaigns")
    .select("id, external_id, platform, user_id")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const platform = platformFromRow(String(row.platform));
  if (!platform) {
    return NextResponse.json(
      { error: `Unsupported platform: ${row.platform}` },
      { status: 400 },
    );
  }

  const client = new UnifiedAdsClient(supabase, ownerId);
  const result = resume
    ? await client.resumeCampaign(platform, String(row.external_id))
    : await client.pauseCampaign(platform, String(row.external_id));

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || "Failed to update campaign",
        pendingApproval: result.pendingApproval || false,
      },
      { status: result.pendingApproval ? 503 : 500 },
    );
  }

  return NextResponse.json({ success: true, status: resume ? "active" : "paused" });
}
