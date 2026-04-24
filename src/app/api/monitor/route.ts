import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/monitor
 * Aggregates system_health, trinity_log, and agent_runs into a single
 * monitor payload. Admin-only.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const oneDayAgo = new Date(now - 86_400_000).toISOString();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();

  const [
    { data: health },
    { count: actions24h },
    { count: actions7d },
    { count: failed24h },
    { data: trinitySample },
    { count: runs24h },
    { count: success24h },
    { count: agentFailed24h },
    { count: running },
  ] = await Promise.all([
    supabase
      .from("system_health")
      .select("integration_name, status, response_time_ms, uptime_percentage, last_check_at")
      .order("integration_name", { ascending: true }),
    supabase
      .from("trinity_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneDayAgo),
    supabase
      .from("trinity_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekAgo),
    supabase
      .from("trinity_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "failed")
      .gte("created_at", oneDayAgo),
    supabase
      .from("trinity_log")
      .select("action_type, started_at, completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", oneDayAgo),
    supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "success")
      .gte("started_at", oneDayAgo),
    supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "failed")
      .gte("started_at", oneDayAgo),
    supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "running"),
  ]);

  const counts = { healthy: 0, degraded: 0, down: 0, unknown: 0 };
  (health || []).forEach((h) => {
    const s = h.status as keyof typeof counts;
    if (s in counts) counts[s]++;
    else counts.unknown++;
  });

  const durations = (trinitySample || [])
    .map((r) => {
      const s = r.started_at ? new Date(r.started_at).getTime() : 0;
      const e = r.completed_at ? new Date(r.completed_at).getTime() : 0;
      const ms = e - s;
      return ms > 0 ? { action_type: (r.action_type as string) || "unknown", ms, started_at: r.started_at as string } : null;
    })
    .filter(Boolean) as Array<{ action_type: string; ms: number; started_at: string }>;

  const avgMs = durations.length === 0
    ? 0
    : Math.round(durations.reduce((s, d) => s + d.ms, 0) / durations.length);

  const slowest = [...durations].sort((a, b) => b.ms - a.ms).slice(0, 10);

  return NextResponse.json({
    health: health || [],
    counts,
    trinity: {
      actions_24h: actions24h || 0,
      actions_7d: actions7d || 0,
      failed_24h: failed24h || 0,
      avg_duration_ms: avgMs,
      slowest,
    },
    agents: {
      runs_24h: runs24h || 0,
      success_24h: success24h || 0,
      failed_24h: agentFailed24h || 0,
      running: running || 0,
    },
  });
}
