/**
 * Autonomous Lead Pipeline Engine
 *
 * Drives a lead through the full client acquisition lifecycle:
 *   new → scored → contacted → proposal_sent → invoiced → paid → delivered
 *
 * State is stored in trinity_log (action_type = "pipeline") so no new
 * migration is needed. Each stage transition creates a trinity_action
 * proposal (proposed status) for human review on review-required steps,
 * or executes automatically for AI-only steps.
 *
 * The engine never throws on the public surface — it returns PipelineResult.
 *
 * Integration points:
 *   POST /api/n8n/pipeline  { action: "advance", leadId }
 *   Cron or n8n webhook can call the route above on a schedule.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callLLMTraced } from "@/lib/ai/llm-router";

// ── Stage machine ────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  "new",
  "scored",
  "contacted",
  "proposal_sent",
  "invoiced",
  "paid",
  "delivered",
  "closed_lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Score threshold below which we don't auto-contact (too cold).
const AUTO_CONTACT_SCORE_THRESHOLD = 60;

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface LeadSnapshot {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  lead_score?: number | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PipelineContext {
  lead: LeadSnapshot;
  ownerId: string;
  supabase: SupabaseClient;
}

export interface PipelineResult {
  ok: boolean;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  action: string;
  detail?: Record<string, unknown>;
  error?: string;
}

// ── Stage reader (from trinity_log audit trail) ─────────────────────────────

export async function getLeadPipelineStage(
  supabase: SupabaseClient,
  leadId: string,
): Promise<PipelineStage> {
  const { data } = await supabase
    .from("trinity_log")
    .select("result")
    .eq("client_id", leadId)
    .eq("action_type", "pipeline")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stage = (
    data?.result as Record<string, unknown> | null
  )?.pipeline_stage as PipelineStage | undefined;

  return PIPELINE_STAGES.includes(stage as PipelineStage) ? (stage as PipelineStage) : "new";
}

export async function getLeadPipelineHistory(
  supabase: SupabaseClient,
  leadId: string,
): Promise<Array<{ stage: PipelineStage; action: string; created_at: string; detail: Record<string, unknown> }>> {
  const { data } = await supabase
    .from("trinity_log")
    .select("result, created_at")
    .eq("client_id", leadId)
    .eq("action_type", "pipeline")
    .order("created_at", { ascending: true });

  return (data || []).map((row) => {
    const result = (row.result as Record<string, unknown>) || {};
    return {
      stage: (result.pipeline_stage as PipelineStage) || "new",
      action: (result.action as string) || "unknown",
      created_at: row.created_at as string,
      detail: result,
    };
  });
}

// ── Shared helpers ──────────────────────────────────────────────────────────

async function logTransition(
  supabase: SupabaseClient,
  leadId: string,
  fromStage: PipelineStage,
  toStage: PipelineStage,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("trinity_log").insert({
    action_type: "pipeline",
    description: `Pipeline ${fromStage} → ${toStage} (${action})`,
    client_id: leadId,
    status: "completed",
    result: { pipeline_stage: toStage, from_stage: fromStage, action, ...detail },
  });
}

/**
 * Creates a trinity_action proposal for a human-review step.
 * Uses status="proposed" — the owner approves/vetoes from the Trinity UI.
 */
async function proposeAction(
  supabase: SupabaseClient,
  ownerId: string,
  leadId: string,
  actionType: string,
  proposedAction: string,
  rationale: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("trinity_actions").insert({
    user_id: ownerId,
    action_type: actionType,
    context: { lead_id: leadId, ...context },
    proposed_action: proposedAction,
    rationale,
    status: "proposed",
  });
}

// ── Stage handlers ───────────────────────────────────────────────────────────

async function handleNew(ctx: PipelineContext, fromStage: PipelineStage): Promise<PipelineResult> {
  const { lead, ownerId, supabase } = ctx;
  const score = lead.lead_score ?? 0;

  // AI lead classification — hot / warm / cold
  let assessment: Record<string, unknown> = {};
  try {
    const llmResult = await callLLMTraced({
      surface: "pipeline_lead_assess",
      taskType: "simple_classification",
      userId: ownerId,
      context: `lead:${lead.id}`,
      humanize: false,
      systemPrompt:
        "You are a sales qualification AI. Classify leads quickly. Return ONLY valid JSON, no commentary.",
      userPrompt: `Classify this lead:
Name: ${lead.name || "unknown"}
Business: ${lead.business_name || "unknown"}
Industry: ${lead.industry || "unknown"}
Lead score: ${score}

Return: {"classification":"hot|warm|cold","confidence":0-100,"priority_action":"one sentence recommendation"}`,
      maxTokens: 150,
    });
    const match = (llmResult.text || "").match(/\{[\s\S]*?\}/);
    if (match) assessment = JSON.parse(match[0]);
  } catch {
    // Soft-fail — assessment stays empty
  }

  const toStage: PipelineStage = "scored";
  await logTransition(supabase, lead.id, fromStage, toStage, "ai_classify", { assessment, score });

  // Update lead status
  await supabase
    .from("leads")
    .update({ status: "qualified" })
    .eq("id", lead.id);

  return { ok: true, fromStage, toStage, action: "ai_classify", detail: { assessment, score } };
}

async function handleScored(ctx: PipelineContext, fromStage: PipelineStage): Promise<PipelineResult> {
  const { lead, ownerId, supabase } = ctx;
  const score = lead.lead_score ?? 0;

  if (score < AUTO_CONTACT_SCORE_THRESHOLD) {
    return {
      ok: true,
      fromStage,
      toStage: fromStage,
      action: "score_below_threshold",
      detail: {
        score,
        threshold: AUTO_CONTACT_SCORE_THRESHOLD,
        message: `Score ${score} < ${AUTO_CONTACT_SCORE_THRESHOLD}. Add to nurture sequence or manually review.`,
      },
    };
  }

  // AI first-touch draft
  let messageDraft = "";
  try {
    const llmResult = await callLLMTraced({
      surface: "pipeline_first_touch",
      taskType: "generation_short",
      userId: ownerId,
      context: `lead:${lead.id}`,
      humanize: true,
      systemPrompt:
        "You are a sales outreach specialist. Write punchy, personalized outreach — no fluff, no generic phrases.",
      userPrompt: `Write a first-touch outreach email for:
Prospect: ${lead.name || "there"}
Company: ${lead.business_name || "their company"}
Industry: ${lead.industry || "their industry"}
Score: ${score}/100

Format: Start with "Subject: ..." then the email body.
Rules: Under 100 words, specific to their industry, value-first, soft CTA for a quick chat.`,
      maxTokens: 250,
    });
    messageDraft = llmResult.text || "";
  } catch {
    messageDraft = "";
  }

  // Propose a trinity action for the owner to review/send
  await proposeAction(
    supabase,
    ownerId,
    lead.id,
    "launch_followup_email",
    `Send first-touch to ${lead.name || lead.email || "lead"} (score ${score})`,
    `Hot lead scored ${score}/100. AI-drafted outreach ready. Reach out before they find a competitor.`,
    { lead_score: score, message_draft: messageDraft },
  );

  const toStage: PipelineStage = "contacted";
  await logTransition(supabase, lead.id, fromStage, toStage, "first_touch_drafted", { message_draft: messageDraft, score });

  await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);

  return {
    ok: true,
    fromStage,
    toStage,
    action: "first_touch_drafted",
    detail: { message_draft: messageDraft },
  };
}

async function handleContacted(ctx: PipelineContext, fromStage: PipelineStage): Promise<PipelineResult> {
  const { lead, ownerId, supabase } = ctx;

  // AI proposal draft
  let proposalDraft = "";
  try {
    const llmResult = await callLLMTraced({
      surface: "pipeline_proposal_draft",
      taskType: "generation_long",
      userId: ownerId,
      context: `lead:${lead.id}`,
      humanize: true,
      systemPrompt:
        "You are a proposal writer for a digital marketing agency. Write results-focused, concise proposals.",
      userPrompt: `Draft a proposal for:
Client: ${lead.name || "prospect"}
Business: ${lead.business_name || "their company"}
Industry: ${lead.industry || "their industry"}

Sections (keep total under 350 words):
1. Executive Summary — why this matters to them (2-3 sentences)
2. Proposed Services — 3 bullet points
3. Expected Outcomes — concrete results with timeframes
4. Investment — use placeholder [MONTHLY_RETAINER]
5. Next Steps — one clear CTA`,
      maxTokens: 600,
    });
    proposalDraft = llmResult.text || "";
  } catch {
    proposalDraft = "";
  }

  await proposeAction(
    supabase,
    ownerId,
    lead.id,
    "generate_content_plan",
    `Review & send proposal to ${lead.name || lead.business_name || "lead"}`,
    "Lead has responded. Proposal drafted — review, add pricing, and send to close.",
    { proposal_draft: proposalDraft },
  );

  const toStage: PipelineStage = "proposal_sent";
  await logTransition(supabase, lead.id, fromStage, toStage, "proposal_drafted", { proposal_draft: proposalDraft });

  return {
    ok: true,
    fromStage,
    toStage,
    action: "proposal_drafted",
    detail: { proposal_draft: proposalDraft },
  };
}

async function handlePaid(ctx: PipelineContext, fromStage: PipelineStage): Promise<PipelineResult> {
  const { lead, ownerId, supabase } = ctx;

  // AI delivery plan
  let deliveryPlan = "";
  try {
    const llmResult = await callLLMTraced({
      surface: "pipeline_delivery_plan",
      taskType: "generation_long",
      userId: ownerId,
      context: `lead:${lead.id}`,
      humanize: false,
      systemPrompt:
        "You are a project manager for a digital marketing agency. Create actionable delivery plans.",
      userPrompt: `Create a 30-day delivery plan for new client:
Business: ${lead.business_name || "new client"}
Industry: ${lead.industry || "their industry"}

Include:
- Week 1: Onboarding + discovery tasks
- Week 2: First content batch + account setup
- Week 3-4: Campaign launch + first report
- Key checkpoints

Return as a structured bullet list.`,
      maxTokens: 500,
    });
    deliveryPlan = llmResult.text || "";
  } catch {
    deliveryPlan = "";
  }

  await proposeAction(
    supabase,
    ownerId,
    lead.id,
    "morning_brief",
    `Onboard new client: ${lead.business_name || lead.name || "new client"}`,
    "Payment cleared. 30-day delivery plan ready — kick off onboarding.",
    { delivery_plan: deliveryPlan },
  );

  // Emit to Pixel Office — fire-and-forget, never blocks the pipeline.
  try {
    await supabase
      .from("agent_activity_events")
      .insert({
        agency_owner_id: ownerId,
        agent_key: "trinity",
        event_type: "deal_won",
        summary: `Deal won: ${lead.business_name || lead.name || "new client"} — pipeline complete`,
        metadata: { lead_id: lead.id },
      });
  } catch {
    // Non-fatal — Pixel Office event loss is acceptable.
  }

  const toStage: PipelineStage = "delivered";
  await logTransition(supabase, lead.id, fromStage, toStage, "delivery_triggered", { delivery_plan: deliveryPlan });

  await supabase.from("leads").update({ status: "won" }).eq("id", lead.id);

  return {
    ok: true,
    fromStage,
    toStage,
    action: "delivery_triggered",
    detail: { delivery_plan: deliveryPlan },
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Advance a lead one step through the pipeline.
 *
 * Idempotent for waiting stages (contacted/proposal_sent/invoiced/delivered).
 * The caller is responsible for rate-limiting — call this once per event,
 * not in a tight loop.
 */
export async function advancePipeline(ctx: PipelineContext): Promise<PipelineResult> {
  const { lead, supabase } = ctx;

  let fromStage: PipelineStage = "new";
  try {
    fromStage = await getLeadPipelineStage(supabase, lead.id);
  } catch {
    // Default to "new" on read failure
  }

  try {
    switch (fromStage) {
      case "new":
        return handleNew(ctx, fromStage);
      case "scored":
        return handleScored(ctx, fromStage);
      case "contacted":
        return handleContacted(ctx, fromStage);
      case "proposal_sent":
        return {
          ok: true,
          fromStage,
          toStage: fromStage,
          action: "waiting_for_acceptance",
          detail: { message: "Proposal sent. Waiting for lead to accept. Advance manually once accepted." },
        };
      case "invoiced":
        return {
          ok: true,
          fromStage,
          toStage: fromStage,
          action: "waiting_for_payment",
          detail: { message: "Invoice sent. Waiting for payment. Advance manually (or via Stripe webhook) once paid." },
        };
      case "paid":
        return handlePaid(ctx, fromStage);
      case "delivered":
        return {
          ok: true,
          fromStage,
          toStage: fromStage,
          action: "complete",
          detail: { message: "Pipeline complete. Client is active." },
        };
      case "closed_lost":
        return {
          ok: true,
          fromStage,
          toStage: fromStage,
          action: "closed_lost",
          detail: { message: "Lead closed as lost." },
        };
    }
  } catch (err) {
    return {
      ok: false,
      fromStage,
      toStage: fromStage,
      action: "error",
      error: String(err),
    };
  }
}

/**
 * Force a specific pipeline stage (bypasses normal advancement logic).
 * Use when an external event fires (e.g. Stripe payment_succeeded, proposal accepted).
 */
export async function forceStage(
  supabase: SupabaseClient,
  leadId: string,
  newStage: PipelineStage,
  reason: string,
): Promise<void> {
  const currentStage = await getLeadPipelineStage(supabase, leadId);
  await logTransition(supabase, leadId, currentStage, newStage, "force_stage", { reason });
}
