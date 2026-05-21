/**
 * /api/portal/[clientId]/work-requests
 *
 * Client portal: submit a "Request More Work" brief → AI generates a proposal
 * → agency reviews → client sees proposal inline → payment link sent.
 *
 * GET  — list requests for this client (status, proposal, etc.)
 * POST — client submits a new work request brief
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { callLLMHumanized } from "@/lib/ai/call-llm-humanized";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── GET: list requests ───────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("client_work_requests")
    .select(
      "id, service_type, brief, urgency, budget_hint, proposal_text, proposal_price, proposal_deliverables, proposal_status, proposal_sent_at, proposal_expires_at, client_response_notes, responded_at, stripe_payment_link, payment_amount, paid_at, delivered_at, created_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[portal/work-requests] GET failed", error);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

// ── POST: submit new request + trigger AI proposal generation ───────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;

  let body: {
    service_type?: string;
    brief?: string;
    urgency?: string;
    budget_hint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.brief?.trim()) {
    return NextResponse.json({ error: "Brief is required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Resolve owner_id from the client row
  const { data: clientRow } = await svc
    .from("clients")
    .select("id, agency_id, business_name, industry")
    .eq("id", clientId)
    .single();

  if (!clientRow) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const ownerId = clientRow.agency_id as string;

  // Insert request row (status = generating)
  const { data: inserted, error: insertErr } = await svc
    .from("client_work_requests")
    .insert({
      owner_id: ownerId,
      client_id: clientId,
      service_type: body.service_type ?? "other",
      brief: body.brief.trim(),
      urgency: body.urgency ?? "standard",
      budget_hint: body.budget_hint ?? null,
      proposal_status: "generating",
      source: "portal",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[portal/work-requests] insert failed", insertErr);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }

  const requestId = inserted.id as string;

  // Fire-and-forget AI proposal generation
  void generateProposal(svc, requestId, ownerId, clientRow, body.brief!, body.service_type ?? "other").catch((err) => {
    console.error("[portal/work-requests] proposal generation failed", { requestId, err });
  });

  return NextResponse.json({ ok: true, requestId }, { status: 201 });
}

// ── AI proposal generation (fire-and-forget) ---------------------------------

async function generateProposal(
  svc: ReturnType<typeof createServiceClient>,
  requestId: string,
  ownerId: string,
  client: { business_name: string | null; industry: string | null },
  brief: string,
  serviceType: string,
) {
  try {
    const prompt = `You are a professional digital marketing agency writing a proposal for a client.

Client: ${client.business_name ?? "Unknown business"} (${client.industry ?? "unknown industry"})
Service requested: ${serviceType.replace(/_/g, " ")}
Client brief: ${brief}

Write a concise, compelling proposal (3-4 short paragraphs) that:
1. Acknowledges their specific need
2. Describes what you'll deliver with 3-5 concrete deliverables
3. Gives a realistic timeline
4. Suggests a fair price range (be specific, e.g. "$1,200 – $1,800")

Format as JSON: {
  "proposal_text": "...",
  "price_estimate": 1500,
  "deliverables": [{"item": "...", "eta_days": 7}, ...],
  "summary_one_liner": "..."
}`;

    const raw = await callLLMHumanized({
      taskType: "generation_long",
      userPrompt: prompt,
      systemPrompt: "You are an expert at writing persuasive, professional agency proposals. Return only valid JSON.",
      forceModel: "claude-haiku-4-5",
      humanize: false,
    });

    let parsed: {
      proposal_text?: string;
      price_estimate?: number;
      deliverables?: { item: string; eta_days: number }[];
      summary_one_liner?: string;
    } = {};
    try {
      const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch {
      // use raw text if JSON parse fails
      parsed.proposal_text = raw.text;
    }

    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    await svc
      .from("client_work_requests")
      .update({
        proposal_text: parsed.proposal_text ?? raw.text,
        proposal_price: parsed.price_estimate ?? null,
        proposal_deliverables: parsed.deliverables ?? [],
        proposal_status: "sent",
        proposal_generated_at: new Date().toISOString(),
        proposal_sent_at: new Date().toISOString(),
        proposal_expires_at: expiresAt,
      })
      .eq("id", requestId);

    // Log to agent activity
    await svc.from("agent_activity_events").insert({
      agency_owner_id: ownerId,
      agent_key: "NEXUS",
      event_type: "proposal_generated",
      summary: `💼 AI proposal generated for ${client.business_name ?? "client"} — ${serviceType.replace(/_/g, " ")}. Price: $${parsed.price_estimate ?? "TBD"}.`,
      ref_table: "client_work_requests",
      ref_id: requestId,
    });
  } catch (err) {
    // Update status to pending so agency can draft manually
    await svc
      .from("client_work_requests")
      .update({ proposal_status: "pending" })
      .eq("id", requestId);
    throw err;
  }
}
