import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  publishCalendarRow,
  sendTelegramDigest,
  type CalendarRow,
  type PublishOutcome,
} from "@/lib/content-publish";

export const maxDuration = 60;

/**
 * Vercel cron — runs every 5 minutes.
 *   vercel.json: { "path": "/api/cron/publish-scheduled", "schedule": "*\u002F5 * * * *" }
 *
 * Scans content_calendar for rows that:
 *   - are approved_for_publish (user hit the big "Approve all" button), OR
 *   - were already marked `scheduled` by legacy flows (kept for back-compat)
 *   - have scheduled_at due now (plus a 1h grace window so we pick up anything
 *     that missed a tick — anything older is considered stale and skipped)
 *
 * Pseudocode from Phase 3 spec:
 *   1. fetch due rows
 *   2. for each, find connected social account, hit /api/social/post
 *   3. update row: posted + live_url, or failed + error
 *   4. send telegram digest
 *
 * Auth: only accepts requests bearing `Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Only pick up rows the user has explicitly approved. Rows in `scheduled`
  // are still awaiting human review — the user must hit "Approve all" (or
  // approve each individually) before we ever auto-post. This keeps consent
  // explicit.
  const { data: rows, error } = await supabase
    .from("content_calendar")
    .select("id, client_id, title, platform, scheduled_at, status, notes, metadata")
    .in("status", ["approved_for_publish"])
    .lte("scheduled_at", nowIso)
    .gte("scheduled_at", oneHourAgo)
    .order("scheduled_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: PublishOutcome[] = [];
  for (const row of (rows || []) as CalendarRow[]) {
    const outcome = await publishCalendarRow(supabase, row);
    results.push(outcome);
  }

  const posted = results.filter(r => r.status === "posted");
  const failed = results.filter(r => r.status === "failed");
  const needsConn = results.filter(r => r.status === "needs_connection");

  // Upcoming-today count for the digest
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const { count: upcomingToday } = await supabase
    .from("content_calendar")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved_for_publish", "scheduled"])
    .gt("scheduled_at", nowIso)
    .lte("scheduled_at", endOfDay.toISOString());

  const platformList = (outs: PublishOutcome[]) => {
    const seen: Record<string, true> = {};
    const out: string[] = [];
    for (const o of outs) {
      const key = o.platform.replace(/_reels|_video|_shorts/, "");
      if (!seen[key]) { seen[key] = true; out.push(key); }
    }
    return out.join(", ");
  };

  // Telegram digest — only send when there's activity
  if (results.length > 0 || (failed.length + needsConn.length) > 0) {
    const lines = [
      "*Trinity Publish Worker* — just now",
      `Posted: ${posted.length}${posted.length ? ` (${platformList(posted)})` : ""}`,
    ];
    if (failed.length) {
      const firstErr = (failed[0] as { error?: string }).error || "unknown";
      lines.push(`Failed: ${failed.length} — ${platformList(failed)} — ${firstErr.substring(0, 80)}`);
    }
    if (needsConn.length) {
      lines.push(`Needs connection: ${needsConn.length} (${platformList(needsConn)})`);
    }
    lines.push(`Scheduled: ${upcomingToday || 0} upcoming today`);
    await sendTelegramDigest(lines.join("\n"));
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    posted: posted.length,
    failed: failed.length,
    needs_connection: needsConn.length,
    upcoming_today: upcomingToday || 0,
    results,
  });
}
