/**
 * POST /api/manage/delegate
 * Body: { task_id }
 *
 * Suggests the best team member for a task. Does NOT auto-assign —
 * the UI surfaces the suggestion + confidence score and a human confirms.
 *
 * Ranking formula:
 *   score = 0.55 * skill_match
 *         + 0.25 * (1 - workload)
 *         + 0.20 * recent_performance
 *
 * recent_performance = done_tasks_30d / (done_tasks_30d + missed_due_30d + 1)
 * (so a member with 0 done / 0 missed gets a neutral 0.0; 10/0 approaches 1.0)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManage, getProjectRole } from "@/lib/manage/access";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[\s,;/|]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function skillMatch(reqTokens: string[], skills: string[]): number {
  if (reqTokens.length === 0) return 0;
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  let hits = 0;
  for (const tok of reqTokens) {
    if (skillSet.has(tok)) { hits++; continue; }
    for (const sk of Array.from(skillSet)) {
      if (sk.includes(tok) || tok.includes(sk)) { hits++; break; }
    }
  }
  return hits / reqTokens.length;
}

async function fetchCandidateIds(
  supabase: SupabaseClient,
  projectId: string,
): Promise<string[]> {
  const ids = new Set<string>();
  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  if (proj?.owner_id) ids.add(proj.owner_id as string);
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .in("role", ["lead", "contributor", "freelancer"]);
  for (const m of members ?? []) ids.add(m.user_id as string);
  return Array.from(ids);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { task_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const taskId = typeof body.task_id === "string" ? body.task_id : "";
  if (!taskId) {
    return NextResponse.json({ error: "task_id is required" }, { status: 400 });
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, title, description, priority")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const role = await getProjectRole(supabase, task.project_id as string, user.id);
  if (!canManage(role)) {
    return NextResponse.json({ error: "Only owners and leads can delegate" }, { status: 403 });
  }

  const candidateIds = await fetchCandidateIds(supabase, task.project_id as string);
  if (candidateIds.length === 0) {
    return NextResponse.json({ success: true, suggestion: null, candidates: [] });
  }

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email, skills")
    .in("id", candidateIds);

  // Open tasks per candidate
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("assignee_id")
    .in("assignee_id", candidateIds)
    .in("status", ["todo", "in_progress", "review"]);
  const openMap = new Map<string, number>();
  for (const t of openTasks ?? []) {
    const id = t.assignee_id as string | null;
    if (!id) continue;
    openMap.set(id, (openMap.get(id) ?? 0) + 1);
  }
  const maxLoad = Math.max(1, ...Array.from(openMap.values()));

  // Recent performance: done tasks in last 30d with completed_at, vs missed tasks
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: doneTasks } = await supabase
    .from("tasks")
    .select("assignee_id, status, due_date, completed_at")
    .in("assignee_id", candidateIds)
    .gte("completed_at", since);
  const doneMap = new Map<string, number>();
  const missedMap = new Map<string, number>();
  for (const t of doneTasks ?? []) {
    const id = t.assignee_id as string | null;
    if (!id) continue;
    if (t.status === "done") {
      doneMap.set(id, (doneMap.get(id) ?? 0) + 1);
      if (t.due_date && t.completed_at && new Date(t.completed_at as string) > new Date(t.due_date as string)) {
        missedMap.set(id, (missedMap.get(id) ?? 0) + 1);
      }
    }
  }

  const titleText = `${(task.title as string) || ""} ${(task.description as string | null) || ""}`;
  const reqTokens = tokens(titleText);

  const ranked = (profs ?? []).map((p) => {
    const skills = Array.isArray(p.skills) ? (p.skills as string[]) : [];
    const sm = skillMatch(reqTokens, skills);
    const open = openMap.get(p.id as string) ?? 0;
    const wl = open / maxLoad;
    const done = doneMap.get(p.id as string) ?? 0;
    const missed = missedMap.get(p.id as string) ?? 0;
    const perf = done / (done + missed + 1);
    const score = 0.55 * sm + 0.25 * (1 - wl) + 0.20 * perf;
    return {
      user_id: p.id as string,
      name: ((p.full_name as string | null) || (p.email as string | null) || "Unknown"),
      skill_match: Number(sm.toFixed(3)),
      open_tasks: open,
      workload_score: Number(wl.toFixed(3)),
      recent_performance: Number(perf.toFixed(3)),
      confidence: Number(score.toFixed(3)),
    };
  }).sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    success: true,
    task: { id: task.id, title: task.title, project_id: task.project_id },
    suggestion: ranked[0] ?? null,
    candidates: ranked.slice(0, 10),
  });
}
