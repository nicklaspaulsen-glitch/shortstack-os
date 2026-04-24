/**
 * GET /api/manage/project/:id
 *
 * Per-project manage dashboard payload: project info, current health,
 * tasks, open+recent scope flags, weekly reports, latest post-mortem.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;

  // RLS gates access.
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, brief, deadline, status, owner_id, created_at")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [
    healthRes,
    tasksRes,
    flagsRes,
    reportsRes,
    postMortemRes,
  ] = await Promise.all([
    supabase
      .from("project_health_snapshots")
      .select("date, status, reasons, generated_at")
      .eq("project_id", projectId)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, assignee_id, completed_at, created_at")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("scope_creep_flags")
      .select("id, flag_type, description, severity, resolved, created_at, resolved_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("project_weekly_reports")
      .select("id, week_start, status, content, generated_at, sent_at")
      .eq("project_id", projectId)
      .order("week_start", { ascending: false })
      .limit(10),
    supabase
      .from("project_post_mortems")
      .select("id, content, generated_at, generated_by")
      .eq("project_id", projectId)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  return NextResponse.json({
    project,
    latest_health: healthRes.data?.[0] ?? null,
    tasks: tasksRes.data ?? [],
    scope_flags: flagsRes.data ?? [],
    weekly_reports: reportsRes.data ?? [],
    latest_post_mortem: postMortemRes.data?.[0] ?? null,
  });
}
