/**
 * POST /api/manage/kickoff
 * Body: { project_id }
 *
 * AI Project Kickoff — reads a project's brief, generates a task
 * breakdown + suggested timeline + initial team slots. Tasks are written
 * to `tasks` (status='todo'). Returns the generated plan.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendCached, MODEL_SONNET } from "@/lib/ai/claude-client";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import { canManage, getProjectRole } from "@/lib/manage/access";

export const maxDuration = 60;

interface KickoffPlan {
  tasks: Array<{
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    due_offset_days?: number; // days from today
  }>;
  timeline: {
    total_days: number;
    milestones: Array<{ name: string; day: number }>;
  };
  team_slots: Array<{ role: string; skills: string[]; rationale?: string }>;
}

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
    return NextResponse.json({ error: "Only owners and leads can kickoff" }, { status: 403 });
  }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, brief, deadline, status")
    .eq("id", projectId)
    .single();
  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const brief = (project.brief as string | null) || "No brief provided.";
  const deadlineStr = project.deadline
    ? new Date(project.deadline as string).toISOString().slice(0, 10)
    : "No deadline set.";

  const system = `You are a senior creative-agency producer. Given a project brief, you produce a kickoff plan as strict JSON. Output ONLY JSON, no prose, no code fences.

Required shape:
{
  "tasks": [{"title": string, "description": string, "priority": "low|medium|high|urgent", "due_offset_days": number}],
  "timeline": {"total_days": number, "milestones": [{"name": string, "day": number}]},
  "team_slots": [{"role": string, "skills": string[], "rationale": string}]
}

Rules: 5-12 tasks. Milestones must fall within total_days. due_offset_days must be >= 0 and <= total_days.`;

  const userMsg = `Project: ${project.name as string}
Deadline: ${deadlineStr}

Brief:
${brief}`;

  const { text } = await sendCached({
    system,
    messages: [{ role: "user", content: userMsg }],
    model: MODEL_SONNET,
    maxTokens: 2000,
    endpoint: "manage-kickoff",
    userId: user.id,
  });

  const plan = safeJsonParse<KickoffPlan>(text);
  if (!plan || !Array.isArray(plan.tasks)) {
    return NextResponse.json(
      { error: "AI returned malformed plan", raw: text.slice(0, 500) },
      { status: 502 },
    );
  }

  // Write tasks
  const today = new Date();
  const tasksToInsert = plan.tasks
    .filter((t) => t && typeof t.title === "string" && t.title.trim().length > 0)
    .map((t) => {
      const offset = Math.max(0, Math.floor(Number(t.due_offset_days) || 7));
      const due = new Date(today);
      due.setDate(due.getDate() + offset);
      return {
        project_id: projectId,
        title: t.title.trim().slice(0, 240),
        description: typeof t.description === "string" ? t.description : null,
        priority: ["low", "medium", "high", "urgent"].includes(t.priority || "")
          ? t.priority
          : "medium",
        due_date: due.toISOString().slice(0, 10),
        status: "todo" as const,
      };
    });

  let insertedCount = 0;
  if (tasksToInsert.length > 0) {
    const { count, error: insErr } = await supabase
      .from("tasks")
      .insert(tasksToInsert, { count: "exact" });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    insertedCount = count ?? tasksToInsert.length;
  }

  return NextResponse.json({
    success: true,
    tasks_created: insertedCount,
    plan,
  });
}
