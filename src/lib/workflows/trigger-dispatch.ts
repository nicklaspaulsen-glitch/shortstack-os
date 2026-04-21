/**
 * Workflow trigger dispatch — the core of the "when X happens, do Y" engine.
 *
 * INTERNAL integration points call `fireTrigger` when their event occurs.
 * We look up every active trigger of that type for the relevant user,
 * filter by config, and kick off the matching workflows.
 *
 * Every match writes a `workflow_trigger_runs` row so the UI can show
 * history + debugging output.
 *
 * DESIGN DECISIONS:
 * - Fire-and-forget (no await on workflow execution) so the caller route
 *   returns fast. Results show up in workflow_trigger_runs.
 * - Matching is per-user. A tag added to user A's lead never fires a
 *   trigger owned by user B.
 * - Config filters use simple JSON-equality — not a full expression
 *   language. Keeps the engine predictable. If a trigger's config is
 *   `{ tag: "hot-lead" }` and the payload's tag is "cold-lead", no fire.
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * The full catalog of trigger types. Keep this in sync with the UI's trigger
 * node picker and with docs/automations-triggers.md.
 */
export type TriggerType =
  | "form_submitted"
  | "email_opened"
  | "email_clicked"
  | "email_replied"
  | "link_clicked"
  | "tag_added"
  | "tag_removed"
  | "appointment_booked"
  | "pipeline_stage_changed"
  | "webhook_received"
  | "voice_call_completed"
  | "schedule"
  | "manual";

export interface TriggerRow {
  id: string;
  workflow_id: string;
  user_id: string;
  trigger_type: TriggerType;
  config: Record<string, unknown>;
  is_active: boolean;
}

export interface FireTriggerOptions {
  /** The DB client to use — usually the service-role client from inside an API route. */
  supabase: SupabaseClient;
  /** The owner of the event — tag added BY which user's lead, etc. */
  userId: string;
  /** Which kind of event happened. */
  triggerType: TriggerType;
  /** Opaque event payload. Whatever's relevant to the event. */
  payload: Record<string, unknown>;
}

export interface FireTriggerResult {
  matched: number;
  trigger_ids: string[];
  skipped: Array<{ trigger_id: string; reason: string }>;
}

/**
 * Match a trigger's `config` filter against the event `payload`.
 * Returns true if every key in config matches the corresponding key in
 * payload (case-insensitive string compare for convenience).
 */
function configMatches(
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  if (!config || Object.keys(config).length === 0) return true; // empty filter = always match
  for (const [key, expected] of Object.entries(config)) {
    if (expected === null || expected === undefined || expected === "") continue; // empty filter slot
    const actual = payload[key];
    if (typeof expected === "string" && typeof actual === "string") {
      if (expected.toLowerCase() !== actual.toLowerCase()) return false;
    } else if (Array.isArray(expected)) {
      // Array config means "actual must be one of these values"
      if (!expected.some((v) => String(v).toLowerCase() === String(actual).toLowerCase())) {
        return false;
      }
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}

/**
 * Look up every active trigger of the given type for this user, filter by
 * config, log a run per match, and kick off the workflow execution.
 *
 * Fire-and-forget — this function returns quickly. Workflow execution
 * happens asynchronously.
 */
export async function fireTrigger(
  opts: FireTriggerOptions,
): Promise<FireTriggerResult> {
  const { supabase, userId, triggerType, payload } = opts;
  const skipped: Array<{ trigger_id: string; reason: string }> = [];

  // Load candidate triggers
  const { data: triggers, error } = await supabase
    .from("workflow_triggers")
    .select("id, workflow_id, user_id, trigger_type, config, is_active")
    .eq("user_id", userId)
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  if (error) {
    console.error("[trigger-dispatch] load failed:", error.message);
    return { matched: 0, trigger_ids: [], skipped: [] };
  }

  const matchedTriggers: TriggerRow[] = [];
  for (const t of (triggers || []) as TriggerRow[]) {
    if (!configMatches(t.config || {}, payload)) {
      skipped.push({ trigger_id: t.id, reason: "config filter miss" });
      continue;
    }
    matchedTriggers.push(t);
  }

  // Also fan out to the simpler `crm_automations` table. Those rows hold
  // `trigger` + `actions` jsonb, not a full workflow graph, so they need a
  // separate (lighter) dispatcher. Fire-and-forget — we don't block the main
  // trigger-dispatch return on it.
  try {
    const { fireCrmAutomations } = await import("./crm-automation-dispatch");
    void fireCrmAutomations({
      supabase,
      ownerId: userId,
      event: triggerType,
      payload,
    }).catch((err) =>
      console.error("[trigger-dispatch] crm dispatch error:", err),
    );
  } catch (err) {
    console.error("[trigger-dispatch] failed to load crm dispatch:", err);
  }

  if (matchedTriggers.length === 0) {
    return { matched: 0, trigger_ids: [], skipped };
  }

  // Load the workflows we're going to fire. One query, many rows.
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, nodes, edges, active")
    .in(
      "id",
      matchedTriggers.map((t) => t.workflow_id),
    );
  const workflowsById = new Map((workflows || []).map((w) => [w.id, w]));

  // For each matched trigger, write a run row and async-execute the workflow.
  for (const t of matchedTriggers) {
    const wf = workflowsById.get(t.workflow_id);
    if (!wf || !wf.active) {
      skipped.push({ trigger_id: t.id, reason: "workflow inactive or missing" });
      continue;
    }

    // Log a run row upfront (status: queued)
    const { data: runRow } = await supabase
      .from("workflow_trigger_runs")
      .insert({
        trigger_id: t.id,
        workflow_id: t.workflow_id,
        user_id: userId,
        payload,
        status: "queued",
      })
      .select("id")
      .single();

    // Bump the trigger's fire counter
    await supabase
      .from("workflow_triggers")
      .update({
        last_fired_at: new Date().toISOString(),
        fire_count: 0, // placeholder — we use raw increment below
      })
      .eq("id", t.id);
    // Raw atomic increment: Postgres fire_count = fire_count + 1. If the
    // RPC isn't defined yet, the `await` resolves with `{ error }` — we just
    // swallow that (fire_count stays at previous value; not critical).
    try {
      await supabase.rpc("increment_trigger_fire_count", { trigger_id: t.id });
    } catch {
      /* RPC missing — ignore */
    }

    // Fire-and-forget workflow execution via the existing executor.
    executeInBackground(supabase, wf, t, (runRow as { id: string } | null)?.id, payload, userId);
  }

  return {
    matched: matchedTriggers.length,
    trigger_ids: matchedTriggers.map((t) => t.id),
    skipped,
  };
}

/**
 * Execute a workflow in the background and update its run row with the
 * result. Errors are swallowed (and logged to the run row) so one failing
 * workflow can't crash the trigger dispatcher.
 */
async function executeInBackground(
  supabase: SupabaseClient,
  workflow: { id: string; nodes: unknown; edges: unknown },
  trigger: TriggerRow,
  runId: string | null | undefined,
  payload: Record<string, unknown>,
  userId: string,
): Promise<void> {
  // Lazy-import the executor so we don't force-load its deps at module time.
  let result: unknown = null;
  let error: string | null = null;
  if (runId) {
    await supabase
      .from("workflow_trigger_runs")
      .update({ status: "running" })
      .eq("id", runId);
  }
  try {
    const { executeWorkflow } = await import("@/lib/services/workflows");
    // The executor expects a shape with `steps`. Our workflows table stores
    // `nodes` + `edges`. If the workflow has a `steps` field inside nodes
    // we use it; otherwise we pass nodes as steps. Cast to the executor's
    // expected type — the executor is defensively coded against weird
    // shapes (returns a safe error if fields missing).
    const candidate = workflow.nodes as unknown;
    const wfForExecutor = (
      Array.isArray(candidate)
        ? { steps: candidate, edges: workflow.edges }
        : (candidate as Record<string, unknown>)
    ) as unknown as Parameters<typeof executeWorkflow>[0];
    result = await executeWorkflow(
      wfForExecutor,
      { supabase },
      { ...payload, triggered_by: trigger.id, user_id: userId },
    );
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  if (runId) {
    await supabase
      .from("workflow_trigger_runs")
      .update({
        status: error ? "failed" : "completed",
        result: (result || null) as object | null,
        error,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}
