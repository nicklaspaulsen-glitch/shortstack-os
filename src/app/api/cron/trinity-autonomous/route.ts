/**
 * Cron: every hour.
 *
 * For every user whose Trinity mode is shadow OR autopilot:
 *   1) Call proposeActions(userId) to create new candidate proposals.
 *   2) For autopilot users only: pull every proposed action whose
 *      veto_window_until <= now() and call executeAction on it.
 *
 * The existing veto_window_until = NULL pattern (set when mode=shadow)
 * means shadow users only ever see proposals — never auto-executed.
 *
 * Auth: standard CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  proposeActions,
  executeAction,
  type ProposeActionsResult,
  type ExecuteActionResult,
} from "@/lib/trinity/autonomous";

export const maxDuration = 300;

const MAX_USERS_PER_RUN = 100;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: settingsRows, error: settingsErr } = await supabase
    .from("trinity_settings")
    .select("user_id, mode")
    .in("mode", ["shadow", "autopilot"])
    .limit(MAX_USERS_PER_RUN);

  if (settingsErr) {
    console.error("[trinity-autonomous] settings load failed", settingsErr);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }

  const propose: ProposeActionsResult[] = [];
  for (const row of settingsRows ?? []) {
    try {
      const r = await proposeActions(row.user_id as string);
      propose.push(r);
    } catch (err) {
      propose.push({
        userId: row.user_id as string,
        proposed: 0,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // Autopilot pass — execute proposals whose veto window has expired.
  const nowIso = new Date().toISOString();
  const autopilotIds = new Set(
    (settingsRows ?? [])
      .filter((r) => r.mode === "autopilot")
      .map((r) => r.user_id as string),
  );

  const executes: ExecuteActionResult[] = [];
  if (autopilotIds.size > 0) {
    const { data: due } = await supabase
      .from("trinity_actions")
      .select("id, user_id")
      .eq("status", "proposed")
      .not("veto_window_until", "is", null)
      .lte("veto_window_until", nowIso)
      .limit(50);

    for (const row of due ?? []) {
      if (!autopilotIds.has(row.user_id as string)) continue;
      try {
        const r = await executeAction(row.id as string);
        executes.push(r);
      } catch (err) {
        executes.push({
          actionId: row.id as string,
          status: "failed",
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }
  }

  // Mark proposals older than 7 days as expired so the inbox stays clean.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  await supabase
    .from("trinity_actions")
    .update({ status: "expired", updated_at: nowIso })
    .eq("status", "proposed")
    .lt("created_at", sevenDaysAgo);

  return NextResponse.json({
    ok: true,
    users_evaluated: settingsRows?.length ?? 0,
    proposed_total: propose.reduce((acc, r) => acc + r.proposed, 0),
    executed_total: executes.filter((r) => r.status === "executed").length,
    propose,
    executes,
  });
}
