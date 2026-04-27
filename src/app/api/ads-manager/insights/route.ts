/**
 * GET /api/ads-manager/insights
 *
 * Returns the latest pending AI optimization suggestions plus time-series
 * chart data for the Insights tab. Cheap read-only endpoint — does NOT call
 * the LLM. To generate fresh suggestions, POST to /insights/generate.
 *
 * POST /api/ads-manager/insights/[id]
 *   accept | reject a suggestion (handled in [id]/route.ts).
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

interface PlatformDailyPoint {
  date: string;
  meta: number;
  google: number;
  tiktok: number;
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  // Pending suggestions
  const { data: suggestions } = await supabase
    .from("ads_optimization_suggestions")
    .select("*")
    .eq("user_id", ownerId)
    .eq("status", "pending")
    .order("potential_lift_pct", { ascending: false, nullsFirst: false });

  // Time-series from ads_metrics_cache — last 30 days, broken down per
  // platform for the spend / conversions / ROAS charts.
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromIso = fromDate.toISOString().slice(0, 10);

  const { data: dailyRows } = await supabase
    .from("ads_metrics_cache")
    .select("date, platform, spend_cents, conversions, roas")
    .eq("user_id", ownerId)
    .gte("date", fromIso)
    .order("date", { ascending: true });

  const spendSeries = pivotByPlatform(dailyRows || [], "spend");
  const conversionsSeries = pivotByPlatform(dailyRows || [], "conversions");
  const roasSeries = pivotByPlatform(dailyRows || [], "roas");

  return NextResponse.json({
    suggestions: suggestions || [],
    charts: {
      spend: spendSeries,
      conversions: conversionsSeries,
      roas: roasSeries,
    },
  });
}

function pivotByPlatform(
  rows: Array<{
    date: string;
    platform: string;
    spend_cents: number | null;
    conversions: number | null;
    roas: number | null;
  }>,
  metric: "spend" | "conversions" | "roas",
): PlatformDailyPoint[] {
  const map = new Map<string, PlatformDailyPoint>();
  for (const row of rows) {
    const date = String(row.date);
    if (!map.has(date)) {
      map.set(date, { date, meta: 0, google: 0, tiktok: 0 });
    }
    const point = map.get(date)!;
    const platform = row.platform as "meta" | "google" | "tiktok";
    if (platform !== "meta" && platform !== "google" && platform !== "tiktok") continue;

    if (metric === "spend") {
      point[platform] = (point[platform] || 0) + Number(row.spend_cents || 0) / 100;
    } else if (metric === "conversions") {
      point[platform] = (point[platform] || 0) + Number(row.conversions || 0);
    } else if (metric === "roas") {
      // ROAS doesn't sum across rows — average per-platform per-day.
      point[platform] = Number(row.roas || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
