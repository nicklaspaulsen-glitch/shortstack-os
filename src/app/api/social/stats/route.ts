import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { ALL_PLATFORMS } from "@/lib/social-studio/constants";
import type {
  HeatmapCell,
  PlatformWeeklyCount,
  SocialPlatform,
  TopPost,
} from "@/lib/social-studio/types";

/**
 * GET /api/social/stats
 *
 * Aggregates from social_posts.engagement_metrics. Returns:
 *  - weekly: 12 weeks of per-platform post counts (chart-ready).
 *  - top_posts: top 10 posts by engagement_total in the window.
 *  - heatmap: day-of-week × hour cells with normalized intensity.
 *
 * engagement_total is computed as
 *   likes + comments + saves + shares + (impressions * 0.05)
 * so a row missing some metrics still produces a comparable score.
 */

interface DbPostRow {
  id: string;
  caption: string | null;
  platforms: SocialPlatform[];
  published_at: string | null;
  engagement_metrics: Record<string, unknown> | null;
}

function readNumber(obj: Record<string, unknown> | null | undefined, key: string): number {
  if (!obj) return 0;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function engagementOf(metrics: Record<string, unknown> | null): number {
  if (!metrics) return 0;
  // Defensive read — Zernio webhook payload shape varies per platform so
  // we fall back to 0 for missing keys rather than crashing.
  const likes = readNumber(metrics, "likes");
  const comments = readNumber(metrics, "comments");
  const shares = readNumber(metrics, "shares");
  const saves = readNumber(metrics, "saves");
  const impressions = readNumber(metrics, "impressions");
  return likes + comments + shares + saves + impressions * 0.05;
}

function weekStart(d: Date): Date {
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → -6, Monday → 0
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekKey(d: Date): string {
  const ws = weekStart(d);
  return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`;
}

function emptyWeekRow(week: string): PlatformWeeklyCount {
  return {
    week,
    total: 0,
    instagram: 0,
    facebook: 0,
    tiktok: 0,
    linkedin: 0,
    twitter: 0,
    youtube: 0,
    pinterest: 0,
    threads: 0,
  };
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve effective owner — team_members read parent agency stats.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");

  // Last 12 weeks worth of published posts (84 days).
  const since = new Date();
  since.setDate(since.getDate() - 84);

  let query = supabase
    .from("social_posts")
    .select("id, caption, platforms, published_at, engagement_metrics")
    .eq("user_id", ownerId)
    .not("published_at", "is", null)
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: true });

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) {
    console.error("[social-studio/stats] supabase error", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const rows = (data ?? []) as DbPostRow[];

  // Build the 12-week skeleton first so the chart axis is stable even
  // when the user has zero published posts in some weeks.
  const weeks: PlatformWeeklyCount[] = [];
  const weekIndex = new Map<string, number>();
  const cursor = weekStart(since);
  for (let i = 0; i < 12; i++) {
    const key = weekKey(cursor);
    weekIndex.set(key, weeks.length);
    weeks.push(emptyWeekRow(key));
    cursor.setDate(cursor.getDate() + 7);
  }

  const heatmapCounts = new Map<string, number>();

  // Walk every published row and accumulate.
  let topPosts: Array<TopPost & { sortScore: number }> = [];

  for (const row of rows) {
    if (!row.published_at) continue;
    const pubDate = new Date(row.published_at);
    const wk = weekKey(pubDate);
    const idx = weekIndex.get(wk);

    const platforms = Array.isArray(row.platforms)
      ? row.platforms.filter((p): p is SocialPlatform => ALL_PLATFORMS.includes(p as SocialPlatform))
      : [];

    if (idx !== undefined) {
      weeks[idx].total += platforms.length;
      for (const p of platforms) weeks[idx][p] += 1;
    }

    // Heatmap cell for the publish hour.
    const cellKey = `${pubDate.getDay()}:${pubDate.getHours()}`;
    const eng = engagementOf(row.engagement_metrics);
    heatmapCounts.set(cellKey, (heatmapCounts.get(cellKey) ?? 0) + Math.max(eng, 1));

    topPosts.push({
      id: row.id,
      caption: row.caption,
      platforms,
      published_at: row.published_at,
      engagement_total: Math.round(eng),
      sortScore: eng,
    });
  }

  topPosts.sort((a, b) => b.sortScore - a.sortScore);
  topPosts = topPosts.slice(0, 10);

  // Build heatmap output. Normalize intensity 0..1 against the loudest
  // cell so the UI can colour without recomputing.
  const heatmap: HeatmapCell[] = [];
  let maxCount = 0;
  // Use Array.from + forEach to avoid downlevelIteration on Map iterators
  // (project's tsconfig defaults to ES3 target).
  Array.from(heatmapCounts.values()).forEach((v) => {
    if (v > maxCount) maxCount = v;
  });
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}:${hour}`;
      const count = heatmapCounts.get(key) ?? 0;
      heatmap.push({
        day,
        hour,
        count: Math.round(count),
        intensity: maxCount > 0 ? count / maxCount : 0,
      });
    }
  }

  return NextResponse.json({
    weekly: weeks,
    top_posts: topPosts.map(({ sortScore: _sortScore, ...rest }) => rest),
    heatmap,
  });
}
