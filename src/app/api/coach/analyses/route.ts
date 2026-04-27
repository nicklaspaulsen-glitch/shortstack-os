/**
 * GET /api/coach/analyses
 *
 * Paginated list of coach analyses for the caller's agency. Filters:
 *   source_type      voice_call | meeting | email_thread
 *   rep_id           filter to a single rep
 *   min_score        only include analyses with overall_score >= n
 *   since            ISO date — only analyses created on/after
 *   limit / offset   pagination (default 25, max 100)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get("source_type");
  const repId = searchParams.get("rep_id");
  const minScore = parseInt(searchParams.get("min_score") || "", 10);
  const since = searchParams.get("since");
  const rawLimit = parseInt(searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, rawLimit))
    : 25;
  const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const service = createServiceClient();

  let query = service
    .from("coach_analyses")
    .select(
      "id, source_type, source_id, rep_id, metrics, insights, next_actions, overall_score, cost_usd, created_at",
      { count: "exact" },
    )
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceType && ["voice_call", "meeting", "email_thread"].includes(sourceType)) {
    query = query.eq("source_type", sourceType);
  }
  if (repId) query = query.eq("rep_id", repId);
  if (Number.isFinite(minScore)) query = query.gte("overall_score", minScore);
  if (since) query = query.gte("created_at", since);

  const { data, error, count } = await query;
  if (error) {
    console.error("[coach/analyses] list failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate stats over the filtered query (total count from query, plus
  // average score & this-week count via a focused select).
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: statsRows } = await service
    .from("coach_analyses")
    .select("overall_score, created_at, rep_id")
    .eq("user_id", ownerId);

  const rows = statsRows || [];
  const thisWeek = rows.filter((r) => r.created_at >= weekAgo).length;
  const avgScore =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.overall_score || 0), 0) / rows.length,
        )
      : 0;

  // Top performer: highest avg score among reps with >= 3 analyses.
  const repBuckets = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.rep_id) continue;
    const bucket = repBuckets.get(r.rep_id) ?? [];
    bucket.push(r.overall_score || 0);
    repBuckets.set(r.rep_id, bucket);
  }
  let topRepId: string | null = null;
  let topAvg = -1;
  for (const [id, scores] of Array.from(repBuckets.entries())) {
    if (scores.length < 3) continue;
    const avg = scores.reduce((s: number, v: number) => s + v, 0) / scores.length;
    if (avg > topAvg) {
      topAvg = avg;
      topRepId = id;
    }
  }

  return NextResponse.json({
    ok: true,
    analyses: data || [],
    total: count ?? 0,
    stats: {
      total_analyses: rows.length,
      analyses_this_week: thisWeek,
      avg_score: avgScore,
      top_rep_id: topRepId,
      top_rep_score: topRepId ? Math.round(topAvg) : 0,
    },
  });
}
