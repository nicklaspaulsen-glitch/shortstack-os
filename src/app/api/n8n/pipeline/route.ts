/**
 * /api/n8n/pipeline
 *
 * Exposes the autonomous lead pipeline engine to external callers
 * (n8n webhooks, Stripe webhooks, manual UI triggers, cron jobs).
 *
 * Operators only — clients are blocked (fail-closed on missing profile).
 *
 * ── Actions (POST) ──────────────────────────────────────────────────────────
 *
 *  advance      { action: "advance", leadId }
 *               Advance a lead one step through the pipeline.
 *               Idempotent on waiting stages (proposal_sent, invoiced, delivered).
 *
 *  force_stage  { action: "force_stage", leadId, stage, reason }
 *               Jump directly to a specific stage. Used for external events:
 *                 • Stripe payment_succeeded  → force to "paid"
 *                 • Proposal signed           → force to "invoiced"
 *               Any valid PipelineStage value is accepted.
 *
 *  deploy       { action: "deploy" }
 *               AI-design + deploy an n8n workflow that fires this route's
 *               "advance" action on a schedule (hourly) for all active leads.
 *               Requires N8N_URL + N8N_API_KEY env vars to actually deploy;
 *               returns the workflow JSON either way for inspection.
 *
 * ── Query (GET) ─────────────────────────────────────────────────────────────
 *
 *  GET ?leadId=xxx
 *               Return current pipeline stage + full stage history for a lead.
 *
 * ── n8n integration note ────────────────────────────────────────────────────
 *
 *  n8n webhook → POST /api/n8n/pipeline { action: "advance", leadId: "{{leadId}}" }
 *  Header: Authorization: Bearer <CRON_SECRET>  (or API key header)
 *
 *  The deploy action stamps the callback URL into the n8n HTTP Request node
 *  so the workflow is self-wired without manual configuration.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  advancePipeline,
  forceStage,
  getLeadPipelineStage,
  getLeadPipelineHistory,
  PIPELINE_STAGES,
  type PipelineStage,
  type LeadSnapshot,
} from "@/lib/ai/pipeline-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pipeline stages that involve LLM calls can take a few seconds each.
export const maxDuration = 60;

// ── Auth helper (mirrors the pattern in /api/n8n/workflows) ─────────────────

async function getOperatorContext(supabase: ReturnType<typeof createServerSupabase>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401, user: null, ownerId: null };

  // Fail-closed on missing profile, block clients.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role === "client") {
    return { error: "Operators only", status: 403, user: null, ownerId: null };
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return { error: "Forbidden", status: 403, user: null, ownerId: null };
  }

  return { error: null, status: 200, user, ownerId };
}

// ── Lead loader ──────────────────────────────────────────────────────────────

async function loadLead(
  supabase: ReturnType<typeof createServerSupabase>,
  ownerId: string,
  leadId: string,
): Promise<LeadSnapshot | null> {
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, business_name, industry, lead_score, status, metadata",
    )
    .eq("id", leadId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    name: (data.name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    business_name: (data.business_name as string | null) ?? null,
    industry: (data.industry as string | null) ?? null,
    lead_score: (data.lead_score as number | null) ?? null,
    status: (data.status as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
  };
}

// ── n8n workflow JSON for the full-lifecycle pipeline ───────────────────────

/**
 * Build a minimal but runnable n8n workflow that hits /api/n8n/pipeline
 * every hour for each un-closed lead.
 *
 * Two paths:
 *  1. Cron (Schedule Trigger) → HTTP Request to /api/leads (all active leads)
 *     → Loop over leads → HTTP Request to /api/n8n/pipeline { action: "advance" }
 *  2. Webhook node (n8n native) accepts Stripe / proposal callbacks
 *     → HTTP Request to /api/n8n/pipeline { action: "force_stage" }
 *
 * The APP_URL env var is stamped in; falls back to app.shortstack.work.
 */
function buildPipelineWorkflowJSON(appUrl: string): Record<string, unknown> {
  const base = appUrl.replace(/\/$/, "");

  return {
    name: "ShortStack — Full Client Acquisition Pipeline",
    nodes: [
      // ── Trigger: every hour ──────────────────────────────────────────────
      {
        id: "trigger-cron",
        name: "Schedule (hourly)",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1,
        position: [0, 0],
        parameters: {
          rule: { interval: [{ field: "hours", minutesInterval: 1 }] },
        },
      },
      // ── Fetch all active leads from ShortStack ───────────────────────────
      {
        id: "fetch-leads",
        name: "Fetch active leads",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position: [200, 0],
        parameters: {
          method: "GET",
          url: `${base}/api/leads?status=active&limit=100`,
          authentication: "genericCredentialType",
          genericAuthType: "httpHeaderAuth",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "x-api-key", value: "={{$env.SHORTSTACK_API_KEY}}" },
            ],
          },
          options: { response: { response: { responseFormat: "json" } } },
        },
      },
      // ── Split items so each lead processes individually ──────────────────
      {
        id: "split-leads",
        name: "Split leads",
        type: "n8n-nodes-base.splitInBatches",
        typeVersion: 3,
        position: [400, 0],
        parameters: { batchSize: 1, options: {} },
      },
      // ── Advance each lead one pipeline step ──────────────────────────────
      {
        id: "advance-pipeline",
        name: "Advance pipeline",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position: [600, 0],
        parameters: {
          method: "POST",
          url: `${base}/api/n8n/pipeline`,
          authentication: "genericCredentialType",
          genericAuthType: "httpHeaderAuth",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "x-api-key", value: "={{$env.SHORTSTACK_API_KEY}}" },
            ],
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "action", value: "advance" },
              { name: "leadId", value: "={{$json.id}}" },
            ],
          },
          options: {
            response: { response: { responseFormat: "json" } },
            timeout: 30000,
          },
        },
      },
      // ── Webhook: external events (Stripe, proposals) ─────────────────────
      {
        id: "webhook-events",
        name: "External events webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [0, 200],
        webhookId: "pipeline-events",
        parameters: {
          path: "pipeline-events",
          responseMode: "responseNode",
          options: {},
        },
      },
      // ── Parse event and force the correct stage ───────────────────────────
      {
        id: "force-stage",
        name: "Force pipeline stage",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position: [200, 200],
        parameters: {
          method: "POST",
          url: `${base}/api/n8n/pipeline`,
          authentication: "genericCredentialType",
          genericAuthType: "httpHeaderAuth",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "x-api-key", value: "={{$env.SHORTSTACK_API_KEY}}" },
            ],
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "action", value: "force_stage" },
              { name: "leadId", value: "={{$json.body.leadId}}" },
              { name: "stage", value: "={{$json.body.stage}}" },
              { name: "reason", value: "={{$json.body.reason}}" },
            ],
          },
          options: {
            response: { response: { responseFormat: "json" } },
            timeout: 15000,
          },
        },
      },
      // ── Webhook response ─────────────────────────────────────────────────
      {
        id: "webhook-response",
        name: "Webhook response",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [400, 200],
        parameters: {
          respondWith: "lastNode",
          options: {},
        },
      },
    ],
    connections: {
      "Schedule (hourly)": {
        main: [[{ node: "Fetch active leads", type: "main", index: 0 }]],
      },
      "Fetch active leads": {
        main: [[{ node: "Split leads", type: "main", index: 0 }]],
      },
      "Split leads": {
        main: [[{ node: "Advance pipeline", type: "main", index: 0 }]],
      },
      "External events webhook": {
        main: [[{ node: "Force pipeline stage", type: "main", index: 0 }]],
      },
      "Force pipeline stage": {
        main: [[{ node: "Webhook response", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
      saveManualExecutions: true,
      callerPolicy: "workflowsFromSameOwner",
    },
  };
}

// ── GET — stage + history for a single lead ──────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const ctx = await getOperatorContext(supabase);
  if (ctx.error) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId query param required" }, { status: 400 });
  }

  // Verify the lead belongs to this owner.
  const lead = await loadLead(supabase, ctx.ownerId!, leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const [stage, history] = await Promise.all([
    getLeadPipelineStage(supabase, leadId),
    getLeadPipelineHistory(supabase, leadId),
  ]);

  return NextResponse.json({
    ok: true,
    leadId,
    stage,
    history,
    stages: PIPELINE_STAGES,
  });
}

// ── POST — advance / force_stage / deploy ────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const ctx = await getOperatorContext(supabase);
  if (ctx.error) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string | undefined;

  // ── action: advance ──────────────────────────────────────────────────────
  if (action === "advance") {
    const leadId = body.leadId as string | undefined;
    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    const lead = await loadLead(supabase, ctx.ownerId!, leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const result = await advancePipeline({ lead, ownerId: ctx.ownerId!, supabase });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // ── action: force_stage ──────────────────────────────────────────────────
  if (action === "force_stage") {
    const leadId = body.leadId as string | undefined;
    const stage = body.stage as PipelineStage | undefined;
    const reason = (body.reason as string | undefined) ?? "external_event";

    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }
    if (!stage || !PIPELINE_STAGES.includes(stage)) {
      return NextResponse.json(
        {
          error: `stage must be one of: ${PIPELINE_STAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Verify ownership before forcing.
    const lead = await loadLead(supabase, ctx.ownerId!, leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await forceStage(supabase, leadId, stage, reason);

    // If we just forced to "paid", run handlePaid immediately to kick off
    // delivery — no need for the caller to fire a second "advance" request.
    if (stage === "paid") {
      const result = await advancePipeline({ lead: { ...lead, status: "paid" }, ownerId: ctx.ownerId!, supabase });
      return NextResponse.json({ ok: true, forced: true, stage, advanced: result });
    }

    return NextResponse.json({ ok: true, forced: true, stage });
  }

  // ── action: deploy ───────────────────────────────────────────────────────
  if (action === "deploy") {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://app.shortstack.work";

    const workflowJson = buildPipelineWorkflowJSON(appUrl);

    const n8nUrl = process.env.N8N_URL ?? "";
    const n8nKey = process.env.N8N_API_KEY ?? "";

    let deployed = false;
    let n8nId: string | null = null;
    let deployError: string | null = null;

    if (n8nUrl && n8nKey) {
      try {
        const deployRes = await fetch(`${n8nUrl}/api/v1/workflows`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-N8N-API-KEY": n8nKey,
          },
          body: JSON.stringify(workflowJson),
        });
        const deployData = (await deployRes.json()) as { id?: string };

        if (deployData.id) {
          deployed = true;
          n8nId = deployData.id;

          // Activate the workflow so the schedule trigger fires immediately.
          await fetch(`${n8nUrl}/api/v1/workflows/${n8nId}/activate`, {
            method: "POST",
            headers: { "X-N8N-API-KEY": n8nKey },
          }).catch(() => {
            // Non-fatal — n8n may require manual activation on some setups.
          });
        }
      } catch (err) {
        deployError = String(err);
        console.error("[n8n/pipeline] deploy failed:", err);
      }
    }

    // Audit log.
    try {
      await supabase
        .from("trinity_log")
        .insert({
          action_type: "pipeline",
          description: "Full-lifecycle pipeline n8n workflow deployed",
          status: deployed ? "completed" : "pending",
          result: { deployed, n8n_id: n8nId, deploy_error: deployError },
        });
    } catch {
      // Non-fatal audit log — deploy result already captured above.
    }

    return NextResponse.json({
      ok: true,
      deployed,
      n8nId,
      deployError,
      workflow: workflowJson,
      message: deployed
        ? `Pipeline workflow live on n8n (id: ${n8nId}). Runs hourly.`
        : "Workflow JSON generated. Set N8N_URL + N8N_API_KEY to auto-deploy, or import the workflow JSON manually.",
    });
  }

  return NextResponse.json(
    { error: `Unknown action "${action}". Valid: advance | force_stage | deploy` },
    { status: 400 },
  );
}
