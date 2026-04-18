import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/content-plan
 *
 * Returns all content_calendar entries scoped to the authenticated user
 * (by client.user_id / profile_id), enriched with any engagement data
 * stored in the row's metadata/engagement_data jsonb.
 *
 * Query params:
 *   status=all|scheduled|posted|draft|failed|needs_review
 *   platform=all|instagram|facebook|tiktok|linkedin|x|youtube|...
 *   from=ISO date (scheduled_at/posted_at >= from)
 *   to=ISO date
 *   limit=1..500 (default 200)
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const url = request.nextUrl;
  const status = url.searchParams.get("status") || "all";
  const platform = url.searchParams.get("platform") || "all";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));

  // Resolve all clients owned by this user (content_calendar is scoped by client_id).
  // clients.profile_id points at the owning agency/user profile.
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", ownerId);
  const clientIds = (clientRows || []).map(c => c.id);

  let query = supabase
    .from("content_calendar")
    .select("id, client_id, content_script_id, title, platform, scheduled_at, published_at, status, live_url, notes, created_at")
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (clientIds.length > 0) {
    query = query.in("client_id", clientIds);
  } else {
    // No clients yet for this user — return empty
    return NextResponse.json({ posts: [], total: 0, stats: emptyStats() });
  }

  if (status !== "all") {
    // Map UI status tokens → DB values where they differ
    const statusMap: Record<string, string> = {
      scheduled: "scheduled",
      posted: "published",
      draft: "idea",
      failed: "failed",
      needs_review: "ready_to_publish",
    };
    const dbStatus = statusMap[status] || status;
    query = query.eq("status", dbStatus);
  }
  if (platform !== "all") query = query.eq("platform", platform);
  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally enrich with content_scripts (for caption/hook) — thumbnails come from metadata.
  const scriptIds = Array.from(new Set((rows || []).map(r => r.content_script_id).filter(Boolean))) as string[];
  let scripts: Record<string, { hook: string | null; script: string | null; thumbnail_idea: string | null }> = {};
  if (scriptIds.length > 0) {
    const { data: scriptRows } = await supabase
      .from("content_scripts")
      .select("id, hook, script_body, thumbnail_idea")
      .in("id", scriptIds);
    scripts = Object.fromEntries((scriptRows || []).map(s => [s.id, { hook: s.hook, script: s.script_body, thumbnail_idea: s.thumbnail_idea }]));
  }

  const posts = (rows || []).map(r => {
    const meta = (r as unknown as { metadata?: Record<string, unknown>; engagement_data?: Record<string, unknown> }).metadata
      || (r as unknown as { engagement_data?: Record<string, unknown> }).engagement_data
      || {};
    const engagement = extractEngagement(meta);
    const script = r.content_script_id ? scripts[r.content_script_id] : undefined;
    return {
      id: r.id,
      client_id: r.client_id,
      title: r.title,
      platform: r.platform,
      status: r.status,
      scheduled_at: r.scheduled_at,
      posted_at: r.published_at,
      live_url: r.live_url,
      caption: script?.script || script?.hook || r.notes || r.title,
      thumbnail_url: (meta.thumbnail_url as string | undefined) || null,
      thumbnail_idea: script?.thumbnail_idea || null,
      notes: r.notes,
      likes: engagement.likes,
      comments: engagement.comments,
      shares: engagement.shares,
      views: engagement.views,
      top_comment: engagement.top_comment,
      created_at: r.created_at,
    };
  });

  const stats = {
    total: posts.length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    posted: posts.filter(p => p.status === "published").length,
    draft: posts.filter(p => p.status === "idea" || p.status === "scripted").length,
    failed: posts.filter(p => p.status === "failed").length,
    needs_review: posts.filter(p => p.status === "ready_to_publish").length,
    byPlatform: posts.reduce<Record<string, number>>((acc, p) => {
      acc[p.platform] = (acc[p.platform] || 0) + 1;
      return acc;
    }, {}),
  };

  return NextResponse.json({ posts, total: posts.length, stats });
}

function emptyStats() {
  return {
    total: 0,
    scheduled: 0,
    posted: 0,
    draft: 0,
    failed: 0,
    needs_review: 0,
    byPlatform: {} as Record<string, number>,
  };
}

type TopComment = { text: string; sentiment?: "positive" | "neutral" | "negative"; likes?: number } | null;

function extractEngagement(meta: Record<string, unknown>) {
  const likes = toNumber(meta.likes) ?? toNumber(meta.like_count) ?? 0;
  const comments = toNumber(meta.comments) ?? toNumber(meta.comments_count) ?? 0;
  const shares = toNumber(meta.shares) ?? toNumber(meta.share_count) ?? 0;
  const views = toNumber(meta.views) ?? toNumber(meta.view_count) ?? 0;

  let top_comment: TopComment = null;
  const raw = meta.top_comment ?? (Array.isArray(meta.comments_top) ? (meta.comments_top as unknown[])[0] : undefined);
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    top_comment = {
      text: (r.text as string) || (r.comment as string) || "",
      sentiment: (r.sentiment as TopComment extends null ? never : NonNullable<TopComment>["sentiment"]) || undefined,
      likes: toNumber(r.likes) ?? undefined,
    };
  } else if (typeof raw === "string") {
    top_comment = { text: raw };
  }

  return { likes, comments, shares, views, top_comment };
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
