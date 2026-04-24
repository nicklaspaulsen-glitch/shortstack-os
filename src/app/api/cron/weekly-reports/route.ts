/**
 * GET /api/cron/weekly-reports  (Vercel cron, Monday 9am UTC)
 *
 * For each active project, generates a status-email draft. Drafts land in
 * project_weekly_reports with status='draft'. A human approves + sends
 * through the UI (NOT auto-sent).
 *
 * Composition signals:
 *   - latest health snapshot
 *   - tasks completed in last 7 days
 *   - tasks due next 7 days
 *   - open scope flags
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCached, MODEL_SONNET } from "@/lib/ai/claude-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function startOfIsoWeekUTC(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay() || 7; // 1..7, Monday=1
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

async function fetchContext(supabase: SupabaseClient, projectId: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: completed } = await supabase
    .from("tasks")
    .select("title, completed_at, priority")
    .eq("project_id", projectId)
    .eq("status", "done")
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(20);

  const { data: upcoming } = await supabase
    .from("tasks")
    .select("title, due_date, status, priority")
    .eq("project_id", projectId)
    .in("status", ["todo", "in_progress", "review"])
    .lte("due_date", until)
    .order("due_date", { ascending: true })
    .limit(20);

  const { data: flags } = await supabase
    .from("scope_creep_flags")
    .select("flag_type, description, severity")
    .eq("project_id", projectId)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: health } = await supabase
    .from("project_health_snapshots")
    .select("status, reasons, date")
    .eq("project_id", projectId)
    .order("date", { ascending: false })
    .limit(1);

  return {
    completed: completed ?? [],
    upcoming: upcoming ?? [],
    flags: flags ?? [],
    health: health?.[0] ?? null,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const weekStart = startOfIsoWeekUTC(new Date());

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, brief, deadline")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let drafted = 0;
  let skipped = 0;

  for (const project of projects ?? []) {
    // Skip if we already drafted a report this week.
    const { data: existing } = await supabase
      .from("project_weekly_reports")
      .select("id")
      .eq("project_id", project.id as string)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    const ctx = await fetchContext(supabase, project.id as string);

    const system = `You are a senior account manager at a creative agency. Draft a weekly status email for the client. Warm, concise, confident. Plain text (use line breaks, no markdown). 180-260 words. Structure:
1. Friendly greeting + one-line state of the project.
2. "This week we shipped:" 3-6 bullets (• prefix).
3. "Coming up next week:" 2-4 bullets.
4. If any scope flags or risks, one tactful sentence flagging them.
5. Sign off with a single CTA (e.g. "Let me know if you'd like to jump on a quick call.").`;

    const userMsg = `Project: ${project.name as string}
Brief (context only, do not quote): ${((project.brief as string | null) || "").slice(0, 600)}
Deadline: ${project.deadline ? new Date(project.deadline as string).toISOString().slice(0, 10) : "not set"}
Health: ${ctx.health ? (ctx.health.status as string) : "unknown"}

Completed this week (${ctx.completed.length}):
${ctx.completed.map((t) => `- ${t.title as string}`).join("\n") || "(none)"}

Upcoming next week (${ctx.upcoming.length}):
${ctx.upcoming.map((t) => `- ${t.title as string} (due ${t.due_date as string})`).join("\n") || "(none)"}

Open scope flags (${ctx.flags.length}):
${ctx.flags.map((f) => `- ${f.flag_type as string} [${f.severity as string}]: ${f.description as string}`).join("\n") || "(none)"}`;

    let content = "";
    try {
      const { text } = await sendCached({
        system,
        messages: [{ role: "user", content: userMsg }],
        model: MODEL_SONNET,
        maxTokens: 1000,
        endpoint: "cron-weekly-reports",
      });
      content = text.trim();
    } catch {
      skipped++;
      continue;
    }
    if (!content) { skipped++; continue; }

    const { error: insErr } = await supabase
      .from("project_weekly_reports")
      .insert({
        project_id: project.id,
        week_start: weekStart,
        content,
        status: "draft",
      });
    if (!insErr) drafted++;
  }

  return NextResponse.json({
    success: true,
    week_start: weekStart,
    drafts_created: drafted,
    skipped,
  });
}
