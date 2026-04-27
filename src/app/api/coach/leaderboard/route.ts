/**
 * GET /api/coach/leaderboard?period=week|month|all
 *
 * Leaderboard of reps in this agency by avg coach-analysis score over the
 * chosen period. Reps with fewer than 3 analyses in the window are dropped
 * to avoid noisy outliers.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const PERIOD_TO_DAYS: Record<string, number | null> = {
  week: 7,
  month: 30,
  quarter: 90,
  all: null,
};

const MIN_ANALYSES_PER_REP = 3;

interface LeaderboardRow {
  rep_id: string;
  rep_name: string | null;
  rep_email: string | null;
  analyses_count: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
}

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
  const periodParam = (searchParams.get("period") || "week").toLowerCase();
  const days = PERIOD_TO_DAYS[periodParam] ?? 7;

  const service = createServiceClient();

  let query = service
    .from("coach_analyses")
    .select("rep_id, overall_score, created_at")
    .eq("user_id", ownerId)
    .not("rep_id", "is", null);

  if (days !== null) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<string, number[]>();
  for (const row of data || []) {
    if (!row.rep_id) continue;
    const arr = buckets.get(row.rep_id) ?? [];
    arr.push(row.overall_score ?? 0);
    buckets.set(row.rep_id, arr);
  }

  const repIds = Array.from(buckets.keys());
  let names: Record<string, { full_name: string | null; email: string | null }> = {};
  if (repIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, email")
      .in("id", repIds);
    for (const p of profiles || []) {
      names[p.id] = { full_name: p.full_name, email: p.email };
    }
  }

  const leaderboard: LeaderboardRow[] = [];
  for (const [repId, scores] of Array.from(buckets.entries())) {
    if (scores.length < MIN_ANALYSES_PER_REP) continue;
    const sum = scores.reduce((s: number, v: number) => s + v, 0);
    leaderboard.push({
      rep_id: repId,
      rep_name: names[repId]?.full_name ?? null,
      rep_email: names[repId]?.email ?? null,
      analyses_count: scores.length,
      avg_score: Math.round(sum / scores.length),
      best_score: Math.max(...scores),
      worst_score: Math.min(...scores),
    });
  }

  leaderboard.sort((a, b) => b.avg_score - a.avg_score);

  return NextResponse.json({
    ok: true,
    period: periodParam,
    leaderboard,
    total_reps: leaderboard.length,
  });
}
