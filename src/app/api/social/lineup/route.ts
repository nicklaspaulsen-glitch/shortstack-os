import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import type { SocialPost, SocialPostStatus, SocialPlatform } from "@/lib/social-studio/types";

/**
 * GET /api/social/lineup
 *
 * Combined cross-platform feed of social_posts for the calendar/lineup
 * tab. Filters: status, platform, date range, optional client_id scoping.
 *
 * Query params:
 *  - status: csv of statuses (draft,scheduled,...). Default: all.
 *  - platforms: csv of platforms (instagram,tiktok,...).
 *  - from / to: ISO dates limiting scheduled_at | published_at | created_at.
 *  - client_id: scope to a single client.
 *  - limit: default 200, max 500.
 *
 * Returns { posts: SocialPost[] }
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve effective owner — team_members read their parent agency's posts.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const platformsParam = url.searchParams.get("platforms");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const clientId = url.searchParams.get("client_id");
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "200", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  // Defense in depth — if a client_id was supplied, verify ownership
  // before we issue the read. RLS guards user_id but client_id ownership
  // rolls up via the clients table.
  if (clientId) {
    const ownership = await requireOwnedClient(supabase, user.id, clientId);
    if (!ownership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabase
    .from("social_posts")
    .select("*")
    .eq("user_id", ownerId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clientId) query = query.eq("client_id", clientId);

  if (statusParam) {
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as SocialPostStatus[];
    if (statuses.length > 0) query = query.in("status", statuses);
  }

  if (platformsParam) {
    const plats = platformsParam.split(",").map((p) => p.trim()).filter(Boolean);
    // Postgres array overlap — match if any selected platform is in the row's
    // platforms array.
    if (plats.length > 0) query = query.overlaps("platforms", plats);
  }

  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);

  const { data, error } = await query;
  if (error) {
    console.error("[social-studio/lineup] supabase error", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Aggregate stat tiles for the top of the page so the client can render
  // them without a second round-trip. Counts use the same scope (user
  // + optional client_id) but ignore platform/status filters so the
  // numbers never appear to "jump" when filters change.
  const baseCount = supabase
    .from("social_posts")
    .select("status, scheduled_at, published_at, engagement_metrics", { count: "exact" })
    .eq("user_id", ownerId);

  const { data: allRows } = clientId
    ? await baseCount.eq("client_id", clientId)
    : await baseCount;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total_scheduled: 0,
    posts_this_week: 0,
    published_this_month: 0,
    avg_engagement_rate: 0,
  };
  let engagementSum = 0;
  let engagementCount = 0;

  for (const row of (allRows as Array<{
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    engagement_metrics: Record<string, unknown> | null;
  }> | null) ?? []) {
    if (row.status === "scheduled") stats.total_scheduled += 1;

    if (row.scheduled_at) {
      const d = new Date(row.scheduled_at);
      if (d >= startOfWeek) stats.posts_this_week += 1;
    }
    if (row.published_at) {
      const d = new Date(row.published_at);
      if (d >= startOfMonth) stats.published_this_month += 1;
    }

    const rate = row.engagement_metrics?.engagement_rate;
    if (typeof rate === "number" && Number.isFinite(rate)) {
      engagementSum += rate;
      engagementCount += 1;
    }
  }
  stats.avg_engagement_rate = engagementCount > 0
    ? Number((engagementSum / engagementCount).toFixed(2))
    : 0;

  return NextResponse.json({
    posts: (data ?? []) as SocialPost[],
    stats,
  });
}

/**
 * DELETE /api/social/lineup?id=...
 * Cancel a post (soft) — flips status to cancelled. We don't hard-delete
 * because the row carries history (zernio_post_id, engagement) we may
 * still need for reporting.
 */
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("social_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[social-studio/lineup] cancel error", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/social/lineup
 * Edit caption/scheduled_at/hashtags on an existing post. Body must
 * include `id` and any subset of mutable fields.
 *
 * Note: only owns the local row — does NOT propagate to Zernio when the
 * post is already published. v2 will handle that via Zernio's edit
 * endpoint.
 */
type PatchablePost = Partial<Pick<SocialPost,
  "caption" | "hashtags" | "scheduled_at" | "platforms" | "status" | "media_urls" | "content"
>> & { id: string };

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PatchablePost;
  try {
    body = await request.json() as PatchablePost;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || !body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Allowlist mutable fields — never let a caller flip user_id, etc.
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.caption !== undefined) updates.caption = body.caption;
  if (body.hashtags !== undefined) updates.hashtags = body.hashtags;
  if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;
  if (body.platforms !== undefined) updates.platforms = body.platforms as SocialPlatform[];
  if (body.status !== undefined) updates.status = body.status;
  if (body.media_urls !== undefined) updates.media_urls = body.media_urls;
  if (body.content !== undefined) updates.content = body.content;

  const { data, error } = await supabase
    .from("social_posts")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", ownerId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[social-studio/lineup] patch error", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ post: data as SocialPost });
}
