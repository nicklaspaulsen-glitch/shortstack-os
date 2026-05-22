/**
 * Cron — Agent Task Executor
 *
 * Every 2 minutes, picks up pending tasks from `agent_task_queue` and
 * dispatches them to the appropriate handler. This is the bridge between
 * the autonomous-loop (which enqueues tasks) and the leadgen API routes
 * (which do the actual work).
 *
 * Task types dispatched:
 *   find_leads       → scrape Google Places + enrich for the owner
 *   send_outreach    → POST /api/leadgen/voice-outreach
 *   follow_up        → AI follow-up DM via Zernio
 *   generate_content → POST /api/leadgen/generate-content
 *   publish          → POST /api/leadgen/deliver
 *
 * Concurrency: processes up to 5 tasks per tick, in parallel.
 * Each task is claimed (status=running) before dispatch so concurrent
 * ticks don't collide.
 *
 * Auth: x-vercel-cron header OR Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callLLMTraced } from "@/lib/ai/llm-router";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TASKS_PER_TICK = 5;

// ── Types ────────────────────────────────────────────────────────────────────

interface QueuedTask {
  id: string;
  owner_id: string;
  task_type: string;
  agent_key: string;
  priority: number;
  payload: Record<string, unknown>;
  pipeline_id: string | null;
  scheduled_for: string | null;
}

interface TaskResult {
  ok: boolean;
  detail?: Record<string, unknown>;
  error?: string;
}

type TaskHandler = (
  supabase: SupabaseClient,
  task: QueuedTask,
) => Promise<TaskResult>;

// ── Internal fetch helper ────────────────────────────────────────────────────

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

async function internalPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { ok: false, data: { error: "WEBHOOK_SECRET not configured" } };
  }

  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-key": webhookSecret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

// ── Task handlers ────────────────────────────────────────────────────────────

/**
 * find_leads: Scrape Google Places for the owner's configured niche/location.
 * Falls back to the leadgen/ai-agent "find" mode via internal fetch to
 * /api/leadgen/voice-outreach is the wrong route — we use the scraper lib directly.
 *
 * However, the scraper lib is global (not per-owner). For per-owner lead
 * finding, we use the ai-agent route's "find" mode. Since that route needs
 * user-session auth, we inline a simplified version here using the same
 * Google Places lib.
 */
const handleFindLeads: TaskHandler = async (supabase, task) => {
  const count = (task.payload.count as number) || 10;

  // Load owner's scrape config (niche + location preferences)
  const { data: config } = await supabase
    .from("autonomous_loop_settings")
    .select("metadata")
    .eq("owner_id", task.owner_id)
    .maybeSingle();

  const metadata = (config?.metadata ?? {}) as Record<string, unknown>;
  const niche = (metadata.target_niche as string) || "local business";
  const location = (metadata.target_location as string) || "United States";

  // Use Google Places API directly
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) {
    return { ok: false, error: "GOOGLE_PLACES_API_KEY not configured" };
  }

  const searchQuery = `${niche} in ${location}`;
  let foundCount = 0;

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          maxResultCount: Math.min(count, 20),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    const data = (await res.json()) as {
      places?: Array<Record<string, unknown>>;
    };

    for (const place of data.places ?? []) {
      const name =
        (place.displayName as { text?: string })?.text || "Unknown Business";
      const phone = (place.nationalPhoneNumber as string) || null;
      const website = (place.websiteUri as string) || null;

      // Dedup by name + owner
      const { count: existing } = await supabase
        .from("lead_pipeline")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", task.owner_id)
        .ilike("display_name", name);

      if ((existing ?? 0) > 0) continue;

      // Enrich email from website
      let email: string | null = null;
      if (website) {
        try {
          const siteRes = await fetch(website, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          const html = await siteRes.text();
          const match = html.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
          );
          if (match) email = match[0];
        } catch {
          // email enrichment failure is non-critical
        }
      }

      await supabase.from("lead_pipeline").insert({
        owner_id: task.owner_id,
        platform: "google_places",
        handle: phone || name.toLowerCase().replace(/\s+/g, "-"),
        display_name: name,
        stage: "outreach_pending",
        source: "agent_task_find_leads",
        lead_info: {
          business_type: niche,
          address: place.formattedAddress,
          phone,
          website,
          email,
          rating: place.rating,
          review_count: place.userRatingCount,
        },
      });

      foundCount++;
    }
  } catch (err) {
    return {
      ok: false,
      error: `Places API failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    ok: true,
    detail: { found: foundCount, query: searchQuery },
  };
};

/**
 * send_outreach: Call /api/leadgen/voice-outreach to synthesize a voice
 * clone message and send it as a DM.
 */
const handleSendOutreach: TaskHandler = async (_supabase, task) => {
  const { lead_id, platform, handle, display_name } = task.payload as {
    lead_id?: string;
    platform?: string;
    handle?: string;
    display_name?: string;
  };

  if (!handle || !platform) {
    return { ok: false, error: "Missing handle or platform in payload" };
  }

  const result = await internalPost("/api/leadgen/voice-outreach", {
    owner_id: task.owner_id,
    handle,
    platform,
    first_name: display_name || undefined,
  });

  return {
    ok: result.ok,
    detail: { lead_id, ...result.data },
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * follow_up: Generate an AI follow-up message and send it via DM.
 * The autonomous-loop already tracks follow-up attempts.
 */
const handleFollowUp: TaskHandler = async (supabase, task) => {
  const { lead_id, platform, handle, display_name, attempt } =
    task.payload as {
      lead_id?: string;
      platform?: string;
      handle?: string;
      display_name?: string;
      attempt?: number;
    };

  if (!lead_id || !handle || !platform) {
    return { ok: false, error: "Missing lead_id, handle, or platform" };
  }

  // Load the lead's conversation history for context
  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, message_history, outreach_text, display_name, lead_info, stage",
    )
    .eq("id", lead_id)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  // Don't follow up dead or already-qualified leads
  if (lead.stage === "dead" || lead.stage === "qualified") {
    return {
      ok: true,
      detail: { skipped: true, reason: `stage_${lead.stage}` },
    };
  }

  // Get owner profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", task.owner_id)
    .maybeSingle();

  const agencyName =
    profile?.agency_name || profile?.full_name || "our agency";
  const leadName = display_name || lead.display_name || "there";
  const attemptNum = attempt || 1;

  // Generate follow-up message with AI
  let followUpText: string;
  try {
    const result = await callLLMTraced({
      taskType: "generation_short",
      systemPrompt: `You are a friendly follow-up specialist for ${agencyName}. Write a short, natural follow-up DM. No pressure, just checking in. Maximum 2 sentences.`,
      userPrompt: `Write follow-up #${attemptNum} for ${leadName}.
Original outreach: "${lead.outreach_text || "content creation services"}"
They haven't replied yet. Be casual, warm, and brief. Different angle from the original.
${attemptNum >= 2 ? "This is the final follow-up — mention you won't bother them again." : ""}`,
      maxTokens: 150,
      forceModel: "claude-haiku-4-5",
      surface: "agent_follow_up",
      subject: {
        kind: "lead",
        id: lead_id,
        agencyOwnerId: task.owner_id,
      },
      humanize: true,
    });
    followUpText = (
      typeof result === "string" ? result : result.text || ""
    ).trim();
  } catch (err) {
    return {
      ok: false,
      error: `AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!followUpText) {
    return { ok: false, error: "AI returned empty follow-up" };
  }

  // Send via Zernio DM
  const zernioKey = process.env.ZERNIO_API_KEY;
  if (zernioKey) {
    try {
      await fetch("https://api.zernio.com/v1/dm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": zernioKey,
        },
        body: JSON.stringify({
          platform,
          handle,
          message: followUpText,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.error(
        "[run-agent-tasks] Zernio follow-up send failed:",
        err,
      );
    }
  }

  // Update message history
  const history = Array.isArray(lead.message_history)
    ? (lead.message_history as Array<Record<string, unknown>>)
    : [];
  const updatedHistory = [
    ...history,
    {
      role: "assistant",
      content: `[follow-up #${attemptNum}] ${followUpText}`,
      timestamp: new Date().toISOString(),
    },
  ];

  await supabase
    .from("lead_pipeline")
    .update({
      message_history: updatedHistory,
      last_follow_up_at: new Date().toISOString(),
    })
    .eq("id", lead_id);

  return {
    ok: true,
    detail: { attempt: attemptNum, message: followUpText },
  };
};

/**
 * generate_content: Call /api/leadgen/generate-content to produce a
 * content package for a qualified lead.
 */
const handleGenerateContent: TaskHandler = async (_supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  const result = await internalPost("/api/leadgen/generate-content", {
    lead_id: leadId,
  });

  return {
    ok: result.ok,
    detail: result.data,
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * publish: Deliver the generated content to the lead via DM.
 * For now, this sends the content brief + a portal link.
 * Future: actually publish to their social accounts via Zernio.
 */
const handlePublish: TaskHandler = async (supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  // Check if the lead has generated content and payment
  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, owner_id, display_name, handle, platform, generated_content, payment_received_at, stage",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  const content = lead.generated_content as Record<string, unknown> | null;
  if (!content?.brief) {
    return { ok: false, error: "No generated content to publish" };
  }

  // Build deliverable summary
  const brief = (content.brief as string) || "";
  const captions = (content.captions as string[]) || [];
  const hookIdeas = (content.hook_ideas as string[]) || [];
  const portalUrl = `${APP_URL}/portal/${leadId}`;

  const deliveryMessage = [
    `Hey ${lead.display_name || lead.handle}! Your content package is ready 🎉`,
    "",
    `📋 Brief: ${brief}`,
    "",
    `📱 ${captions.length} social captions + ${hookIdeas.length} video hooks ready`,
    "",
    `View everything in your portal: ${portalUrl}`,
    "",
    "Let me know what you think!",
  ].join("\n");

  const result = await internalPost("/api/leadgen/deliver", {
    lead_id: leadId,
    owner_id: task.owner_id,
    deliverable_urls: [portalUrl],
    delivery_message: deliveryMessage,
  });

  return {
    ok: result.ok,
    detail: result.data,
    error: result.ok ? undefined : (result.data.error as string),
  };
};

// ── Handler dispatch map ─────────────────────────────────────────────────────

const TASK_HANDLERS: Record<string, TaskHandler> = {
  find_leads: handleFindLeads,
  send_outreach: handleSendOutreach,
  follow_up: handleFollowUp,
  generate_content: handleGenerateContent,
  publish: handlePublish,
};

// ── Activity logger ──────────────────────────────────────────────────────────

async function logActivity(
  supabase: SupabaseClient,
  ownerId: string,
  agentKey: string,
  eventType: string,
  summary: string,
  refId?: string,
): Promise<void> {
  await supabase
    .from("agent_activity_events")
    .insert({
      agency_owner_id: ownerId,
      agent_key: agentKey,
      event_type: eventType,
      summary,
      ref_table: "agent_task_queue",
      ref_id: refId ?? null,
    })
    .then(() => {});
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization");
  const hasBearer = auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Pick up pending tasks, ordered by priority (lower = more urgent)
  const { data: tasks, error: fetchErr } = await supabase
    .from("agent_task_queue")
    .select(
      "id, owner_id, task_type, agent_key, priority, payload, pipeline_id, scheduled_for",
    )
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_TASKS_PER_TICK);

  if (fetchErr) {
    console.error("[run-agent-tasks] query failed:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const queue = (tasks ?? []) as QueuedTask[];
  if (queue.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Claim all tasks atomically (set status=running so concurrent ticks skip them)
  const taskIds = queue.map((t) => t.id);
  await supabase
    .from("agent_task_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .in("id", taskIds);

  // Process in parallel
  const results = await Promise.allSettled(
    queue.map(async (task) => {
      const startMs = Date.now();
      const handler = TASK_HANDLERS[task.task_type];

      if (!handler) {
        const msg = `Unknown task_type: ${task.task_type}`;
        await supabase
          .from("agent_task_queue")
          .update({
            status: "failed",
            error_message: msg,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startMs,
          })
          .eq("id", task.id);
        return { taskId: task.id, ok: false, error: msg };
      }

      try {
        const result = await handler(supabase, task);
        const durationMs = Date.now() - startMs;

        await supabase
          .from("agent_task_queue")
          .update({
            status: result.ok ? "completed" : "failed",
            error_message: result.error ?? null,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
          })
          .eq("id", task.id);

        // Log activity
        const emoji = result.ok ? "✅" : "❌";
        await logActivity(
          supabase,
          task.owner_id,
          task.agent_key,
          `task_${result.ok ? "completed" : "failed"}`,
          `${emoji} ${task.task_type} ${result.ok ? "completed" : "failed"} (${durationMs}ms)${result.error ? `: ${result.error}` : ""}`,
          task.id,
        );

        return { taskId: task.id, ok: result.ok, error: result.error };
      } catch (err) {
        const durationMs = Date.now() - startMs;
        const errMsg =
          err instanceof Error ? err.message : String(err);

        await supabase
          .from("agent_task_queue")
          .update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
          })
          .eq("id", task.id);

        await logActivity(
          supabase,
          task.owner_id,
          task.agent_key,
          "task_failed",
          `❌ ${task.task_type} crashed: ${errMsg}`,
          task.id,
        );

        return { taskId: task.id, ok: false, error: errMsg };
      }
    }),
  );

  let completed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) completed++;
    else failed++;
  }

  return NextResponse.json({
    processed: queue.length,
    completed,
    failed,
  });
}
