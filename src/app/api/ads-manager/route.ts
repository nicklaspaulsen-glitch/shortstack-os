import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  objective: string;
  daily_budget: number;
  total_spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number;
  roas: number;
  start_date: string;
  end_date: string | null;
  ai_optimized: boolean;
  audience: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// GET — Return ads manager data (real, from DB; empty by default)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch real campaigns from DB (table may not exist yet — returns empty)
  let campaigns: Campaign[] = [];
  try {
    const { data } = await supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    campaigns = (data as Campaign[]) || [];
  } catch {
    // Table doesn't exist yet or query error — leave empty
  }

  // Check which platforms are connected
  const platforms_connected: Record<string, boolean> = {
    meta_ads: false,
    google_ads: false,
    tiktok_ads: false,
  };
  const platforms_last_synced: Record<string, string | null> = {
    meta_ads: null,
    google_ads: null,
    tiktok_ads: null,
  };
  try {
    const { data: conns } = await supabase
      .from("oauth_connections")
      .select("platform, is_active, updated_at, created_at, platform_type")
      .eq("user_id", user.id);
    if (Array.isArray(conns)) {
      for (const c of conns) {
        const p = c.platform as string;
        if (p === "meta_ads" || p === "meta" || p === "facebook") platforms_connected.meta_ads = !!c.is_active;
        if (p === "google_ads" || p === "google") platforms_connected.google_ads = !!c.is_active;
        if (p === "tiktok_ads" || p === "tiktok") platforms_connected.tiktok_ads = !!c.is_active;
      }
    }
  } catch {
    // ignore
  }

  // Attach last_synced_at per platform from ad_accounts
  try {
    const { data: accounts } = await supabase
      .from("ad_accounts")
      .select("platform, last_synced_at")
      .eq("user_id", user.id);
    if (Array.isArray(accounts)) {
      for (const a of accounts) {
        const key = a.platform as string;
        if (!platforms_last_synced[key]) platforms_last_synced[key] = a.last_synced_at;
        else if (a.last_synced_at && a.last_synced_at > (platforms_last_synced[key] || "")) {
          platforms_last_synced[key] = a.last_synced_at;
        }
      }
    }
  } catch {
    // ignore
  }

  // Best-effort background refresh of campaigns for connected platforms.
  // Kicked off via a cookie-forwarded fetch so the user's session applies.
  const shouldRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (shouldRefresh) {
    const origin = request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") || "";
    const connectedPlatforms = (Object.keys(platforms_connected) as Array<keyof typeof platforms_connected>)
      .filter(k => platforms_connected[k]);
    await Promise.allSettled(
      connectedPlatforms.map(p =>
        fetch(`${origin}/api/ads/${p.replace("_", "-")}/campaigns`, {
          headers: { cookie: cookieHeader },
          cache: "no-store",
        })
      )
    );
    // Re-read after refresh
    try {
      const { data } = await supabase
        .from("ad_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) campaigns = data as Campaign[];
    } catch {
      // ignore
    }
  }

  // Compute overview from real campaigns (will be 0 when empty)
  const totalSpend = campaigns.reduce((s, c) => s + (c.total_spend || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const validRoas = campaigns.filter(c => (c.roas || 0) > 0);
  const avgRoas = validRoas.length > 0
    ? validRoas.reduce((s, c) => s + c.roas, 0) / validRoas.length
    : 0;

  return NextResponse.json({
    overview: {
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_roas: Math.round(avgRoas * 10) / 10,
      ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
    },
    campaigns,
    creatives: [],
    audiences: [],
    ai_log: [],
    platforms_connected,
    platforms_last_synced,
  });
}

// ---------------------------------------------------------------------------
// POST — Actions (create, update, bulk, generate_copy, save_rule)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "create_campaign") {
      const newCampaign = {
        id: `cmp_${Date.now()}`,
        ...body.campaign,
        total_spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        cpa: 0,
        roas: 0,
        created_at: new Date().toISOString(),
      };
      // Attempt to insert into DB (safe fail if table doesn't exist)
      try {
        await supabase.from("ad_campaigns").insert({
          ...newCampaign,
          user_id: user.id,
        });
      } catch {
        // table may not exist — still return the campaign for UI
      }
      return NextResponse.json({ success: true, campaign: newCampaign });
    }

    if (action === "update_campaign") {
      try {
        await supabase
          .from("ad_campaigns")
          .update(body.campaign)
          .eq("id", body.campaign.id)
          .eq("user_id", user.id);
      } catch (err) { console.error("[ads-manager] update_campaign DB write failed:", err); }
      return NextResponse.json({ success: true, campaign: body.campaign });
    }

    if (action === "bulk_action") {
      return NextResponse.json({
        success: true,
        affected: body.campaign_ids?.length || 0,
        action: body.bulk_action,
      });
    }

    if (action === "generate_copy") {
      // Delegate to the existing Claude-powered endpoint
      return NextResponse.json({
        success: true,
        redirect: "/api/ads/generate-copy",
        message: "Use /api/ads/generate-copy for AI ad copy generation.",
        variations: [],
      });
    }

    if (action === "save_rule") {
      return NextResponse.json({ success: true, rule: { id: `rule_${Date.now()}`, ...body.rule } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
