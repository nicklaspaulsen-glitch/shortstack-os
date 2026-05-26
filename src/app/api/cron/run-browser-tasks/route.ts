/**
 * Cron — browser tasks runner.
 *
 * Every minute, picks up queued browser_tasks and runs the agent loop.
 * Caps at 3 concurrent tasks per tick to stay within Vercel function limits
 * (each task can run up to ~5 min = `maxDuration: 300`).
 *
 * Auth: x-vercel-cron header OR `Authorization: Bearer ${CRON_SECRET}`. Fail-
 * closed 503 when CRON_SECRET is unset (matches the inbound-webhook policy
 * in CLAUDE.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runBrowserAgent } from "@/lib/browser-worker/agent-loop";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCURRENT_TASKS = 3;

interface QueuedTask {
  id: string;
  agency_owner_id: string;
  goal: string;
  start_url: string | null;
  max_steps: number;
}

export async function GET(request: NextRequest) {
  // Fail-closed when CRON_SECRET isn't configured.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization");
  const rawToken = auth?.replace(/\^Bearer\\s+/i, "") ?? "";
  const hasBearer = !!process.env.CRON_SECRET && secureCompare(rawToken, process.env.CRON_SECRET);
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: tasks, error } = await supabase
    .from("browser_tasks")
    .select("id, agency_owner_id, goal, start_url, max_steps")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_CONCURRENT_TASKS);

  if (error) {
    console.error("[run-browser-tasks] query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = (tasks ?? []) as QueuedTask[];
  if (queue.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Run in parallel — each call updates the row's status to running on entry
  // and the final state on exit, so concurrent ticks can pick up other tasks
  // without colliding on this batch.
  const results = await Promise.allSettled(
    queue.map((t) =>
      runBrowserAgent({
        goal: t.goal,
        startUrl: t.start_url ?? undefined,
        maxSteps: t.max_steps,
        agencyOwnerId: t.agency_owner_id,
        taskId: t.id,
      }),
    ),
  );

  let completed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.status === "completed") completed++;
    else failed++;
  }

  return NextResponse.json({
    processed: queue.length,
    completed,
    failed,
  });
}
