/**
 * Trinity autonomous mode engine.
 *
 * proposeActions(userId)
 *   Reads recent metrics, picks a small set of candidate actions, calls
 *   the LLM router with `taskType: "agentic_reasoning"` to choose which
 *   to surface, then writes one row per chosen action to
 *   `trinity_actions` in `proposed` status.  The user (or autopilot)
 *   approves / vetoes from there.
 *
 * executeAction(actionId)
 *   Runs the actual action.  In v1 most actions are "soft" (write a draft,
 *   queue an email, log a recommendation) so we can ship without
 *   integrating with every external API surface.  Each action handler
 *   stamps `result` and flips status to `executed` or `failed`.
 *
 * The engine intentionally never throws on the public surface — it
 * always returns a structured summary so cron callers can log + move on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { callLLM, type LLMRequest } from "@/lib/ai/llm-router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";

export type TrinityActionType =
  | "morning_brief"
  | "pause_underperforming_ad"
  | "launch_followup_email"
  | "boost_winning_ad"
  | "recompute_lead_scores"
  | "generate_content_plan";

export const ALL_ACTION_TYPES: TrinityActionType[] = [
  "morning_brief",
  "pause_underperforming_ad",
  "launch_followup_email",
  "boost_winning_ad",
  "recompute_lead_scores",
  "generate_content_plan",
];

export type TrinityMode = "off" | "shadow" | "autopilot";

export interface TrinitySettings {
  user_id: string;
  mode: TrinityMode;
  enabled_actions: TrinityActionType[];
  veto_window_hours: number;
  daily_brief_email: string | null;
}

export interface ProposeActionsResult {
  userId: string;
  proposed: number;
  skippedReason?: string;
  error?: string;
}

export interface ExecuteActionResult {
  actionId: string;
  status: "executed" | "failed" | "skipped";
  error?: string;
}

interface UserMetricsSnapshot {
  yesterdayLeads: number;
  yesterdayDeals: number;
  todayMrrCents: number;
  weekAdSpendCents: number;
  weekAdRevenueCents: number;
  pendingFollowups: number;
  staleLeadScores: number;
}

const SOFT_DEFAULT_ENABLED: TrinityActionType[] = [
  "morning_brief",
  "launch_followup_email",
  "generate_content_plan",
];

/**
 * Hours of the day (in UTC) when each action is allowed to fire.  Keeps
 * us from spamming users at 3am.  All ranges INCLUSIVE.
 */
const ACTION_TIME_WINDOWS: Record<TrinityActionType, { start: number; end: number }> = {
  morning_brief: { start: 6, end: 10 },
  pause_underperforming_ad: { start: 8, end: 22 },
  launch_followup_email: { start: 9, end: 18 },
  boost_winning_ad: { start: 8, end: 22 },
  recompute_lead_scores: { start: 0, end: 23 },
  generate_content_plan: { start: 7, end: 11 },
};

/** Per-action max executions per day (keep autopilot conservative). */
const DAILY_RATE_LIMITS: Record<TrinityActionType, number> = {
  morning_brief: 1,
  pause_underperforming_ad: 5,
  launch_followup_email: 3,
  boost_winning_ad: 5,
  recompute_lead_scores: 1,
  generate_content_plan: 1,
};

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export async function loadSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<TrinitySettings> {
  const { data } = await supabase
    .from("trinity_settings")
    .select("user_id, mode, enabled_actions, veto_window_hours, daily_brief_email")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return {
      user_id: userId,
      mode: "shadow",
      enabled_actions: SOFT_DEFAULT_ENABLED,
      veto_window_hours: 4,
      daily_brief_email: null,
    };
  }

  return {
    user_id: data.user_id,
    mode: (data.mode as TrinityMode) ?? "shadow",
    enabled_actions: (data.enabled_actions as TrinityActionType[]) ?? [],
    veto_window_hours: Math.max(0, Math.min(72, data.veto_window_hours ?? 4)),
    daily_brief_email: data.daily_brief_email ?? null,
  };
}

export async function proposeActions(
  userId: string,
): Promise<ProposeActionsResult> {
  const supabase = createServiceClient();

  const settings = await loadSettings(supabase, userId);
  if (settings.mode === "off") {
    return { userId, proposed: 0, skippedReason: "mode=off" };
  }
  if (settings.enabled_actions.length === 0) {
    return { userId, proposed: 0, skippedReason: "no enabled actions" };
  }

  const nowHour = new Date().getUTCHours();
  const eligibleActions = settings.enabled_actions.filter((a) => {
    const win = ACTION_TIME_WINDOWS[a];
    if (!win) return false;
    return nowHour >= win.start && nowHour <= win.end;
  });

  if (eligibleActions.length === 0) {
    return { userId, proposed: 0, skippedReason: "outside time window" };
  }

  // Avoid thrashing — skip any action that already has a pending proposal
  // OR has hit its daily execution cap.
  const filtered = await filterByPendingAndRateLimit(
    supabase,
    userId,
    eligibleActions,
  );
  if (filtered.length === 0) {
    return { userId, proposed: 0, skippedReason: "rate limited or pending" };
  }

  let metrics: UserMetricsSnapshot;
  try {
    metrics = await loadMetrics(supabase, userId);
  } catch (err) {
    console.error("[trinity/autonomous] metrics load failed", err);
    return {
      userId,
      proposed: 0,
      error: err instanceof Error ? err.message : "metrics_failed",
    };
  }

  let llmCostUsd = 0;
  let chosen: ProposedActionDraft[] = [];
  try {
    const decision = await runReasoning(userId, filtered, metrics);
    chosen = decision.actions;
    llmCostUsd = decision.costUsd;
  } catch (err) {
    console.error("[trinity/autonomous] reasoning failed", err);
    return {
      userId,
      proposed: 0,
      error: err instanceof Error ? err.message : "reasoning_failed",
    };
  }

  if (chosen.length === 0) {
    return { userId, proposed: 0, skippedReason: "model recommended no action" };
  }

  const vetoUntil = new Date(
    Date.now() + settings.veto_window_hours * 60 * 60 * 1000,
  ).toISOString();

  const inserted = await Promise.all(
    chosen.map(async (action) => {
      const { data, error } = await supabase
        .from("trinity_actions")
        .insert({
          user_id: userId,
          action_type: action.actionType,
          context: { metrics, mode: settings.mode },
          proposed_action: action.proposedAction,
          rationale: action.rationale,
          status: "proposed",
          veto_window_until: settings.mode === "autopilot" ? vetoUntil : null,
          cost_usd: llmCostUsd / chosen.length,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[trinity/autonomous] insert error", error);
        return null;
      }
      return data;
    }),
  );

  return {
    userId,
    proposed: inserted.filter(Boolean).length,
  };
}

export async function executeAction(
  actionId: string,
): Promise<ExecuteActionResult> {
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from("trinity_actions")
    .select(
      "id, user_id, action_type, proposed_action, status, veto_window_until",
    )
    .eq("id", actionId)
    .maybeSingle();

  if (error || !row) {
    return {
      actionId,
      status: "failed",
      error: "Action not found",
    };
  }

  if (row.status !== "approved" && row.status !== "proposed") {
    return {
      actionId,
      status: "skipped",
      error: `Status is ${row.status}, not executable`,
    };
  }

  // Veto window must have passed (or be approved manually).
  if (
    row.status === "proposed" &&
    row.veto_window_until &&
    new Date(row.veto_window_until).getTime() > Date.now()
  ) {
    return {
      actionId,
      status: "skipped",
      error: "Veto window not yet expired",
    };
  }

  let result: Record<string, unknown> = {};
  try {
    result = await runActionHandler(
      supabase,
      row.user_id as string,
      row.action_type as TrinityActionType,
      (row.proposed_action ?? {}) as Record<string, unknown>,
    );
  } catch (err) {
    console.error("[trinity/autonomous] handler error", err);
    await supabase
      .from("trinity_actions")
      .update({
        status: "failed",
        result: { error: err instanceof Error ? err.message : String(err) },
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", actionId);
    return {
      actionId,
      status: "failed",
      error: err instanceof Error ? err.message : "handler_failed",
    };
  }

  await supabase
    .from("trinity_actions")
    .update({
      status: "executed",
      result,
      executed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId);

  return { actionId, status: "executed" };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — metrics, reasoning, handlers
// ─────────────────────────────────────────────────────────────────────────

async function filterByPendingAndRateLimit(
  supabase: SupabaseClient,
  userId: string,
  candidates: TrinityActionType[],
): Promise<TrinityActionType[]> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: recent } = await supabase
    .from("trinity_actions")
    .select("action_type, status, created_at")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  const counts = new Map<string, { pending: number; executedToday: number }>();
  for (const row of recent ?? []) {
    const key = row.action_type as string;
    const entry = counts.get(key) ?? { pending: 0, executedToday: 0 };
    if (row.status === "proposed" || row.status === "approved") entry.pending++;
    if (row.status === "executed") entry.executedToday++;
    counts.set(key, entry);
  }

  return candidates.filter((a) => {
    const c = counts.get(a) ?? { pending: 0, executedToday: 0 };
    if (c.pending > 0) return false;
    if (c.executedToday >= (DAILY_RATE_LIMITS[a] ?? 5)) return false;
    return true;
  });
}

async function loadMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserMetricsSnapshot> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // Each query is best-effort — if a table doesn't exist (white-label
  // installs that haven't applied a feature migration), we fall back to 0.
  const safeCount = async (
    table: string,
    filters: Array<[string, unknown]>,
    gteCol?: string,
    gteVal?: string,
  ): Promise<number> => {
    try {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      for (const [col, val] of filters) q = q.eq(col, val);
      if (gteCol && gteVal) q = q.gte(gteCol, gteVal);
      const { count } = await q;
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const safeSum = async (
    table: string,
    column: string,
    filters: Array<[string, unknown]>,
    gteCol?: string,
    gteVal?: string,
  ): Promise<number> => {
    try {
      let q = supabase.from(table).select(column);
      for (const [col, val] of filters) q = q.eq(col, val);
      if (gteCol && gteVal) q = q.gte(gteCol, gteVal);
      const { data } = await q;
      // typed loosely — column lookup at runtime
      return (data as Array<Record<string, number>> | null ?? []).reduce(
        (acc, row) => acc + (Number(row[column]) || 0),
        0,
      );
    } catch {
      return 0;
    }
  };

  const [
    yesterdayLeads,
    yesterdayDeals,
    pendingFollowups,
    staleLeadScores,
    todayMrrCents,
    weekAdSpendCents,
    weekAdRevenueCents,
  ] = await Promise.all([
    safeCount("leads", [["user_id", userId]], "created_at", dayAgo),
    safeCount("deals", [["user_id", userId], ["status", "won"]], "closed_at", dayAgo),
    safeCount(
      "leads",
      [["user_id", userId], ["status", "follow_up"]],
    ),
    safeCount(
      "leads",
      [["user_id", userId], ["score_status", "stale"]],
    ),
    safeSum(
      "subscriptions",
      "monthly_amount_cents",
      [["user_id", userId], ["status", "active"]],
    ),
    safeSum(
      "ad_metrics",
      "spend_cents",
      [["user_id", userId]],
      "metric_date",
      weekAgo,
    ),
    safeSum(
      "ad_metrics",
      "revenue_cents",
      [["user_id", userId]],
      "metric_date",
      weekAgo,
    ),
  ]);

  return {
    yesterdayLeads,
    yesterdayDeals,
    pendingFollowups,
    staleLeadScores,
    todayMrrCents,
    weekAdSpendCents,
    weekAdRevenueCents,
  };
}

interface ProposedActionDraft {
  actionType: TrinityActionType;
  proposedAction: Record<string, unknown>;
  rationale: string;
}

interface ReasoningResult {
  actions: ProposedActionDraft[];
  costUsd: number;
}

async function runReasoning(
  userId: string,
  candidates: TrinityActionType[],
  metrics: UserMetricsSnapshot,
): Promise<ReasoningResult> {
  const systemPrompt = [
    "You are Trinity, an autonomous marketing agency operator.",
    "Given the user's recent metrics and the eligible action types, decide which",
    "actions Trinity should propose RIGHT NOW.  Be conservative — only propose",
    "actions when the metrics actually justify them.  Pick at most 2 actions.",
    "",
    "Return ONLY a JSON object of the form:",
    '{ "actions": [ { "action_type": "...", "rationale": "...", "proposed_action": { ... } } ] }',
    "",
    "Each `action_type` MUST be one of the eligible types listed below.  Each",
    "`rationale` is a one-sentence reason citing a metric value.  Each",
    "`proposed_action` is a small JSON payload Trinity will use when executing",
    "(e.g. { \"campaign_id\": \"...\", \"reason\": \"...\" }).  If the metrics do not",
    "warrant any action, return { \"actions\": [] }.",
  ].join("\n");

  const userPrompt = [
    `Eligible action types: ${candidates.join(", ")}`,
    "",
    "Metrics (last 24h unless noted):",
    `- New leads: ${metrics.yesterdayLeads}`,
    `- Deals won: ${metrics.yesterdayDeals}`,
    `- Pending follow-ups: ${metrics.pendingFollowups}`,
    `- Stale lead scores: ${metrics.staleLeadScores}`,
    `- Active MRR cents: ${metrics.todayMrrCents}`,
    `- 7d ad spend cents: ${metrics.weekAdSpendCents}`,
    `- 7d ad revenue cents: ${metrics.weekAdRevenueCents}`,
    "",
    "Decide.",
  ].join("\n");

  const req: LLMRequest = {
    taskType: "agentic_reasoning",
    systemPrompt,
    userPrompt,
    userId,
    context: "/lib/trinity/autonomous#runReasoning",
    maxTokens: 600,
  };

  const result = await callLLM(req);
  const parsed = safeJsonParse<{ actions?: unknown }>(result.text);
  const actions = sanitizeReasoningResponse(parsed, candidates);
  return { actions, costUsd: result.costUsd };
}

function sanitizeReasoningResponse(
  parsed: { actions?: unknown } | null,
  candidates: TrinityActionType[],
): ProposedActionDraft[] {
  if (!parsed || !Array.isArray(parsed.actions)) return [];
  const set = new Set(candidates);
  const draft: ProposedActionDraft[] = [];
  for (const raw of parsed.actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as {
      action_type?: unknown;
      proposed_action?: unknown;
      rationale?: unknown;
    };
    const actionType = typeof r.action_type === "string" ? r.action_type : "";
    if (!set.has(actionType as TrinityActionType)) continue;
    const rationale = typeof r.rationale === "string" ? r.rationale.slice(0, 800) : "";
    const proposedAction =
      typeof r.proposed_action === "object" && r.proposed_action !== null
        ? (r.proposed_action as Record<string, unknown>)
        : {};
    draft.push({
      actionType: actionType as TrinityActionType,
      proposedAction,
      rationale,
    });
    if (draft.length >= 2) break; // hard cap per cycle
  }
  return draft;
}

async function runActionHandler(
  supabase: SupabaseClient,
  userId: string,
  actionType: TrinityActionType,
  proposed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case "morning_brief":
      return await handleMorningBrief(supabase, userId);
    case "pause_underperforming_ad":
      return await handlePauseAd(supabase, userId, proposed);
    case "launch_followup_email":
      return await handleFollowupEmail(supabase, userId, proposed);
    case "boost_winning_ad":
      return await handleBoostAd(supabase, userId, proposed);
    case "recompute_lead_scores":
      return await handleRecomputeLeadScores(supabase, userId);
    case "generate_content_plan":
      return await handleContentPlan(supabase, userId);
    default:
      throw new Error(`Unknown action_type: ${actionType}`);
  }
}

async function handleMorningBrief(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const metrics = await loadMetrics(supabase, userId);
  const result = await callLLM({
    taskType: "summarization",
    systemPrompt:
      "You are Trinity producing a 1-paragraph morning brief for the agency owner. Be concise and action-oriented.",
    userPrompt: [
      "Yesterday's snapshot:",
      `Leads: ${metrics.yesterdayLeads}`,
      `Deals won: ${metrics.yesterdayDeals}`,
      `Follow-ups pending: ${metrics.pendingFollowups}`,
      `Stale lead scores: ${metrics.staleLeadScores}`,
      `Active MRR (cents): ${metrics.todayMrrCents}`,
      `7d ad spend cents: ${metrics.weekAdSpendCents}`,
      `7d ad revenue cents: ${metrics.weekAdRevenueCents}`,
      "",
      "Write the brief.",
    ].join("\n"),
    userId,
    context: "/lib/trinity/autonomous#morning_brief",
    maxTokens: 400,
  });
  return { brief_text: result.text, metrics };
}

async function handlePauseAd(
  _supabase: SupabaseClient,
  _userId: string,
  proposed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // v1: log the recommendation only — actual pause is wired through the
  // ads-manager surface and requires per-platform OAuth.  This handler
  // returns a structured "would-pause" payload that the UI can surface.
  return {
    type: "would_pause",
    target: proposed.campaign_id ?? null,
    reason: proposed.reason ?? null,
    note:
      "v1 surfaces a recommendation. Wire to ads-manager pause endpoint in v2.",
  };
}

async function handleFollowupEmail(
  supabase: SupabaseClient,
  userId: string,
  proposed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const targetCohort =
    typeof proposed.cohort === "string" ? proposed.cohort : "stalled_leads";
  const result = await callLLM({
    taskType: "generation_short",
    systemPrompt:
      "You are Trinity drafting a short follow-up email to a stalled lead cohort. Output JSON: { subject, body }.",
    userPrompt: `Draft a follow-up email for cohort: ${targetCohort}.`,
    userId,
    context: "/lib/trinity/autonomous#followup_email",
    maxTokens: 350,
  });
  const parsed = safeJsonParse<{ subject?: string; body?: string }>(result.text);
  // Best-effort persistence: if the user has an `email_drafts` table we
  // insert there.  Failures are non-fatal.
  try {
    await supabase.from("email_drafts").insert({
      user_id: userId,
      subject: parsed?.subject ?? "Quick follow-up",
      body: parsed?.body ?? result.text,
      source: "trinity_autonomous",
      status: "draft",
    });
  } catch {
    /* table may not exist on all installs */
  }
  return {
    type: "draft_created",
    cohort: targetCohort,
    subject: parsed?.subject ?? null,
    preview: (parsed?.body ?? result.text).slice(0, 240),
  };
}

async function handleBoostAd(
  _supabase: SupabaseClient,
  _userId: string,
  proposed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return {
    type: "would_boost",
    target: proposed.campaign_id ?? null,
    new_daily_budget_cents: proposed.new_daily_budget_cents ?? null,
    reason: proposed.reason ?? null,
    note: "v1 surfaces a recommendation. Wire to ads-manager budget endpoint in v2.",
  };
}

async function handleRecomputeLeadScores(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  // Best-effort: bump every stale lead row's score_status so the existing
  // /api/cron/score-leads picks them up next cycle.
  try {
    const { data, error } = await supabase
      .from("leads")
      .update({ score_status: "pending" })
      .eq("user_id", userId)
      .eq("score_status", "stale")
      .select("id");
    if (error) throw error;
    return { type: "scores_queued", queued: (data ?? []).length };
  } catch (err) {
    return {
      type: "scores_queued",
      queued: 0,
      note: err instanceof Error ? err.message : "table unavailable",
    };
  }
}

async function handleContentPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const result = await callLLM({
    taskType: "generation_long",
    systemPrompt:
      "You are Trinity producing a one-week content plan with 5 topic ideas, each with a hook and a CTA. Output as JSON: { plan: [{ day, topic, hook, cta }] }",
    userPrompt:
      "Generate a content plan for the upcoming week. The agency targets digital service buyers.",
    userId,
    context: "/lib/trinity/autonomous#content_plan",
    maxTokens: 800,
  });
  const parsed = safeJsonParse<{ plan?: unknown[] }>(result.text);
  try {
    await supabase.from("content_plans").insert({
      user_id: userId,
      plan: parsed?.plan ?? null,
      raw_text: result.text,
      source: "trinity_autonomous",
    });
  } catch {
    /* table may not exist */
  }
  return {
    type: "plan_drafted",
    topic_count: Array.isArray(parsed?.plan) ? parsed.plan.length : 0,
  };
}
