/**
 * Multi-channel sequence step types — the shapes that live inside
 * `sequences.steps_json` (jsonb). The cron runner walks this graph one
 * step per tick per active run.
 *
 * Channels: email · sms · dm · voice_call · wait
 * Control flow: branch · exit_if · tag
 *
 * Why a discriminated union here (and not a class hierarchy):
 *   - Steps live in jsonb on the DB. They serialise as plain objects.
 *   - The runner does an exhaustive `switch (step.type)` — TypeScript's
 *     `never` fallthrough catches missing cases at compile time.
 *
 * Backward compat: when `sequences.steps_json` is null we fall back to
 * the legacy `sequence_steps` table (channel/template_body/template_subject
 * shape). See `loadStepsForSequence()` in engine.ts.
 */

export type DmPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "x"
  | "tiktok";

export interface EmailStep {
  type: "email";
  /** Optional reference to a saved template — currently unused; templates inline via subject + body. */
  template_id?: string | null;
  subject?: string;
  body: string;
  /** Personalize the subject + body with Claude before sending. */
  ai_personalize?: boolean;
  /** Minutes to wait before this step fires (relative to the previous step or enrollment). */
  delay_minutes: number;
}

export interface SmsStep {
  type: "sms";
  body: string;
  ai_personalize?: boolean;
  delay_minutes: number;
}

export interface DmStep {
  type: "dm";
  platform: DmPlatform;
  body: string;
  ai_personalize?: boolean;
  delay_minutes: number;
}

export interface VoiceCallStep {
  type: "voice_call";
  /** Reference to a saved call script; currently unused (we just queue an outreach_log row for human dispatch). */
  script_id?: string | null;
  /** Optional plaintext talking points for the agency rep. */
  notes?: string;
  delay_minutes: number;
}

export interface WaitStep {
  type: "wait";
  delay_minutes: number;
}

/** Operators supported in branch / exit_if conditions. */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists";

export interface StepCondition {
  /** Lead column or run-state path: e.g. "lead.industry", "run.replied", "run.opened_email". */
  field: string;
  operator: ConditionOperator;
  /** Value to compare against. Strings are compared case-insensitively for equals/contains. */
  value?: string | number | boolean | null;
}

export interface BranchStep {
  type: "branch";
  condition: StepCondition;
  /** Steps to execute if the condition is true. v2 — the runner currently inlines these into the linear flow. */
  if_true: SequenceStep[];
  if_false: SequenceStep[];
}

export interface ExitIfStep {
  type: "exit_if";
  condition: StepCondition;
  /** Reason logged to sequence_runs.exit_reason when the condition triggers. */
  reason?: string;
}

export interface TagStep {
  type: "tag";
  action: "add" | "remove";
  /** Tag identifier — text label, no FK enforcement (tags table is optional). */
  tag_id: string;
}

export type SequenceStep =
  | EmailStep
  | SmsStep
  | DmStep
  | VoiceCallStep
  | WaitStep
  | BranchStep
  | ExitIfStep
  | TagStep;

export type SequenceRunStatus =
  | "active"
  | "paused"
  | "completed"
  | "exited"
  | "failed";

export interface SequenceRunRow {
  id: string;
  user_id: string;
  sequence_id: string;
  contact_id: string | null;
  current_step: number;
  next_action_at: string | null;
  status: SequenceRunStatus;
  channel_state: Record<string, unknown>;
  enrolled_at: string;
  completed_at: string | null;
  exit_reason: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Type guard — narrow an unknown jsonb step into our union. Returns null on
 * anything that doesn't match a known type. Used by the runner to defensively
 * skip malformed steps rather than crashing the whole tick.
 */
export function asSequenceStep(raw: unknown): SequenceStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const t = r.type;
  if (t === "email" || t === "sms" || t === "dm") {
    if (typeof r.body !== "string") return null;
    return raw as SequenceStep;
  }
  if (t === "voice_call" || t === "wait" || t === "branch" || t === "exit_if" || t === "tag") {
    return raw as SequenceStep;
  }
  return null;
}

/**
 * Total minutes-from-enrollment a step contributes. Wait + delay_minutes on
 * any sendable step both count. branch/exit_if/tag are zero-cost.
 */
export function stepDelayMinutes(step: SequenceStep): number {
  if (step.type === "wait") return Math.max(0, step.delay_minutes);
  if (
    step.type === "email" ||
    step.type === "sms" ||
    step.type === "dm" ||
    step.type === "voice_call"
  ) {
    return Math.max(0, step.delay_minutes);
  }
  return 0;
}
