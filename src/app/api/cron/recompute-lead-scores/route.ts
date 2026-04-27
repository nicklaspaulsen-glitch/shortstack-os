import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllForUser } from "@/lib/leads/score-recompute";

export const maxDuration = 300;

/**
 * GET /api/cron/recompute-lead-scores
 *
 * Hourly job. For each agency owner that has at least one lead, recompute the
 * top-100 most-stale leads. Each per-owner run is bounded by the same token
 * budget guard (default $1) to keep costs predictable.
 *
 * Auth: must be invoked with `Authorization: Bearer ${CRON_SECRET}`. Vercel's
 * cron runner sets this for us.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find owners with stale-or-unscored leads. We collect distinct user_ids
  // that have at least one lead with score_updated_at older than 1h.
  const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("leads")
    .select("user_id")
    .or(`score_updated_at.is.null,score_updated_at.lt.${cutoffIso}`)
    .limit(1000);

  if (error) {
    console.error("[cron/recompute-lead-scores] select failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ownerIds = Array.from(
    new Set((rows ?? []).map((r) => r.user_id as string)),
  );

  const summary: Array<{
    user_id: string;
    processed: number;
    skipped: number;
    errors: number;
    durationMs: number;
  }> = [];

  for (const userId of ownerIds) {
    try {
      const result = await recomputeAllForUser(supabase, userId, {
        maxLeads: 100,
        maxCostUsd: 1.0,
        staleMinutes: 60,
        context: "/api/cron/recompute-lead-scores",
      });
      summary.push({ user_id: userId, ...result });
    } catch (err) {
      console.error(
        "[cron/recompute-lead-scores] owner failed",
        userId,
        err,
      );
      summary.push({
        user_id: userId,
        processed: 0,
        skipped: 0,
        errors: 1,
        durationMs: 0,
      });
    }
  }

  const totals = summary.reduce(
    (acc, s) => ({
      processed: acc.processed + s.processed,
      skipped: acc.skipped + s.skipped,
      errors: acc.errors + s.errors,
    }),
    { processed: 0, skipped: 0, errors: 0 },
  );

  return NextResponse.json({
    success: true,
    owners: summary.length,
    ...totals,
    timestamp: new Date().toISOString(),
  });
}
