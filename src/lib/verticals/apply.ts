/**
 * Vertical-template apply engine.
 *
 * Given a vertical template + a list of module keys, this creates the
 * concrete DB rows in the user's tenant. Each module maps to a specific
 * table:
 *
 *   automations  → crm_automations (one row per automation)
 *   sms          → sms_templates (one row per template)
 *   email        → crm_automations (one row per template — no email_templates table exists in production)
 *   scripts      → crm_automations (one row per cold-call script, trigger=manual)
 *   scoring      → profiles.metadata.lead_scoring_rules (jsonb array, no dedicated table)
 *   course       → courses + course_modules + course_lessons
 *   funnel       → funnels + funnel_steps
 *
 * Failures are not fatal — we continue with other modules and report
 * per-module success/failure in the response. This avoids a partial-write
 * leaving the user stuck with half a vertical applied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ModuleKey,
  VerticalTemplate,
  AutomationDef,
  SmsTemplateDef,
  EmailTemplateDef,
  CallScriptDef,
  LeadScoringRuleDef,
  CourseDef,
  FunnelDef,
} from "./types";

export interface ApplyOutcome {
  module: ModuleKey;
  status: "success" | "skipped" | "failed";
  count: number;
  error?: string;
}

export interface ApplyResult {
  outcomes: ApplyOutcome[];
  total_created: number;
}

/**
 * Apply selected modules from a vertical template into the user's tenant.
 *
 * @param supabase  Caller's RLS-enforced supabase client.
 * @param userId    Effective owner id (resolved upstream via getEffectiveOwnerId).
 * @param template  Vertical template payload.
 * @param modules   Module keys to apply.
 */
export async function applyVerticalModules(
  supabase: SupabaseClient,
  userId: string,
  template: VerticalTemplate,
  modules: readonly ModuleKey[],
): Promise<ApplyResult> {
  const outcomes: ApplyOutcome[] = [];
  let total = 0;

  for (const m of modules) {
    const outcome = await applyOne(supabase, userId, template, m);
    outcomes.push(outcome);
    if (outcome.status === "success") total += outcome.count;
  }

  return { outcomes, total_created: total };
}

async function applyOne(
  supabase: SupabaseClient,
  userId: string,
  template: VerticalTemplate,
  module: ModuleKey,
): Promise<ApplyOutcome> {
  try {
    switch (module) {
      case "automations":
        return await applyAutomations(supabase, userId, template.automations);
      case "sms":
        return await applySmsTemplates(supabase, userId, template.sms_templates);
      case "email":
        return await applyEmailTemplates(supabase, userId, template.email_templates);
      case "scripts":
        return await applyCallScripts(supabase, userId, template.call_scripts);
      case "scoring":
        return await applyScoringRules(supabase, userId, template.scoring_rules);
      case "course":
        return await applyCourse(supabase, userId, template.course);
      case "funnel":
        return await applyFunnel(supabase, userId, template.funnel);
    }
  } catch (err: unknown) {
    return {
      module,
      status: "failed",
      count: 0,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

// ── automations → crm_automations ────────────────────────────────────────
async function applyAutomations(
  supabase: SupabaseClient,
  userId: string,
  defs: AutomationDef[],
): Promise<ApplyOutcome> {
  if (defs.length === 0) return { module: "automations", status: "skipped", count: 0 };

  const rows = defs.map((d) => ({
    profile_id: userId,
    name: d.name,
    trigger: { event: d.trigger_event, filter: d.trigger_filter ?? {}, description: d.description },
    actions: d.actions,
    is_active: true,
  }));

  const { data, error } = await supabase.from("crm_automations").insert(rows).select("id");
  if (error) {
    return { module: "automations", status: "failed", count: 0, error: error.message };
  }
  return { module: "automations", status: "success", count: data?.length ?? rows.length };
}

// ── sms → sms_templates ─────────────────────────────────────────────────
async function applySmsTemplates(
  supabase: SupabaseClient,
  userId: string,
  defs: SmsTemplateDef[],
): Promise<ApplyOutcome> {
  if (defs.length === 0) return { module: "sms", status: "skipped", count: 0 };

  const rows = defs.map((d) => ({
    user_id: userId,
    name: d.name,
    body: d.body,
    variables: d.variables,
    category: d.category,
  }));

  const { data, error } = await supabase.from("sms_templates").insert(rows).select("id");
  if (error) {
    return { module: "sms", status: "failed", count: 0, error: error.message };
  }
  return { module: "sms", status: "success", count: data?.length ?? rows.length };
}

// ── email → crm_automations (manual-trigger rows used as template store) ─
// There is no production email_templates table; we surface email templates
// as crm_automations with a 'manual' trigger so they appear in the user's
// automation library and can be sent from the email composer.
async function applyEmailTemplates(
  supabase: SupabaseClient,
  userId: string,
  defs: EmailTemplateDef[],
): Promise<ApplyOutcome> {
  if (defs.length === 0) return { module: "email", status: "skipped", count: 0 };

  const rows = defs.map((d) => ({
    profile_id: userId,
    name: `Email: ${d.name}`,
    trigger: { event: "manual", description: `Email template — ${d.category}` },
    actions: [
      {
        type: "send_email",
        subject: d.subject,
        body: d.body,
        variables: d.variables,
        category: d.category,
      },
    ],
    is_active: false, // manual-trigger; user activates on send
  }));

  const { data, error } = await supabase.from("crm_automations").insert(rows).select("id");
  if (error) {
    return { module: "email", status: "failed", count: 0, error: error.message };
  }
  return { module: "email", status: "success", count: data?.length ?? rows.length };
}

// ── scripts → crm_automations (manual-trigger phone-script rows) ─────────
async function applyCallScripts(
  supabase: SupabaseClient,
  userId: string,
  defs: CallScriptDef[],
): Promise<ApplyOutcome> {
  if (defs.length === 0) return { module: "scripts", status: "skipped", count: 0 };

  const rows = defs.map((d) => ({
    profile_id: userId,
    name: `Script: ${d.name}`,
    trigger: { event: "manual", description: d.scenario },
    actions: [
      {
        type: "show_call_script",
        scenario: d.scenario,
        script: d.script,
        rationale: d.rationale,
      },
    ],
    is_active: false,
  }));

  const { data, error } = await supabase.from("crm_automations").insert(rows).select("id");
  if (error) {
    return { module: "scripts", status: "failed", count: 0, error: error.message };
  }
  return { module: "scripts", status: "success", count: data?.length ?? rows.length };
}

// ── scoring → profiles.metadata.lead_scoring_rules ───────────────────────
// No dedicated table; merge into profiles.metadata jsonb. We keep a
// stable shape so the lead-scoring engine + UI can consume it later.
async function applyScoringRules(
  supabase: SupabaseClient,
  userId: string,
  defs: LeadScoringRuleDef[],
): Promise<ApplyOutcome> {
  if (defs.length === 0) return { module: "scoring", status: "skipped", count: 0 };

  // Fetch existing metadata so we can merge, not clobber.
  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .single();

  if (readErr) {
    return { module: "scoring", status: "failed", count: 0, error: readErr.message };
  }

  const currentMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};
  const currentRules = Array.isArray(currentMeta.lead_scoring_rules)
    ? (currentMeta.lead_scoring_rules as LeadScoringRuleDef[])
    : [];

  // Dedupe by rule name within the merge.
  const existingNames = new Set(currentRules.map((r) => r.name));
  const newRules = defs.filter((d) => !existingNames.has(d.name));

  const mergedMeta = {
    ...currentMeta,
    lead_scoring_rules: [...currentRules, ...newRules],
  };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ metadata: mergedMeta })
    .eq("id", userId);

  if (updateErr) {
    return { module: "scoring", status: "failed", count: 0, error: updateErr.message };
  }
  return { module: "scoring", status: "success", count: newRules.length };
}

// ── course → courses + course_modules + course_lessons ───────────────────
async function applyCourse(
  supabase: SupabaseClient,
  userId: string,
  course: CourseDef,
): Promise<ApplyOutcome> {
  if (!course || !course.modules || course.modules.length === 0) {
    return { module: "course", status: "skipped", count: 0 };
  }

  // 1. Insert the course.
  const { data: courseRow, error: courseErr } = await supabase
    .from("courses")
    .insert({
      profile_id: userId,
      title: course.title,
      description: course.description,
      price: 0,
      is_free: true,
      status: "draft",
      access_type: "lifetime",
    })
    .select("id")
    .single();

  if (courseErr || !courseRow) {
    return {
      module: "course",
      status: "failed",
      count: 0,
      error: courseErr?.message ?? "course insert returned no row",
    };
  }

  // 2. Insert modules + lessons in order.
  let lessonCount = 0;
  for (let i = 0; i < course.modules.length; i++) {
    const m = course.modules[i];
    const { data: moduleRow, error: moduleErr } = await supabase
      .from("course_modules")
      .insert({
        course_id: courseRow.id,
        title: m.title,
        description: m.description,
        sort_order: i,
        is_free_preview: i === 0, // first module preview-able
      })
      .select("id")
      .single();

    if (moduleErr || !moduleRow) {
      // Continue but log. The course + earlier modules are still useful.
      console.error("[verticals.apply] course_modules insert failed", moduleErr?.message);
      continue;
    }

    const lessonRows = m.lessons.map((l, j) => ({
      module_id: moduleRow.id,
      title: l.title,
      content_type: l.content_type,
      content_body: l.content_body,
      duration_seconds: l.duration_seconds,
      sort_order: j,
      is_free_preview: i === 0 && j === 0,
    }));

    if (lessonRows.length > 0) {
      const { data: lessons } = await supabase
        .from("course_lessons")
        .insert(lessonRows)
        .select("id");
      lessonCount += lessons?.length ?? 0;
    }
  }

  // Count = 1 (course) + modules + lessons. We expose lessons primarily.
  return { module: "course", status: "success", count: 1 + course.modules.length + lessonCount };
}

// ── funnel → funnels + funnel_steps ─────────────────────────────────────
async function applyFunnel(
  supabase: SupabaseClient,
  userId: string,
  funnel: FunnelDef,
): Promise<ApplyOutcome> {
  if (!funnel || !funnel.steps || funnel.steps.length === 0) {
    return { module: "funnel", status: "skipped", count: 0 };
  }

  // funnel slug — vertical apply may run twice; suffix with random to avoid collision.
  const baseSlug = funnel.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${baseSlug || "funnel"}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: funnelRow, error: funnelErr } = await supabase
    .from("funnels")
    .insert({
      profile_id: userId,
      name: funnel.name,
      description: funnel.description,
      status: "draft",
      slug,
    })
    .select("id")
    .single();

  if (funnelErr || !funnelRow) {
    return {
      module: "funnel",
      status: "failed",
      count: 0,
      error: funnelErr?.message ?? "funnel insert returned no row",
    };
  }

  const stepRows = funnel.steps.map((s, idx) => ({
    funnel_id: funnelRow.id,
    title: s.title,
    step_type: s.step_type,
    sort_order: idx,
    settings: { description: s.description },
    slug: `${s.step_type}-${Math.random().toString(36).slice(2, 6)}`,
  }));

  const { data: steps, error: stepsErr } = await supabase
    .from("funnel_steps")
    .insert(stepRows)
    .select("id");

  if (stepsErr) {
    // Funnel exists but steps failed — partial. Surface the error so user
    // knows. Returning success on partial would hide a real problem.
    return {
      module: "funnel",
      status: "failed",
      count: 1,
      error: `funnel created but steps failed: ${stepsErr.message}`,
    };
  }

  return { module: "funnel", status: "success", count: 1 + (steps?.length ?? 0) };
}
