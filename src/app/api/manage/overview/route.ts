/**
 * GET /api/manage/overview
 *
 * Returns one row per active project visible to the caller, with health
 * badge, open scope-flag count, overdue-task count, last weekly-report
 * status. Used by /dashboard/manage/overview.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // RLS limits projects to those the caller is a member/owner of.
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, deadline, status")
    .eq("status", "active")
    .order("deadline", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return NextResponse.json({ projects: [] });

  // Latest health snapshot per project (one query, client-side group).
  const { data: healthRows } = await supabase
    .from("project_health_snapshots")
    .select("project_id, status, generated_at, date")
    .in("project_id", ids)
    .order("date", { ascending: false });
  const latestHealth = new Map<string, { status: "red"|"yellow"|"green"; generated_at: string }>();
  for (const h of healthRows ?? []) {
    const pid = h.project_id as string;
    if (latestHealth.has(pid)) continue;
    latestHealth.set(pid, {
      status: h.status as "red"|"yellow"|"green",
      generated_at: h.generated_at as string,
    });
  }

  // Open scope-flag counts
  const { data: flagRows } = await supabase
    .from("scope_creep_flags")
    .select("project_id")
    .in("project_id", ids)
    .eq("resolved", false);
  const flagCounts = new Map<string, number>();
  for (const f of flagRows ?? []) {
    const pid = f.project_id as string;
    flagCounts.set(pid, (flagCounts.get(pid) ?? 0) + 1);
  }

  // Overdue task counts
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("project_id")
    .in("project_id", ids)
    .in("status", ["todo", "in_progress", "review"])
    .lt("due_date", today);
  const taskCounts = new Map<string, number>();
  for (const t of taskRows ?? []) {
    const pid = t.project_id as string;
    taskCounts.set(pid, (taskCounts.get(pid) ?? 0) + 1);
  }

  // Last weekly report status
  const { data: reportRows } = await supabase
    .from("project_weekly_reports")
    .select("project_id, status, generated_at, week_start")
    .in("project_id", ids)
    .order("generated_at", { ascending: false });
  const lastReport = new Map<string, "draft"|"sent"|"skipped">();
  for (const r of reportRows ?? []) {
    const pid = r.project_id as string;
    if (lastReport.has(pid)) continue;
    lastReport.set(pid, r.status as "draft"|"sent"|"skipped");
  }

  const result = (projects ?? []).map((p) => {
    const h = latestHealth.get(p.id as string);
    return {
      id: p.id,
      name: p.name,
      deadline: p.deadline,
      health_status: h?.status ?? null,
      health_generated_at: h?.generated_at ?? null,
      open_scope_flags: flagCounts.get(p.id as string) ?? 0,
      overdue_tasks: taskCounts.get(p.id as string) ?? 0,
      last_report_status: lastReport.get(p.id as string) ?? null,
    };
  });

  return NextResponse.json({ projects: result });
}
