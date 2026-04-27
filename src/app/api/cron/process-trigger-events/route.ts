/**
 * Trigger Event Processor (Cron)
 *
 * Drains the `trigger_events` queue: for every `pending` row, fan out via
 * `fireTrigger` (workflows + crm_automations dispatch). On success the row
 * flips to `completed`, on failure to `failed` with `error_text` set.
 *
 * The queue is the *durable* alternative to in-process `fireTrigger()` — when
 * a route writes to `trigger_events` we can be sure the action eventually
 * runs, even if the originating request died before fan-out completed.
 *
 * Schedule: every minute (`* * * * *`) via vercel.json crons.
 *
 * Auth: Bearer ${CRON_SECRET}, same pattern as every other cron route.
 *
 * Idempotence: each row is moved to `processing` before fan-out. If the cron
 * dies mid-flight, the row stays in `processing` and a daily cleanup can
 * re-queue it. We don't retry within the same cron run — keep the dispatcher
 * simple, let the scheduler give us the next tick.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger, TriggerType } from "@/lib/workflows/trigger-dispatch";

export const maxDuration = 60;

// Cap how many events we drain in one run so a backlog never wedges the cron.
const BATCH_SIZE = 25;

interface QueueRow {
  id: string;
  user_id: string;
  trigger_type: string;
  source_table: string | null;
  source_id: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from("trigger_events")
    .select("id, user_id, trigger_type, source_table, source_id, payload, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[process-trigger-events] load failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = (rows || []) as QueueRow[];
  if (queue.length === 0) {
    return NextResponse.json({ processed: 0, completed: 0, failed: 0 });
  }

  // Lock the batch as `processing`.
  const ids = queue.map((q) => q.id);
  await supabase
    .from("trigger_events")
    .update({ status: "processing", attempts: 0 })
    .in("id", ids);

  let completed = 0;
  let failed = 0;

  for (const row of queue) {
    try {
      const result = await fireTrigger({
        supabase,
        userId: row.user_id,
        triggerType: row.trigger_type as TriggerType,
        payload: row.payload || {},
      });
      await supabase
        .from("trigger_events")
        .update({
          status: "completed",
          attempts: row.attempts + 1,
          processed_at: new Date().toISOString(),
          error_text: result.matched === 0 ? null : null,
        })
        .eq("id", row.id);
      completed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("trigger_events")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          processed_at: new Date().toISOString(),
          error_text: msg.slice(0, 1000),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return NextResponse.json({
    processed: queue.length,
    completed,
    failed,
  });
}
