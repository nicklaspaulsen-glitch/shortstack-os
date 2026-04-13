import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { syncPlatformCampaigns } from "@/lib/ads/platforms";

const PLATFORMS = ["meta_ads", "google_ads", "tiktok_ads"] as const;

// POST — Sync campaign data from ad platforms
export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { client_id, platform } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    // Determine which platforms to sync
    const platformsToSync = platform ? [platform] : [...PLATFORMS];

    const results: Record<string, { synced: number; errors: string[] }> = {};

    for (const p of platformsToSync) {
      try {
        const syncResult = await syncPlatformCampaigns(client_id, p);
        results[p] = {
          synced: syncResult.synced ?? 0,
          errors: syncResult.errors ?? [],
        };
      } catch (err) {
        results[p] = {
          synced: 0,
          errors: [err instanceof Error ? err.message : "Sync failed"],
        };
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[ads/sync] POST error:", error);
    return NextResponse.json(
      { error: "Failed to sync campaigns" },
      { status: 500 }
    );
  }
}

// GET — Check sync status for a client
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const clientId = request.nextUrl.searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const platforms: Record<
      string,
      { last_synced: string | null; campaign_count: number }
    > = {};

    for (const p of PLATFORMS) {
      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select("last_synced_at")
        .eq("client_id", clientId)
        .eq("platform", p)
        .order("last_synced_at", { ascending: false });

      if (error || !campaigns || campaigns.length === 0) {
        platforms[p] = { last_synced: null, campaign_count: 0 };
      } else {
        platforms[p] = {
          last_synced: campaigns[0].last_synced_at,
          campaign_count: campaigns.length,
        };
      }
    }

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("[ads/sync] GET error:", error);
    return NextResponse.json(
      { error: "Failed to check sync status" },
      { status: 500 }
    );
  }
}
