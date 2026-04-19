import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Retention worker — prunes log tables to prevent unbounded DB growth.
 *
 * Runs weekly (Sunday 4am) via Vercel cron, authed with CRON_SECRET.
 * Separate from `/api/cron/cleanup-senders` which is an email-domain
 * hygiene job, unrelated to log retention.
 *
 * Keeps:
 *   - system_health_history: last 30 days (was growing ~500/day unchecked)
 *   - trinity_log: last 90 days (audit log — longer window)
 *   - outreach_log: last 180 days (legal/sales history — longest)
 *
 * Trinity_conversations + trinity_messages: kept indefinitely (user content).
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

  const cutoffs = {
    health_30d: new Date(now.getTime() - 30 * 24 * 3600_000).toISOString(),
    log_90d: new Date(now.getTime() - 90 * 24 * 3600_000).toISOString(),
    outreach_180d: new Date(now.getTime() - 180 * 24 * 3600_000).toISOString(),
  };

  const results: Record<string, { deleted: number; error: string | null }> = {};

  // system_health_history — the big one (~500/day growth)
  try {
    const { count: deleted, error } = await supabase
      .from("system_health_history")
      .delete({ count: "exact" })
      .lt("created_at", cutoffs.health_30d);
    results.system_health_history = {
      deleted: deleted ?? 0,
      error: error?.message ?? null,
    };
  } catch (e) {
    results.system_health_history = { deleted: 0, error: String(e) };
  }

  // trinity_log — audit trail
  try {
    const { count: deleted, error } = await supabase
      .from("trinity_log")
      .delete({ count: "exact" })
      .lt("created_at", cutoffs.log_90d);
    results.trinity_log = { deleted: deleted ?? 0, error: error?.message ?? null };
  } catch (e) {
    results.trinity_log = { deleted: 0, error: String(e) };
  }

  // outreach_log — sales history
  try {
    const { count: deleted, error } = await supabase
      .from("outreach_log")
      .delete({ count: "exact" })
      .lt("created_at", cutoffs.outreach_180d);
    results.outreach_log = { deleted: deleted ?? 0, error: error?.message ?? null };
  } catch (e) {
    results.outreach_log = { deleted: 0, error: String(e) };
  }

  const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);

  return NextResponse.json({
    success: true,
    total_deleted: totalDeleted,
    cutoffs,
    per_table: results,
    ran_at: now.toISOString(),
  });
}
