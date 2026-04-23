import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * Admin endpoint — returns the latest self-test run's results + a short
 * trend series (last 14 runs) for the dashboard charts.
 *
 * GET /api/admin/self-test/latest
 *   → { latest_run: { run_id, started_at, rows: [...] }, trend: [...] }
 *
 * Gated to role === "admin".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // Auth: must be a signed-in admin.
  const authClient = createServerSupabase();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Find the most-recent run_id.
  const { data: newest } = await service
    .from("self_test_results")
    .select("run_id, run_started_at")
    .order("run_started_at", { ascending: false })
    .limit(1);

  if (!newest || newest.length === 0) {
    return NextResponse.json({
      latest_run: null,
      trend: [],
      note: "No self-test runs recorded yet.",
    });
  }

  const latestRunId = newest[0].run_id;
  const latestStartedAt = newest[0].run_started_at;

  // All rows for the latest run.
  const { data: rows } = await service
    .from("self_test_results")
    .select("*")
    .eq("run_id", latestRunId)
    .order("route_path", { ascending: true });

  // Trend: last 14 distinct runs — pass/fail count per run.
  // Group by run_id using a SQL-friendly approach: fetch last ~600 rows
  // (14 runs × ~40 routes) and bucket in JS.
  const { data: recentRows } = await service
    .from("self_test_results")
    .select("run_id, run_started_at, ok")
    .order("run_started_at", { ascending: false })
    .limit(600);

  const trendMap = new Map<string, { started_at: string; pass: number; fail: number }>();
  for (const r of recentRows || []) {
    const bucket = trendMap.get(r.run_id as string);
    if (bucket) {
      if (r.ok) bucket.pass++; else bucket.fail++;
    } else {
      trendMap.set(r.run_id as string, {
        started_at: r.run_started_at as string,
        pass: r.ok ? 1 : 0,
        fail: r.ok ? 0 : 1,
      });
    }
  }
  const trend = Array.from(trendMap.entries())
    .map(([run_id, v]) => ({ run_id, ...v }))
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 14)
    .reverse();

  return NextResponse.json({
    latest_run: {
      run_id: latestRunId,
      started_at: latestStartedAt,
      rows: rows || [],
      passed: (rows || []).filter((r) => r.ok).length,
      failed: (rows || []).filter((r) => !r.ok).length,
    },
    trend,
  });
}
