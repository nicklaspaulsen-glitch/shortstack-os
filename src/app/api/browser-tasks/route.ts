/**
 * Browser Worker — task collection endpoint.
 *
 *   GET  /api/browser-tasks              — list tasks for the caller's agency
 *   POST /api/browser-tasks              — create + queue a new task
 *
 * Tasks always run via the cron runner (`/api/cron/run-browser-tasks`) which
 * tick-processes queued rows. Inline kickoff is not done here because
 * Playwright launch is heavy and we want HTTP responses to stay <200ms.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { renderGoalTemplate } from "@/lib/browser-worker/starter-templates";
import { STEP_CEILING, DEFAULT_MAX_STEPS } from "@/lib/browser-worker/agent-loop";

export const dynamic = "force-dynamic";

interface CreateTaskBody {
  goal?: unknown;
  start_url?: unknown;
  schedule_kind?: unknown;
  schedule_cron?: unknown;
  max_steps?: unknown;
  run_mode?: unknown;
  template_id?: unknown;
  template_values?: unknown;
}

const VALID_SCHEDULE_KINDS = new Set(["one_off", "daily", "weekly", "monthly", "on_event"]);
const VALID_RUN_MODES = new Set(["local_headless", "browserbase"]);

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase
    .from("browser_tasks")
    .select(
      "id, goal, start_url, status, steps_taken, max_steps, total_cost_usd, run_mode, schedule_kind, schedule_cron, started_at, completed_at, created_at, error_message",
    )
    .eq("agency_owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: CreateTaskBody;
  try {
    body = (await request.json()) as CreateTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve goal — either direct text, or a template + values mustache-render.
  let goal: string;
  let startUrl: string | null = null;
  let maxSteps = DEFAULT_MAX_STEPS;

  if (typeof body.template_id === "string" && body.template_id) {
    const values =
      body.template_values && typeof body.template_values === "object"
        ? (body.template_values as Record<string, string | number>)
        : {};
    const { data: tpl, error: tplErr } = await supabase
      .from("browser_task_templates")
      .select("goal_template, start_url, default_max_steps, agency_owner_id")
      .eq("id", body.template_id)
      .eq("agency_owner_id", ownerId)
      .maybeSingle();
    if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 500 });
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    goal = renderGoalTemplate(tpl.goal_template, values);
    startUrl = tpl.start_url ?? null;
    maxSteps = typeof tpl.default_max_steps === "number" ? tpl.default_max_steps : DEFAULT_MAX_STEPS;
  } else {
    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }
    goal = body.goal.trim();
  }

  if (typeof body.start_url === "string" && body.start_url) startUrl = body.start_url;
  if (typeof body.max_steps === "number" && body.max_steps > 0) {
    maxSteps = Math.min(body.max_steps, STEP_CEILING);
  }

  const scheduleKind =
    typeof body.schedule_kind === "string" && VALID_SCHEDULE_KINDS.has(body.schedule_kind)
      ? body.schedule_kind
      : "one_off";
  const scheduleCron =
    scheduleKind !== "one_off" && typeof body.schedule_cron === "string" ? body.schedule_cron : null;

  const runMode =
    typeof body.run_mode === "string" && VALID_RUN_MODES.has(body.run_mode)
      ? body.run_mode
      : "local_headless";

  const { data: created, error: insertErr } = await supabase
    .from("browser_tasks")
    .insert({
      agency_owner_id: ownerId,
      created_by: user.id,
      goal,
      start_url: startUrl,
      schedule_kind: scheduleKind,
      schedule_cron: scheduleCron,
      status: "queued",
      max_steps: maxSteps,
      run_mode: runMode,
    })
    .select("*")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ task: created }, { status: 201 });
}
