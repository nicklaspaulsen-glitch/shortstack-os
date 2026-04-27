/**
 * POST /api/ads-manager/campaigns/[id]/budget
 *
 * Update a campaign's daily budget on the upstream platform. The id is the
 * internal ad_campaigns row id (uuid).
 *
 * Body:
 *   { dailyBudget: number } — in account currency units (NOT cents).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient, type UnifiedPlatform } from "@/lib/ads/unified-client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  dailyBudget: z.number().nonnegative().finite(),
});

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

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body — dailyBudget must be a non-negative number" },
      { status: 400 },
    );
  }

  const { data: row, error } = await supabase
    .from("ad_campaigns")
    .select("id, external_id, platform")
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
  const result = await client.updateBudget(
    platform,
    String(row.external_id),
    parsed.data.dailyBudget,
  );

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || "Failed to update budget",
        pendingApproval: result.pendingApproval || false,
      },
      { status: result.pendingApproval ? 503 : 500 },
    );
  }

  return NextResponse.json({ success: true, dailyBudget: parsed.data.dailyBudget });
}
