/**
 * Cron: every 5 minutes.
 *
 * The fully-autonomous pipeline loop that runs for every agency with
 * `autonomous_loop_settings.enabled = true`.
 *
 * One run = 4 phases (all soft-fail):
 *   Phase A — Lead discovery   : if pipeline < threshold, add scrape-leads task
 *   Phase B — Outreach dispatch : send first-touch to pending leads
 *   Phase C — Follow-up triage  : advance touched leads that haven't replied
 *   Phase D — Content pipeline  : qualify → content gen → publish for ready leads
 *
 * Each phase writes to `agent_activity_events` so the Agent Office + Agent
 * Command Center show live progress.
 *
 * Auth: standard CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_OWNERS_PER_RUN = 10;

// --- helpers ----------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createServiceClient>;

async function logEvent(
  svc: SupabaseClient,
  ownerId: string,
  agentKey: string,
  eventType: string,
  summary: string,
  refTable?: string,
  refId?: string,
) {
  await svc.from("agent_activity_events").insert({
    agency_owner_id: ownerId,
    agent_key: agentKey,
    event_type: eventType,
    summary,
    ref_table: refTable ?? null,
    ref_id: refId ?? null,
  });
}

async function enqueueTask(
  svc: SupabaseClient,
  ownerId: string,
  taskType: string,
  agentKey: string,
  priority: number,
  payload: Record<string, unknown>,
  pipelineId?: string,
) {
  await svc.from("agent_task_queue").insert({
    owner_id: ownerId,
    task_type: taskType,
    agent_key: agentKey,
    priority,
    payload,
    pipeline_id: pipelineId ?? null,
    scheduled_for: new Date().toISOString(),
  });
}

// --- phase A: ensure lead supply --------------------------------------------

async function phaseLeadDiscovery(svc: SupabaseClient, ownerId: string, maxLeads: number) {
  const { count } = await svc
    .from("lead_pipeline")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .in("stage", ["outreach_pending", "outreach_sent", "replied", "qualifying"]);

  const active = count ?? 0;
  if (active >= maxLeads) return { skipped: true, active };

  const needed = maxLeads - active;
  await enqueueTask(svc, ownerId, "find_leads", "Aria", 1, { count: needed });
  await logEvent(svc, ownerId, "Aria", "lead_discovery",
    `🔍 Lead supply low (${active}/${maxLeads}). Queued find_leads task for ${needed} new leads.`,
    "agent_task_queue",
  );
  return { skipped: false, active, queued: needed };
}

// --- phase B: send first outreach to pending leads --------------------------

async function phaseOutreach(svc: SupabaseClient, ownerId: string) {
  const { data: pending } = await svc
    .from("lead_pipeline")
    .select("id, handle, platform, display_name")
    .eq("owner_id", ownerId)
    .eq("stage", "outreach_pending")
    .is("outreach_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (!pending?.length) return { sent: 0 };

  let sent = 0;
  for (const lead of pending) {
    try {
      await enqueueTask(svc, ownerId, "send_outreach", "Aria", 2,
        { handle: lead.handle, platform: lead.platform, display_name: lead.display_name },
        lead.id,
      );
      // Mark as outreach_sent optimistically — the task executor updates the actual message URL
      await svc
        .from("lead_pipeline")
        .update({ stage: "outreach_sent", outreach_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
      sent++;
    } catch (err) {
      console.error("[autonomous-loop] outreach enqueue failed", { leadId: lead.id, err });
    }
  }

  if (sent > 0) {
    await logEvent(svc, ownerId, "Aria", "outreach_batch",
      `📤 First-touch outreach queued for ${sent} leads.`,
    );
  }

  return { sent };
}

// --- phase C: follow-up triage ----------------------------------------------

async function phaseFollowUp(svc: SupabaseClient, ownerId: string, day2: number, day3: number) {
  const now = new Date();

  // Day-2 follow-up: leads outreached > day2 days ago with no reply
  const day2Cutoff = new Date(now.getTime() - day2 * 86_400_000).toISOString();
  const day3Cutoff = new Date(now.getTime() - day3 * 86_400_000).toISOString();

  const { data: needsDay2 } = await svc
    .from("lead_pipeline")
    .select("id, handle, platform, display_name, outreach_sent_at")
    .eq("owner_id", ownerId)
    .eq("stage", "outreach_sent")
    .lte("outreach_sent_at", day2Cutoff)
    .order("outreach_sent_at", { ascending: true })
    .limit(15);

  let followUps = 0;
  for (const lead of needsDay2 ?? []) {
    // Skip if a follow-up task already queued for this lead
    const { count } = await svc
      .from("agent_task_queue")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("pipeline_id", lead.id)
      .eq("task_type", "follow_up")
      .in("status", ["queued", "running", "completed"]);

    if ((count ?? 0) >= 2) {
      // Already had 2 follow-ups — mark dead if older than day3 cutoff
      if (lead.outreach_sent_at && lead.outreach_sent_at <= day3Cutoff) {
        await svc.from("lead_pipeline").update({ stage: "dead" }).eq("id", lead.id);
        await logEvent(svc, ownerId, "Aria", "lead_dead",
          `💀 Lead ${lead.handle} marked dead after 3 touches with no reply.`,
          "lead_pipeline", lead.id,
        );
      }
      continue;
    }

    await enqueueTask(svc, ownerId, "follow_up", "Aria", 3,
      { handle: lead.handle, platform: lead.platform, touch: (count ?? 0) + 2 },
      lead.id,
    );
    followUps++;
  }

  if (followUps > 0) {
    await logEvent(svc, ownerId, "Aria", "follow_up_batch",
      `🔄 Follow-up queued for ${followUps} non-responding leads.`,
    );
  }

  return { followUps };
}

// --- phase D: content pipeline for qualified leads -------------------------

async function phaseContentPipeline(svc: SupabaseClient, ownerId: string, autoGen: boolean, autoPublish: boolean) {
  if (!autoGen) return { genQueued: 0, publishQueued: 0 };

  const { data: qualified } = await svc
    .from("lead_pipeline")
    .select("id, handle, platform, lead_info, generated_content")
    .eq("owner_id", ownerId)
    .eq("stage", "qualified")
    .limit(5);

  let genQueued = 0;
  for (const lead of qualified ?? []) {
    await enqueueTask(svc, ownerId, "generate_content", "NEXUS", 4,
      { handle: lead.handle, platform: lead.platform, lead_info: lead.lead_info },
      lead.id,
    );
    await svc.from("lead_pipeline").update({ stage: "scripting" }).eq("id", lead.id);
    genQueued++;
  }

  // Move content_ready leads to publish queue
  let publishQueued = 0;
  if (autoPublish) {
    const { data: ready } = await svc
      .from("lead_pipeline")
      .select("id, handle, platform, generated_content")
      .eq("owner_id", ownerId)
      .eq("stage", "content_ready")
      .limit(5);

    for (const lead of ready ?? []) {
      await enqueueTask(svc, ownerId, "publish", "NEXUS", 5,
        { handle: lead.handle, platform: lead.platform },
        lead.id,
      );
      publishQueued++;
    }
  }

  if (genQueued > 0 || publishQueued > 0) {
    await logEvent(svc, ownerId, "NEXUS", "content_pipeline",
      `🎬 Content gen queued: ${genQueued} leads. Publish queued: ${publishQueued} leads.`,
    );
  }

  return { genQueued, publishQueued };
}

// --- main handler -----------------------------------------------------------

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();

  // Load all owners with the loop enabled and not paused
  const { data: settings, error: settingsErr } = await svc
    .from("autonomous_loop_settings")
    .select("owner_id, max_leads_per_run, auto_gen_content, auto_publish, follow_up_day_2, follow_up_day_3")
    .eq("enabled", true)
    .or(`paused_until.is.null,paused_until.lt.${new Date().toISOString()}`)
    .limit(MAX_OWNERS_PER_RUN);

  if (settingsErr) {
    console.error("[autonomous-loop] settings load failed", settingsErr);
    return NextResponse.json({ error: "Settings load failed" }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const s of settings ?? []) {
    const ownerId = s.owner_id as string;
    const runStart = Date.now();

    try {
      const [a, b, c, d] = await Promise.all([
        phaseLeadDiscovery(svc, ownerId, s.max_leads_per_run ?? 20),
        phaseOutreach(svc, ownerId),
        phaseFollowUp(svc, ownerId, s.follow_up_day_2 ?? 3, s.follow_up_day_3 ?? 7),
        phaseContentPipeline(svc, ownerId, !!s.auto_gen_content, !!s.auto_publish),
      ]);

      const summary = {
        leadDiscovery: a,
        outreach: b,
        followUp: c,
        content: d,
        durationMs: Date.now() - runStart,
      };

      // Record last run result
      await svc
        .from("autonomous_loop_settings")
        .update({ last_run_at: new Date().toISOString(), last_run_result: summary })
        .eq("owner_id", ownerId);

      // Emit a summary event so the command center shows a heartbeat
      await logEvent(svc, ownerId, "system", "loop_heartbeat",
        `⚡ Autonomous loop completed in ${summary.durationMs}ms — outreach: ${b.sent}, follow-ups: ${c.followUps}, content: ${d.genQueued} gen / ${d.publishQueued} publish.`,
      );

      results.push({ ownerId, ...summary });
    } catch (err) {
      console.error("[autonomous-loop] owner run failed", { ownerId, err });
      results.push({ ownerId, error: "unknown" });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
