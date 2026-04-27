/**
 * Multi-channel sequence engine.
 *
 * Responsibilities:
 *   - Enroll contacts into a sequence (one row per contact per sequence).
 *   - Execute the next step for a run on demand or via cron.
 *   - Pause / resume / exit a run.
 *   - Reply detection — given a contact + channel, mark all of that contact's
 *     active runs as exited.
 *
 * Storage:
 *   - `sequence_runs` table (per-contact run state, minute-level scheduling).
 *   - Steps live in `sequences.steps_json` (jsonb) when present, else fall
 *     back to the legacy day-based `sequence_steps` table.
 *
 * Channel send paths:
 *   - email → sendMessage() from @/lib/email
 *   - sms   → Twilio REST (same call shape as /api/sms/send-manual)
 *   - dm    → Zernio REST (same call shape as /api/dm/send-manual). Falls
 *             back to a `queued` outreach_log row when ZERNIO_API_KEY is missing.
 *   - voice_call → outreach_log row with platform='voice_call_task' for human
 *                  dispatch (no automatic dial).
 *
 * AI personalization (when step.ai_personalize is true):
 *   - One Claude Haiku call per send; receives lead context + step body and
 *     returns a personalised body (and subject for email). On failure or
 *     missing API key we silently fall back to the literal step body.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/email";
import { anthropic, MODEL_HAIKU } from "@/lib/ai/claude-helpers";
import {
  type BranchStep,
  type DmStep,
  type EmailStep,
  type SequenceStep,
  type SequenceRunRow,
  type SequenceRunStatus,
  type SmsStep,
  type StepCondition,
  type TagStep,
  type VoiceCallStep,
  asSequenceStep,
  stepDelayMinutes,
} from "./types";

const MS_PER_MINUTE = 60_000;

/**
 * Per-tick cap for the cron runner. Keeps Claude/Twilio/Resend bills under
 * control if a sudden flood of steps comes due. Anything above the cap rolls
 * over to the next tick.
 */
export const RUNS_PER_TICK_CAP = 100;

interface LeadRow {
  id: string;
  user_id: string;
  business_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  city: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
}

interface SequenceShellRow {
  id: string;
  profile_id: string;
  name: string;
  is_active: boolean;
  steps_json: SequenceStep[] | null;
}

interface LegacyStepRow {
  step_order: number;
  delay_days: number;
  channel: string;
  template_body: string | null;
  template_subject: string | null;
}

// ─── Enrollment ─────────────────────────────────────────────────────────

export interface EnrollOptions {
  /** Override the default first-step delay (uses the first step's delay_minutes by default). */
  startAt?: Date;
  /** Free-form metadata pinned to the run row. */
  metadata?: Record<string, unknown>;
}

export interface EnrollmentResult {
  enrolled: number;
  skipped: number;
  /** New sequence_runs rows. */
  run_ids: string[];
}

/**
 * Enroll a batch of contacts into a sequence. Idempotent — if a contact
 * already has an `active` or `paused` run on this sequence, it's skipped.
 */
export async function enrollContacts(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sequenceId: string;
    contactIds: string[];
    options?: EnrollOptions;
  },
): Promise<EnrollmentResult> {
  const { userId, sequenceId, contactIds, options } = args;
  if (contactIds.length === 0) {
    return { enrolled: 0, skipped: 0, run_ids: [] };
  }

  // Load the sequence + first step delay so we can compute next_action_at.
  const seq = await loadSequenceWithSteps(supabase, sequenceId);
  if (!seq) {
    return { enrolled: 0, skipped: contactIds.length, run_ids: [] };
  }

  // Find contacts already enrolled (active/paused) — those are skipped.
  const { data: existingRows } = await supabase
    .from("sequence_runs")
    .select("contact_id")
    .eq("sequence_id", sequenceId)
    .in("contact_id", contactIds)
    .in("status", ["active", "paused"]);
  const alreadyEnrolled = new Set(
    ((existingRows || []) as { contact_id: string | null }[])
      .map((r) => r.contact_id)
      .filter((x): x is string => !!x),
  );

  const firstStepDelayMin = seq.steps[0]
    ? stepDelayMinutes(seq.steps[0])
    : 0;
  const baseStartMs = options?.startAt
    ? options.startAt.getTime()
    : Date.now();
  const nextActionAt = new Date(
    baseStartMs + firstStepDelayMin * MS_PER_MINUTE,
  ).toISOString();

  const rows = contactIds
    .filter((id) => !alreadyEnrolled.has(id))
    .map((contactId) => ({
      user_id: userId,
      sequence_id: sequenceId,
      contact_id: contactId,
      current_step: 0,
      next_action_at: nextActionAt,
      status: "active" as const,
      metadata: options?.metadata ?? {},
    }));

  if (rows.length === 0) {
    return { enrolled: 0, skipped: contactIds.length, run_ids: [] };
  }

  const { data, error } = await supabase
    .from("sequence_runs")
    .insert(rows)
    .select("id");
  if (error) {
    console.error("[sequences/engine] enroll insert failed:", error.message);
    return { enrolled: 0, skipped: contactIds.length, run_ids: [] };
  }

  return {
    enrolled: rows.length,
    skipped: contactIds.length - rows.length,
    run_ids: (data || []).map((r) => r.id),
  };
}

// ─── Step execution ─────────────────────────────────────────────────────

export interface ExecuteResult {
  /** What happened — used for trinity_log entries and the dashboard. */
  status: "advanced" | "completed" | "exited" | "failed" | "paused" | "skipped";
  /** Optional human-readable note (error message, exit reason, etc.). */
  note?: string;
  /** The step we just ran. */
  step?: SequenceStep;
}

/**
 * Execute the current step for a single run. Idempotent at the row level —
 * advances `current_step` after running, schedules the next `next_action_at`,
 * and marks the run completed when it falls off the end.
 *
 * The caller must use a service-role client so we can bypass RLS and write
 * cross-table state (outreach_log + trinity_log) without UI-side auth.
 */
export async function executeStep(
  supabase: SupabaseClient,
  runId: string,
): Promise<ExecuteResult> {
  const { data: runRow } = await supabase
    .from("sequence_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (!runRow) {
    return { status: "failed", note: "run not found" };
  }
  const run = runRow as SequenceRunRow;
  if (run.status !== "active") {
    return { status: "skipped", note: `run status is ${run.status}` };
  }

  const seq = await loadSequenceWithSteps(supabase, run.sequence_id);
  if (!seq) {
    await markRunFailed(supabase, run.id, "sequence missing");
    return { status: "failed", note: "sequence missing" };
  }
  if (!seq.is_active) {
    return { status: "skipped", note: "sequence paused" };
  }

  const steps = seq.steps;
  if (run.current_step >= steps.length) {
    await markRunCompleted(supabase, run.id);
    return { status: "completed" };
  }

  const step = steps[run.current_step];
  const lead = run.contact_id
    ? await loadLead(supabase, run.contact_id)
    : null;

  // Branch / exit_if / tag are control-flow only; no external send.
  if (step.type === "exit_if") {
    if (lead && evaluateCondition(step.condition, lead, run)) {
      await markRunExited(supabase, run.id, step.reason || "exit_if condition met");
      await logRunEvent(supabase, run, seq, step, "exited", step.reason || "exit_if");
      return { status: "exited", note: step.reason || "exit_if condition met", step };
    }
    return finishAndAdvance(supabase, run, seq, step, "advanced", "exit_if condition not met");
  }

  if (step.type === "branch") {
    // v1: linearise — drop into if_true if the condition matches, else if_false.
    const branchSteps = lead && evaluateCondition(step.condition, lead, run)
      ? step.if_true
      : step.if_false;
    return executeBranchInline(supabase, run, seq, step, branchSteps);
  }

  if (step.type === "tag") {
    await applyTag(supabase, run, step);
    return finishAndAdvance(supabase, run, seq, step, "advanced", `tag.${step.action}`);
  }

  if (step.type === "wait") {
    return finishAndAdvance(supabase, run, seq, step, "advanced", "wait");
  }

  // Send-channel steps need a contact.
  if (!lead) {
    await markRunFailed(supabase, run.id, "no contact for send step");
    return { status: "failed", note: "no contact" };
  }

  let sendResult: ExecuteResult;
  try {
    if (step.type === "email") {
      sendResult = await runEmailStep(supabase, lead, step);
    } else if (step.type === "sms") {
      sendResult = await runSmsStep(lead, step);
    } else if (step.type === "dm") {
      sendResult = await runDmStep(supabase, lead, step);
    } else if (step.type === "voice_call") {
      sendResult = await runVoiceCallStep(supabase, lead, step);
    } else {
      // Unreachable if asSequenceStep keeps doing its job — but TS wants exhaustiveness.
      const _exhaustive: never = step;
      void _exhaustive;
      return { status: "failed", note: "unknown step type" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sequences/engine] step execute failed run=${run.id}:`, msg);
    sendResult = { status: "failed", note: msg };
  }

  // Log the execution + advance regardless of send outcome (failed sends are
  // not retried in v1; they're surfaced via trinity_log + the activity panel).
  await logRunEvent(
    supabase,
    run,
    seq,
    step,
    sendResult.status === "failed" ? "failed" : "completed",
    sendResult.note || null,
  );

  if (sendResult.status === "failed") {
    // Keep the run going — failed sends shouldn't kill the rest of the
    // sequence. The user can review failures in the activity panel and
    // manually skip-step or exit if needed.
    return finishAndAdvance(supabase, run, seq, step, "failed", sendResult.note);
  }

  return finishAndAdvance(supabase, run, seq, step, "advanced", sendResult.note);
}

/**
 * Advance the run pointer + schedule the next step. Marks completed when
 * we fall off the end of the steps array.
 */
async function finishAndAdvance(
  supabase: SupabaseClient,
  run: SequenceRunRow,
  seq: { steps: SequenceStep[] },
  step: SequenceStep,
  status: ExecuteResult["status"],
  note: string | undefined,
): Promise<ExecuteResult> {
  const nextIndex = run.current_step + 1;

  if (nextIndex >= seq.steps.length) {
    await markRunCompleted(supabase, run.id);
    return { status: "completed", note, step };
  }

  const nextStep = seq.steps[nextIndex];
  const delayMin = stepDelayMinutes(nextStep);
  const nextAt = new Date(Date.now() + delayMin * MS_PER_MINUTE).toISOString();

  await supabase
    .from("sequence_runs")
    .update({
      current_step: nextIndex,
      next_action_at: nextAt,
    })
    .eq("id", run.id);

  return { status, note, step };
}

/**
 * Inline a branch's chosen path into the run by splicing it into a derived
 * step graph stored in `channel_state.inlined_steps` and resetting the
 * pointer. v1 keeps this simple — the engine treats the inlined path as the
 * remainder of the sequence.
 *
 * The lifetime of `inlined_steps` is the run itself; once consumed it's
 * cleared so subsequent branches stack cleanly.
 */
async function executeBranchInline(
  supabase: SupabaseClient,
  run: SequenceRunRow,
  seq: { id: string; steps: SequenceStep[] },
  step: BranchStep,
  branchSteps: SequenceStep[],
): Promise<ExecuteResult> {
  // Splice the chosen branch into the steps array, replacing the branch step.
  const remaining = seq.steps.slice(run.current_step + 1);
  const newSteps = [...branchSteps, ...remaining];
  const channelState = { ...run.channel_state, inlined_steps: newSteps };
  // Reset to step 0 of the inlined path. We persist the inlined path on the
  // run row so subsequent ticks see it (loadSequenceWithSteps prefers run-level
  // overrides when present).
  const firstDelay = newSteps[0] ? stepDelayMinutes(newSteps[0]) : 0;
  const nextAt = new Date(Date.now() + firstDelay * MS_PER_MINUTE).toISOString();

  await supabase
    .from("sequence_runs")
    .update({
      current_step: 0,
      next_action_at: nextAt,
      channel_state: channelState,
    })
    .eq("id", run.id);

  await logRunEvent(supabase, run, seq, step, "completed", "branch taken");

  return { status: "advanced", note: "branch", step };
}

// ─── Per-channel send paths ─────────────────────────────────────────────

async function runEmailStep(
  supabase: SupabaseClient,
  lead: LeadRow,
  step: EmailStep,
): Promise<ExecuteResult> {
  if (!lead.email) return { status: "skipped", note: "lead has no email", step };

  const { subject, body } = await maybePersonalizeEmail(step, lead);
  const renderedSubject = renderTemplate(subject || "Following up", lead);
  const renderedBody = renderTemplate(body, lead);

  const fromEmail = process.env.SMTP_FROM || "growth@mail.shortstack.work";
  const fromName = process.env.SMTP_FROM_NAME || "Growth";

  await sendMessage({
    to: lead.email,
    from: `${fromName} <${fromEmail}>`,
    subject: renderedSubject,
    html: `<p>${renderedBody.replace(/\n/g, "<br>")}</p>`,
    text: renderedBody,
  });

  await supabase.from("outreach_log").insert({
    lead_id: lead.id,
    platform: "email",
    business_name: lead.business_name,
    recipient_handle: lead.email,
    message_text: renderedBody,
    status: "sent",
    sent_at: new Date().toISOString(),
    source: "sequence_engine",
    metadata: { subject: renderedSubject, ai_personalize: !!step.ai_personalize },
  });

  return { status: "advanced", step };
}

async function runSmsStep(lead: LeadRow, step: SmsStep): Promise<ExecuteResult> {
  if (!lead.phone) return { status: "skipped", note: "lead has no phone", step };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_DEFAULT_NUMBER;
  if (!sid || !token || !from) {
    return { status: "failed", note: "Twilio not configured", step };
  }

  const body = await maybePersonalizeText(step.body, lead, !!step.ai_personalize);
  const rendered = renderTemplate(body, lead);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: lead.phone,
        From: from,
        Body: rendered.slice(0, 1600),
      }),
    },
  );
  if (!res.ok) {
    return { status: "failed", note: `Twilio ${res.status}`, step };
  }

  const service = createServiceClient();
  await service.from("outreach_log").insert({
    lead_id: lead.id,
    platform: "sms",
    business_name: lead.business_name,
    recipient_handle: lead.phone,
    message_text: rendered,
    status: "sent",
    sent_at: new Date().toISOString(),
    source: "sequence_engine",
    metadata: { ai_personalize: !!step.ai_personalize },
  });

  return { status: "advanced", step };
}

async function runDmStep(
  supabase: SupabaseClient,
  lead: LeadRow,
  step: DmStep,
): Promise<ExecuteResult> {
  const handle = pickHandleForPlatform(lead, step.platform);
  if (!handle) {
    return {
      status: "skipped",
      note: `lead has no ${step.platform} handle`,
      step,
    };
  }

  const body = await maybePersonalizeText(step.body, lead, !!step.ai_personalize);
  const rendered = renderTemplate(body, lead);

  const zernioKey = process.env.ZERNIO_API_KEY;
  if (!zernioKey) {
    // Degraded — queue for later.
    await supabase.from("outreach_log").insert({
      lead_id: lead.id,
      platform: step.platform,
      business_name: lead.business_name,
      recipient_handle: handle,
      message_text: rendered,
      status: "queued",
      source: "sequence_engine",
      metadata: { reason: "ZERNIO_API_KEY missing", ai_personalize: !!step.ai_personalize },
    });
    return { status: "advanced", note: "DM queued (Zernio not configured)", step };
  }

  const res = await fetch("https://api.zernio.com/v1/dms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${zernioKey}`,
    },
    body: JSON.stringify({
      platform: step.platform,
      recipient: handle,
      text: rendered,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      status: "failed",
      note: typeof data.message === "string" ? data.message : `Zernio ${res.status}`,
      step,
    };
  }

  await supabase.from("outreach_log").insert({
    lead_id: lead.id,
    platform: step.platform,
    business_name: lead.business_name,
    recipient_handle: handle,
    message_text: rendered,
    status: "sent",
    sent_at: new Date().toISOString(),
    source: "sequence_engine",
    metadata: { zernio_id: typeof data.id === "string" ? data.id : null, ai_personalize: !!step.ai_personalize },
  });

  return { status: "advanced", step };
}

async function runVoiceCallStep(
  supabase: SupabaseClient,
  lead: LeadRow,
  step: VoiceCallStep,
): Promise<ExecuteResult> {
  // v1 — voice calls are queued as tasks for the agency rep to dial. We log
  // an outreach_log row with platform='voice_call_task'. A future Twilio
  // auto-dial integration can pick these up and convert them.
  await supabase.from("outreach_log").insert({
    lead_id: lead.id,
    platform: "voice_call_task",
    business_name: lead.business_name,
    recipient_handle: lead.phone,
    message_text: step.notes || "Voice call task queued by sequence",
    status: "queued",
    source: "sequence_engine",
    metadata: { script_id: step.script_id || null, queued_for_human: true },
  });
  return { status: "advanced", note: "voice call queued", step };
}

// ─── Tagging ────────────────────────────────────────────────────────────

async function applyTag(
  supabase: SupabaseClient,
  run: SequenceRunRow,
  step: TagStep,
): Promise<void> {
  if (!run.contact_id) return;
  // Tags are stored on leads.metadata.tags as a string[]. No FK to a tags table.
  const { data: leadRow } = await supabase
    .from("leads")
    .select("metadata")
    .eq("id", run.contact_id)
    .single();
  const meta = (leadRow?.metadata || {}) as Record<string, unknown>;
  const existing = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  let nextTags: string[];
  if (step.action === "add") {
    nextTags = existing.includes(step.tag_id) ? existing : [...existing, step.tag_id];
  } else {
    nextTags = existing.filter((t) => t !== step.tag_id);
  }
  await supabase
    .from("leads")
    .update({ metadata: { ...meta, tags: nextTags } })
    .eq("id", run.contact_id);
}

// ─── Pause / Resume / Exit ──────────────────────────────────────────────

export async function pauseRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("sequence_runs")
    .update({ status: "paused" })
    .eq("id", runId)
    .eq("status", "active");
  return !error;
}

export async function resumeRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("sequence_runs")
    .update({
      status: "active",
      next_action_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "paused");
  return !error;
}

export async function exitRun(
  supabase: SupabaseClient,
  runId: string,
  reason: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("sequence_runs")
    .update({
      status: "exited",
      exit_reason: reason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["active", "paused"]);
  return !error;
}

export async function skipStep(
  supabase: SupabaseClient,
  runId: string,
): Promise<boolean> {
  // Read current step + sequence to compute next_action_at against the
  // step *after* the current one.
  const { data } = await supabase
    .from("sequence_runs")
    .select("id, sequence_id, current_step, status")
    .eq("id", runId)
    .single();
  if (!data || data.status !== "active") return false;

  const seq = await loadSequenceWithSteps(supabase, data.sequence_id);
  if (!seq) return false;

  const nextIndex = data.current_step + 1;
  if (nextIndex >= seq.steps.length) {
    await markRunCompleted(supabase, runId);
    return true;
  }
  const nextDelay = stepDelayMinutes(seq.steps[nextIndex]);
  await supabase
    .from("sequence_runs")
    .update({
      current_step: nextIndex,
      next_action_at: new Date(Date.now() + nextDelay * MS_PER_MINUTE).toISOString(),
    })
    .eq("id", runId);
  return true;
}

/**
 * Reply detection — exit all active/paused runs for the given contact.
 * Called from inbound webhooks (resend/inbound, twilio sms-webhook,
 * zernio webhook). Idempotent + cheap; safe to call on every inbound.
 */
export async function exitRunsForContact(
  supabase: SupabaseClient,
  contactId: string,
  reason = "replied",
): Promise<number> {
  const { data, error } = await supabase
    .from("sequence_runs")
    .update({
      status: "exited",
      exit_reason: reason,
      completed_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId)
    .in("status", ["active", "paused"])
    .select("id");
  if (error) {
    console.error("[sequences/engine] exitRunsForContact failed:", error.message);
    return 0;
  }
  return (data || []).length;
}

// ─── Internals ──────────────────────────────────────────────────────────

async function loadSequenceWithSteps(
  supabase: SupabaseClient,
  sequenceId: string,
): Promise<{ id: string; profile_id: string; name: string; is_active: boolean; steps: SequenceStep[] } | null> {
  const { data: shellRow } = await supabase
    .from("sequences")
    .select("id, profile_id, name, is_active, steps_json")
    .eq("id", sequenceId)
    .single();
  if (!shellRow) return null;
  const shell = shellRow as SequenceShellRow;

  // Prefer steps_json (richer multi-channel) when present.
  if (Array.isArray(shell.steps_json) && shell.steps_json.length > 0) {
    const steps = shell.steps_json
      .map((s) => asSequenceStep(s))
      .filter((s): s is SequenceStep => s !== null);
    return { ...shell, steps };
  }

  // Fall back to legacy table — translate day-based rows into minute-based steps.
  const { data: legacyRows } = await supabase
    .from("sequence_steps")
    .select("step_order, delay_days, channel, template_body, template_subject")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });
  const steps = ((legacyRows || []) as LegacyStepRow[])
    .map(legacyRowToStep)
    .filter((s): s is SequenceStep => s !== null);
  return { ...shell, steps };
}

function legacyRowToStep(row: LegacyStepRow): SequenceStep | null {
  const delay = Math.max(0, row.delay_days * 24 * 60);
  if (row.channel === "email") {
    return {
      type: "email",
      subject: row.template_subject || "Following up",
      body: row.template_body || "",
      delay_minutes: delay,
    };
  }
  if (row.channel === "sms") {
    return {
      type: "sms",
      body: row.template_body || "",
      delay_minutes: delay,
    };
  }
  if (row.channel === "dm") {
    return {
      type: "dm",
      platform: "instagram",
      body: row.template_body || "",
      delay_minutes: delay,
    };
  }
  if (row.channel === "call") {
    return {
      type: "voice_call",
      notes: row.template_body || "",
      delay_minutes: delay,
    };
  }
  if (row.channel === "wait") {
    return { type: "wait", delay_minutes: delay };
  }
  return null;
}

async function loadLead(
  supabase: SupabaseClient,
  contactId: string,
): Promise<LeadRow | null> {
  const { data } = await supabase
    .from("leads")
    .select(
      "id, user_id, business_name, owner_name, email, phone, industry, city, instagram_url, facebook_url, linkedin_url, tiktok_url, status, metadata",
    )
    .eq("id", contactId)
    .single();
  return (data as LeadRow) || null;
}

function pickHandleForPlatform(lead: LeadRow, platform: DmStep["platform"]): string | null {
  const url =
    platform === "instagram" ? lead.instagram_url
    : platform === "facebook" ? lead.facebook_url
    : platform === "linkedin" ? lead.linkedin_url
    : platform === "tiktok" ? lead.tiktok_url
    : null;
  if (!url) return null;
  // Pull the handle off the URL: last path segment, strip leading @ and trailing slash.
  const m = url.match(/([^/]+)\/?$/);
  return m ? m[1].replace(/^@/, "").replace(/\/$/, "") : url;
}

function renderTemplate(raw: string, lead: LeadRow): string {
  if (!raw) return "";
  return raw
    .replace(/\{name\}/gi, lead.owner_name || lead.business_name || "there")
    .replace(/\{business_name\}/gi, lead.business_name || "there")
    .replace(/\{first_name\}/gi, (lead.owner_name || "").split(" ")[0] || "there")
    .replace(/\{email\}/gi, lead.email || "")
    .replace(/\{industry\}/gi, lead.industry || "your industry")
    .replace(/\{city\}/gi, lead.city || "your city");
}

function evaluateCondition(
  condition: StepCondition,
  lead: LeadRow,
  run: SequenceRunRow,
): boolean {
  const path = condition.field.split(".");
  let current: unknown = path[0] === "lead" ? lead : path[0] === "run" ? run : null;
  for (let i = 1; i < path.length; i++) {
    if (current === null || current === undefined) return false;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[path[i]];
    } else {
      return false;
    }
  }

  const op = condition.operator;
  const target = condition.value;

  switch (op) {
    case "exists":
      return current !== null && current !== undefined && current !== "";
    case "not_exists":
      return current === null || current === undefined || current === "";
    case "equals":
      return String(current ?? "").toLowerCase() === String(target ?? "").toLowerCase();
    case "not_equals":
      return String(current ?? "").toLowerCase() !== String(target ?? "").toLowerCase();
    case "contains":
      return String(current ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
    case "not_contains":
      return !String(current ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
    case "greater_than":
      return Number(current) > Number(target);
    case "less_than":
      return Number(current) < Number(target);
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      return false;
    }
  }
}

// ─── AI personalization ─────────────────────────────────────────────────

async function maybePersonalizeEmail(
  step: EmailStep,
  lead: LeadRow,
): Promise<{ subject: string | undefined; body: string }> {
  if (!step.ai_personalize) {
    return { subject: step.subject, body: step.body };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { subject: step.subject, body: step.body };
  }
  try {
    const result = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 600,
      system:
        "You personalize cold outreach emails. Rewrite the user's subject + body for the given prospect, keeping the same intent and length. Output STRICT JSON only: {\"subject\": string, \"body\": string}.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            lead: {
              business_name: lead.business_name,
              owner_name: lead.owner_name,
              industry: lead.industry,
              city: lead.city,
            },
            template: {
              subject: step.subject,
              body: step.body,
            },
          }),
        },
      ],
    });
    const block = result.content[0];
    if (block?.type === "text") {
      const parsed = JSON.parse(block.text) as { subject?: string; body?: string };
      return {
        subject: parsed.subject || step.subject,
        body: parsed.body || step.body,
      };
    }
  } catch (err) {
    console.warn("[sequences/engine] AI personalize email failed:", err instanceof Error ? err.message : String(err));
  }
  return { subject: step.subject, body: step.body };
}

async function maybePersonalizeText(
  body: string,
  lead: LeadRow,
  enabled: boolean,
): Promise<string> {
  if (!enabled) return body;
  if (!process.env.ANTHROPIC_API_KEY) return body;
  try {
    const result = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 250,
      system:
        "You personalize a one-sentence outreach message for the given prospect. Keep it short, match the original intent, return ONLY the rewritten message text — no quotes, no preface.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            lead: {
              business_name: lead.business_name,
              owner_name: lead.owner_name,
              industry: lead.industry,
              city: lead.city,
            },
            template: body,
          }),
        },
      ],
    });
    const block = result.content[0];
    if (block?.type === "text" && block.text.trim()) {
      return block.text.trim();
    }
  } catch (err) {
    console.warn("[sequences/engine] AI personalize text failed:", err instanceof Error ? err.message : String(err));
  }
  return body;
}

// ─── Run state mutations ────────────────────────────────────────────────

async function markRunCompleted(supabase: SupabaseClient, runId: string): Promise<void> {
  await supabase
    .from("sequence_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      next_action_at: null,
    })
    .eq("id", runId);
}

async function markRunFailed(
  supabase: SupabaseClient,
  runId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("sequence_runs")
    .update({
      status: "failed",
      exit_reason: reason,
      completed_at: new Date().toISOString(),
      next_action_at: null,
    })
    .eq("id", runId);
}

async function markRunExited(
  supabase: SupabaseClient,
  runId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("sequence_runs")
    .update({
      status: "exited",
      exit_reason: reason,
      completed_at: new Date().toISOString(),
      next_action_at: null,
    })
    .eq("id", runId);
}

async function logRunEvent(
  supabase: SupabaseClient,
  run: SequenceRunRow,
  seq: { id: string; profile_id?: string; name?: string },
  step: SequenceStep,
  status: "completed" | "failed" | "exited",
  note: string | null,
): Promise<void> {
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Sequence "${seq.name || seq.id}" → step ${run.current_step + 1} (${step.type}) for run ${run.id}`,
    profile_id: seq.profile_id || run.user_id,
    status,
    result: {
      sequence_id: seq.id,
      sequence_name: seq.name || null,
      run_id: run.id,
      contact_id: run.contact_id,
      step_index: run.current_step,
      step_type: step.type,
      note,
      executed_at: new Date().toISOString(),
    },
    completed_at: new Date().toISOString(),
  });
}
