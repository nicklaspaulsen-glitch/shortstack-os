/**
 * Multi-channel sequence runner (cron).
 *
 * Runs every minute. Picks active sequence_runs whose `next_action_at` is due,
 * executes the current step via the engine, and advances. Capped at
 * `RUNS_PER_TICK_CAP` to keep Twilio/Resend/Claude costs predictable.
 *
 * Auth: Vercel Cron sets `x-vercel-cron`. Manual runs need
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * This is a separate route from `/api/cron/run-sequences` (the legacy
 * day-based runner). The new runner only touches `sequence_runs`; it
 * leaves `sequence_enrollments` alone.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executeStep, RUNS_PER_TICK_CAP } from "@/lib/sequences/engine";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RunSlim {
  id: string;
  sequence_id: string;
  next_action_at: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const hasBearer =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("sequence_runs")
    .select("id, sequence_id, next_action_at")
    .eq("status", "active")
    .lte("next_action_at", nowIso)
    .order("next_action_at", { ascending: true })
    .limit(RUNS_PER_TICK_CAP);

  if (error) {
    console.error("[cron/sequence-runner] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runs = (data || []) as RunSlim[];
  if (runs.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      cap: RUNS_PER_TICK_CAP,
      timestamp: nowIso,
    });
  }

  let advanced = 0;
  let completed = 0;
  let exited = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Sequential — keeps Twilio + Resend rate-limit windows happy and the
  // RUNS_PER_TICK_CAP gives us a predictable upper bound on per-tick latency.
  for (const run of runs) {
    try {
      const result = await executeStep(supabase, run.id);
      if (result.status === "advanced") advanced++;
      else if (result.status === "completed") completed++;
      else if (result.status === "exited") exited++;
      else if (result.status === "failed") {
        failed++;
        if (result.note) errors.push(`${run.id}: ${result.note}`);
      } else if (result.status === "skipped" || result.status === "paused") {
        skipped++;
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${run.id}: ${msg}`);
      console.error(`[cron/sequence-runner] run ${run.id} threw:`, msg);
    }
  }

  return NextResponse.json({
    success: true,
    processed: runs.length,
    advanced,
    completed,
    exited,
    failed,
    skipped,
    cap: RUNS_PER_TICK_CAP,
    errors: errors.slice(0, 20),
    timestamp: nowIso,
  });
}
