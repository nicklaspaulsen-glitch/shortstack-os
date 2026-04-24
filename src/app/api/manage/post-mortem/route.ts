/**
 * POST /api/manage/post-mortem
 * Body: { project_id }
 *
 * Generates a retrospective markdown doc for a completed project.
 * Requires project.status === 'complete'. Writes to project_post_mortems.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendCached, MODEL_SONNET } from "@/lib/ai/claude-client";
import { canManage, getProjectRole } from "@/lib/manage/access";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { project_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!canManage(role)) {
    return NextResponse.json({ error: "Only owners and leads can generate post-mortems" }, { status: 403 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, brief, deadline, status, created_at")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status !== "complete") {
    return NextResponse.json(
      { error: `Project status must be 'complete' (currently '${project.status as string}')` },
      { status: 400 },
    );
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, priority, due_date, completed_at, created_at")
    .eq("project_id", projectId);

  const { data: flags } = await supabase
    .from("scope_creep_flags")
    .select("flag_type, description, severity, resolved")
    .eq("project_id", projectId);

  const { data: healthHistory } = await supabase
    .from("project_health_snapshots")
    .select("date, status")
    .eq("project_id", projectId)
    .order("date", { ascending: true });

  const { data: assets } = await supabase
    .from("project_assets")
    .select("asset_type, added_at")
    .eq("project_id", projectId);

  // Compute simple stats
  const now = Date.now();
  const startMs = new Date((project.created_at as string)).getTime();
  const durationDays = Math.max(1, Math.round((now - startMs) / (24 * 3600 * 1000)));

  const tasksDone = (tasks ?? []).filter((t) => t.status === "done").length;
  const tasksTotal = (tasks ?? []).length;
  const lateTasks = (tasks ?? []).filter(
    (t) => t.status === "done" && t.due_date && t.completed_at &&
      new Date(t.completed_at as string) > new Date(t.due_date as string),
  ).length;

  const healthDays = healthHistory ?? [];
  const redDays = healthDays.filter((h) => h.status === "red").length;
  const yellowDays = healthDays.filter((h) => h.status === "yellow").length;
  const greenDays = healthDays.filter((h) => h.status === "green").length;

  const assetTypeCounts: Record<string, number> = {};
  for (const a of assets ?? []) {
    const k = a.asset_type as string;
    assetTypeCounts[k] = (assetTypeCounts[k] ?? 0) + 1;
  }

  const system = `You are a senior producer writing a post-mortem retrospective for a completed creative-agency project. Output markdown only. Required sections:

# Post-mortem: <project name>

## Overview
One-paragraph summary: what the project was, how long it ran, where it landed.

## What went well
3-6 bullets drawn from the data (tasks shipped, health streaks, assets produced).

## What didn't
3-6 bullets drawn from the data (late tasks, red days, scope flags).

## Time tracking
Short paragraph or bullets with the actual numbers.

## Final deliverables
Short list of asset types produced.

## Lessons for next time
3-5 actionable bullets for the team's future projects.

Keep it candid, specific, and under 550 words. Use the data. Don't invent facts.`;

  const userMsg = `Project: ${project.name as string}
Brief: ${((project.brief as string | null) || "").slice(0, 1200)}
Duration: ~${durationDays} days
Deadline: ${project.deadline ? new Date(project.deadline as string).toISOString().slice(0, 10) : "none set"}

Tasks: ${tasksDone}/${tasksTotal} completed, ${lateTasks} finished late.
Health history: ${greenDays} green / ${yellowDays} yellow / ${redDays} red daily snapshots.
Scope flags: ${(flags ?? []).length} total (${(flags ?? []).filter((f) => f.resolved).length} resolved).

Sample of tasks:
${(tasks ?? []).slice(0, 15).map((t) => `- ${t.title as string} [${t.status as string}]`).join("\n") || "(none)"}

Sample of scope flags:
${(flags ?? []).slice(0, 8).map((f) => `- ${f.flag_type as string} [${f.severity as string}]: ${(f.description as string).slice(0, 120)}`).join("\n") || "(none)"}

Assets produced: ${Object.entries(assetTypeCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "(none tracked)"}`;

  const { text } = await sendCached({
    system,
    messages: [{ role: "user", content: userMsg }],
    model: MODEL_SONNET,
    maxTokens: 2500,
    endpoint: "manage-post-mortem",
    userId: user.id,
  });

  const content = text.trim();
  if (!content) {
    return NextResponse.json({ error: "AI returned empty content" }, { status: 502 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("project_post_mortems")
    .insert({
      project_id: projectId,
      content,
      generated_by: "ai",
    })
    .select()
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    post_mortem: inserted,
    stats: { durationDays, tasksDone, tasksTotal, lateTasks, redDays, yellowDays, greenDays },
  });
}
