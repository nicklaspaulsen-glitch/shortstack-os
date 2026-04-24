import { NextRequest, NextResponse } from "next/server";

import { cleanup as cleanupOutputCache } from "@/lib/ai/output-cache";
import { monthlyReset } from "@/lib/ai/budget-gate";

export const maxDuration = 60;

/*
  /api/cron/ai-budget-maintenance
  ───────────────────────────────
  Runs daily at 01:00 UTC. Two jobs:
    1. Expire stale entries from ai_output_cache (7-day TTL).
    2. Reset org_ai_budgets whose reset_date has passed, and lift
       `paused = true` when the pause reason was auto_pause.

  Idempotent — safe to retry.
*/
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const results: Record<string, unknown> = { startedAt };

  try {
    const cacheResult = await cleanupOutputCache();
    results.cacheDeleted = cacheResult.deleted;
  } catch (err) {
    results.cacheError = (err as Error).message;
  }

  try {
    const budgetResult = await monthlyReset();
    results.budgetsReset = budgetResult.reset;
  } catch (err) {
    results.budgetError = (err as Error).message;
  }

  results.finishedAt = new Date().toISOString();
  return NextResponse.json({ success: true, ...results });
}
