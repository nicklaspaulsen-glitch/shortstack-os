import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/agent-command
 *
 * Feeds the Agent Command Center dashboard with:
 *   • loopSettings — current autonomous loop on/off + last run stats
 *   • stats         — hero counters (tasks queued, leads in pipeline, revenue)
 *   • recentTasks   — last 50 agent_task_queue rows (all statuses)
 *   • pipelineCount — per-stage counts from lead_pipeline
 *   • recentEvents  — last 30 agent_activity_events (for the live feed column)
 *   • workRequests  — open client_work_requests awaiting proposal/approval
 */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createServiceClient();

  const [
    { data: loopSettings },
    { data: taskRows },
    { data: pipelineRows },
    { data: eventRows },
    { data: workRequestRows },
    { data: revenueRows },
  ] = await Promise.all([
    svc
      .from("autonomous_loop_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle(),
    svc
      .from("agent_task_queue")
      .select(
        "id, task_type, status, priority, agent_key, error_message, pipeline_id, scheduled_for, started_at, completed_at, duration_ms, payload, created_at",
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(50),
    svc
      .from("lead_pipeline")
      .select("stage")
      .eq("owner_id", ownerId),
    svc
      .from("agent_activity_events")
      .select(
        "id, agent_key, event_type, summary, ref_table, ref_id, created_at",
      )
      .eq("agency_owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("client_work_requests")
      .select("id, client_id, service_type, brief, urgency, proposal_status, created_at")
      .eq("owner_id", ownerId)
      .in("proposal_status", ["pending", "generating", "sent"])
      .order("created_at", { ascending: false })
      .limit(20),
    // Revenue: sum of paid work requests in the last 30 days
    svc
      .from("client_work_requests")
      .select("payment_amount")
      .eq("owner_id", ownerId)
      .not("paid_at", "is", null)
      .gte("paid_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  // Stage counts
  const stageCounts: Record<string, number> = {};
  for (const row of pipelineRows ?? []) {
    stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + 1;
  }

  // Quick stats
  const tasksQueued = (taskRows ?? []).filter(
    (t) => t.status === "queued" || t.status === "running",
  ).length;
  const leadsInPipeline = (pipelineRows ?? []).filter(
    (p) => p.stage !== "dead" && p.stage !== "delivered",
  ).length;
  const revenueThisMonth = (revenueRows ?? []).reduce(
    (sum, r) => sum + Number(r.payment_amount ?? 0),
    0,
  );

  // Active agents (unique agent_key seen in last 5 min)
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const activeAgentKeys = new Set(
    (taskRows ?? [])
      .filter((t) => t.status === "running" && (t.started_at ?? "") >= fiveMinAgo)
      .map((t) => t.agent_key)
      .filter(Boolean),
  );

  return NextResponse.json({
    ownerId,
    loopSettings: loopSettings ?? {
      enabled: false,
      max_leads_per_run: 20,
      auto_gen_content: false,
      auto_publish: false,
      last_run_at: null,
      last_run_result: {},
      paused_until: null,
    },
    stats: {
      tasksQueued,
      leadsInPipeline,
      revenueThisMonth,
      activeAgents: activeAgentKeys.size,
    },
    stageCounts,
    recentTasks: taskRows ?? [],
    recentEvents: eventRows ?? [],
    workRequests: workRequestRows ?? [],
  });
}

/**
 * PATCH /api/agent-command
 *
 * Toggle the autonomous loop on/off, or update settings.
 * Body: { enabled?: boolean; max_leads_per_run?: number;
 *         auto_gen_content?: boolean; auto_publish?: boolean;
 *         notify_telegram?: boolean; follow_up_day_2?: number;
 *         follow_up_day_3?: number; }
 */
export async function PATCH(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "enabled",
    "max_leads_per_run",
    "auto_gen_content",
    "auto_publish",
    "notify_telegram",
    "notify_email",
    "follow_up_day_2",
    "follow_up_day_3",
    "paused_until",
    "pause_reason",
  ];
  const patch: Record<string, unknown> = { owner_id: ownerId };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("autonomous_loop_settings")
    .upsert(patch, { onConflict: "owner_id" });

  if (error) {
    console.error("[agent-command] settings upsert failed", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
