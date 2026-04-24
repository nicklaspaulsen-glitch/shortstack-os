/**
 * GET /api/cron/project-health  (Vercel cron, daily 2am UTC)
 *
 * Computes red/yellow/green for each active project. Uses four signals:
 *   1. days past deadline (weight: HIGH)
 *   2. unresponded messages (weight: MEDIUM)
 *   3. overdue tasks count (weight: MEDIUM)
 *   4. open scope-creep flags count (weight: MEDIUM)
 *
 * Writes to project_health_snapshots with UNIQUE(project_id, date).
 * Non-green snapshots get a short Claude-generated narrative reason code.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCached, MODEL_HAIKU } from "@/lib/ai/claude-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Reason {
  code: string;
  detail: string;
  narrative?: string;
}

async function countOverdueTasks(
  supabase: SupabaseClient,
  projectId: string,
  today: string,
): Promise<number> {
  const { count } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("status", ["todo", "in_progress", "review"])
    .lt("due_date", today);
  return count ?? 0;
}

async function countOpenScopeFlags(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { count } = await supabase
    .from("scope_creep_flags")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("resolved", false);
  return count ?? 0;
}

async function countUnrespondedMessages(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  // Best-effort: look for client-side messages in last 48h with no staff reply.
  // Silent if table missing/mismatched.
  try {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("portal_messages")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("sender_role", "client")
      .is("replied_at", null)
      .gte("created_at", since);
    return count ?? 0;
  } catch {
    return 0;
  }
}

function scoreStatus(reasons: Reason[], daysPastDeadline: number): "red" | "yellow" | "green" {
  // Any red-trigger → red; any yellow-trigger → yellow; else green.
  if (daysPastDeadline >= 7) return "red";
  if (reasons.some((r) => r.code === "critical")) return "red";
  if (daysPastDeadline > 0) return "yellow";
  if (reasons.length >= 1) return "yellow";
  return "green";
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, brief, deadline, status")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let written = 0;
  for (const project of projects ?? []) {
    const reasons: Reason[] = [];

    let daysPastDeadline = 0;
    if (project.deadline) {
      const deadlineMs = new Date(project.deadline as string).getTime();
      const diff = Date.now() - deadlineMs;
      daysPastDeadline = Math.max(0, Math.floor(diff / (24 * 3600 * 1000)));
      if (daysPastDeadline >= 7) {
        reasons.push({ code: "critical", detail: `${daysPastDeadline}d past deadline` });
      } else if (daysPastDeadline > 0) {
        reasons.push({ code: "overdue_project", detail: `${daysPastDeadline}d past deadline` });
      }
    }

    const overdueTasks = await countOverdueTasks(supabase, project.id as string, today);
    if (overdueTasks >= 5) {
      reasons.push({ code: "critical", detail: `${overdueTasks} overdue tasks` });
    } else if (overdueTasks > 0) {
      reasons.push({ code: "overdue_tasks", detail: `${overdueTasks} overdue task(s)` });
    }

    const openFlags = await countOpenScopeFlags(supabase, project.id as string);
    if (openFlags >= 3) {
      reasons.push({ code: "scope_creep", detail: `${openFlags} open scope flags` });
    } else if (openFlags > 0) {
      reasons.push({ code: "scope_creep_minor", detail: `${openFlags} scope flag(s)` });
    }

    const unresponded = await countUnrespondedMessages(supabase, project.id as string);
    if (unresponded > 0) {
      reasons.push({ code: "unresponded_messages", detail: `${unresponded} client message(s) unanswered >48h` });
    }

    const status = scoreStatus(reasons, daysPastDeadline);

    // Narrative only if non-green.
    if (status !== "green" && reasons.length > 0) {
      try {
        const summary = reasons.map((r) => `${r.code}: ${r.detail}`).join("; ");
        const { text } = await sendCached({
          system: "You are a project-management assistant. Given a list of health-issue codes for a creative project, write ONE short sentence (max 30 words) explaining the situation to the project lead. Plain text, no markdown.",
          messages: [{ role: "user", content: `Project: ${project.name as string}\nIssues: ${summary}` }],
          model: MODEL_HAIKU,
          maxTokens: 120,
          endpoint: "cron-project-health",
        });
        const narrative = text.trim().slice(0, 400);
        for (const r of reasons) r.narrative = narrative;
      } catch {
        // non-fatal
      }
    }

    const { error: upErr } = await supabase
      .from("project_health_snapshots")
      .upsert(
        {
          project_id: project.id,
          date: today,
          status,
          reasons,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,date" },
      );
    if (!upErr) written++;
  }

  return NextResponse.json({
    success: true,
    projects_scored: projects?.length ?? 0,
    snapshots_written: written,
  });
}
