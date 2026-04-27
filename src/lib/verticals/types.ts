/**
 * Shared types for vertical SaaS template content.
 *
 * Vertical templates are pre-configured ShortStack OS bundles for specific
 * agency niches (Real Estate, Coaches, E-commerce). Each template defines
 * the automations, content, scripts, lead-scoring rules, course modules,
 * and funnel steps an agency in that niche typically needs day one.
 *
 * Templates live in code (this directory) — easier to maintain, version,
 * and code-review than DB rows. Apply-history is tracked in
 * `vertical_applies` so we can show "what's already applied".
 */

export type VerticalKey = "real_estate" | "coaches" | "ecommerce";

export type ModuleKey =
  | "automations"
  | "sms"
  | "email"
  | "scripts"
  | "scoring"
  | "course"
  | "funnel";

/** A CRM automation (rule-based: trigger → actions). Maps to crm_automations. */
export interface AutomationDef {
  name: string;
  description: string;
  /** Rule key the workflow engine knows. */
  trigger_event: string;
  /** Optional structured filter — kept narrow on purpose. */
  trigger_filter?: Record<string, unknown>;
  /** Action steps: send_email | send_sms | wait_minutes | tag_lead | assign_to | webhook. */
  actions: Array<Record<string, unknown>>;
}

/** A reusable SMS template. Maps to sms_templates. */
export interface SmsTemplateDef {
  name: string;
  body: string;
  category: string;
  /** Mustache-style variable names referenced in body, e.g. ["first_name"]. */
  variables: string[];
}

/** A reusable email template. Stored as JSON nodes inside crm_automations
 *  for now (no dedicated email_templates table exists in production yet —
 *  see MEMORY: agencies use the AI Copywriter + sequences). We surface
 *  these as automation steps so they appear in the user's workflow inbox. */
export interface EmailTemplateDef {
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
}

/** A cold-call / phone script. Persisted as a crm_automation row with
 *  trigger='manual' so reps can launch from the dialer. */
export interface CallScriptDef {
  name: string;
  scenario: string;
  /** Plain-text script body with {{variable}} placeholders. */
  script: string;
  /** Why this script works — used as the description when surfaced. */
  rationale: string;
}

/** A lead-scoring rule. Stored on the user's profile.metadata.lead_scoring
 *  bucket since there is no dedicated rules table. The lead-scoring engine
 *  in src/lib/lead-scoring.ts is AI-based; these are editorial guides /
 *  bonuses an admin can review. */
export interface LeadScoringRuleDef {
  name: string;
  /** Plain-English signal description. */
  signal: string;
  /** Score adjustment: positive boosts, negative penalises. */
  score_delta: number;
  /** Which scoring dimension (per ScoreBreakdown in lead-scoring.ts). */
  dimension: "fit" | "intent" | "urgency" | "data_quality";
}

/** A course module + its lessons. Maps to course_modules + course_lessons. */
export interface CourseLessonDef {
  title: string;
  /** "video" | "text" | "audio" — matches course_lessons.content_type. */
  content_type: "video" | "text" | "audio";
  duration_seconds: number;
  /** Lesson body for text lessons; for video/audio this is a description. */
  content_body: string;
}

export interface CourseModuleDef {
  title: string;
  description: string;
  lessons: CourseLessonDef[];
}

export interface CourseDef {
  title: string;
  description: string;
  modules: CourseModuleDef[];
}

/** A funnel step. Maps to funnel_steps. */
export interface FunnelStepDef {
  title: string;
  /** "opt-in" | "qualifier" | "call" | "checkout" | "thank-you" | etc. */
  step_type: string;
  /** Description shown in the funnel builder. */
  description: string;
}

export interface FunnelDef {
  name: string;
  description: string;
  steps: FunnelStepDef[];
}

/** Full vertical template payload. */
export interface VerticalTemplate {
  vertical: VerticalKey;
  display_name: string;
  /** One-line tagline. */
  tagline: string;
  /** Longer description for the detail page. */
  description: string;
  /** Hero accent gradient — matches PageHero presets. */
  accent: "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";
  /** Lucide icon name. */
  icon: string;
  /** Optional preview image URL (none for now — placeholder gradient used). */
  preview_image?: string;

  // Module bundles. Each module is independently applyable.
  automations: AutomationDef[];
  sms_templates: SmsTemplateDef[];
  email_templates: EmailTemplateDef[];
  call_scripts: CallScriptDef[];
  scoring_rules: LeadScoringRuleDef[];
  course: CourseDef;
  funnel: FunnelDef;
}

/** Counts shown on the apply-confirmation step. */
export interface VerticalCounts {
  automations: number;
  sms: number;
  email: number;
  scripts: number;
  scoring: number;
  course_modules: number;
  course_lessons: number;
  funnel_steps: number;
}

export function countVertical(t: VerticalTemplate): VerticalCounts {
  const lessonTotal = t.course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  return {
    automations: t.automations.length,
    sms: t.sms_templates.length,
    email: t.email_templates.length,
    scripts: t.call_scripts.length,
    scoring: t.scoring_rules.length,
    course_modules: t.course.modules.length,
    course_lessons: lessonTotal,
    funnel_steps: t.funnel.steps.length,
  };
}

/** Whitelist of valid module keys, used by the apply route to validate input. */
export const ALLOWED_MODULES: readonly ModuleKey[] = [
  "automations",
  "sms",
  "email",
  "scripts",
  "scoring",
  "course",
  "funnel",
] as const;

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (ALLOWED_MODULES as readonly string[]).includes(value);
}

export function isVerticalKey(value: unknown): value is VerticalKey {
  return value === "real_estate" || value === "coaches" || value === "ecommerce";
}
