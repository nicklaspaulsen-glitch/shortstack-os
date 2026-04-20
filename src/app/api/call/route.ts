import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeOutboundCall } from "@/lib/services/eleven-agents";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// POST — make an outbound AI call to a lead via ElevenAgents
// Plan-tier monthly call_minutes enforcement; records 1 minute on initiate
// (a real "true-up" should replace this at the webhooks/elevenlabs handler when
// actual duration is known — until then we debit conservatively on initiation).
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can initiate calls
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(authSupabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Plan-tier usage cap (monthly call minutes). Debit 1 minute upfront; later
  // reconciliation can add more via recordUsage when real duration is known.
  const gate = await checkLimit(ownerId, "call_minutes", 1);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Monthly call-minutes limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const body = await request.json();
  const { lead_id, phone, phone_number, business_name, industry } = body;

  const toNumber = phone || phone_number;
  if (!toNumber || typeof toNumber !== "string") {
    return NextResponse.json({ error: "No phone number provided" }, { status: 400 });
  }

  // Basic phone number format validation
  const cleanedCheck = toNumber.replace(/[^\d+]/g, "");
  if (cleanedCheck.length < 7 || cleanedCheck.length > 16) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  // Resolve agent config: per-client first, then system-wide fallback
  const supabase = createServiceClient();
  let agentId = "";
  let phoneNumberId = "";

  // If client_id provided, verify caller owns the client before reading its config.
  if (body.client_id) {
    const ctx = await requireOwnedClient(authSupabase, user.id, body.client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: clientRow } = await supabase
      .from("clients")
      .select("eleven_agent_id, eleven_phone_number_id, business_name")
      .eq("id", body.client_id)
      .single();

    if (clientRow?.eleven_agent_id && clientRow?.eleven_phone_number_id) {
      agentId = clientRow.eleven_agent_id;
      phoneNumberId = clientRow.eleven_phone_number_id;
    }
  }

  // If caller passed a lead_id, verify they own it before reading/updating it.
  if (lead_id) {
    const { data: leadCheck } = await supabase
      .from("leads")
      .select("user_id")
      .eq("id", lead_id)
      .single();
    if (leadCheck?.user_id !== ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fallback to system-wide config
  if (!agentId || !phoneNumberId) {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();

    const settings = (settingsRow?.metadata as Record<string, Record<string, unknown>> | null) || {};
    const elevenConfig = settings.eleven_agents || {};
    if (!agentId) agentId = elevenConfig.agent_id as string;
    if (!phoneNumberId) phoneNumberId = elevenConfig.phone_number_id as string;
  }

  if (!agentId || !phoneNumberId) {
    return NextResponse.json(
      { error: "ElevenAgent not configured. Provision a phone number for this client or configure a system-wide agent." },
      { status: 400 }
    );
  }

  // Clean phone number
  let cleanPhone = toNumber.replace(/[^\d+]/g, "");
  if (!cleanPhone.startsWith("+")) cleanPhone = `+1${cleanPhone}`;

  const result = await makeOutboundCall({
    agentId,
    phoneNumberId,
    toNumber: cleanPhone,
    customData: {
      business_name: business_name || "your business",
      industry: industry || "local business",
      caller_name: "Alex from ShortStack",
    },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error, success: false }, { status: 500 });
  }

  // Plan-tier usage metering (call initiated = 1 minute debit; reconciled later)
  await recordUsage(ownerId, "call_minutes", 1, {
    conversationId: result.conversationId,
    lead_id: lead_id ?? null,
    phase: "initiate",
  });

  // Update lead status + log the call (only advance forward, never overwrite replied/booked)
  // Ownership verified above — still filter on user_id defensively.
  if (lead_id) {
    await supabase.from("leads").update({ status: "called" }).eq("id", lead_id).eq("user_id", ownerId).in("status", ["new"]);

    await supabase.from("outreach_log").insert({
      lead_id,
      platform: "call",
      business_name: business_name || "",
      recipient_handle: toNumber,
      message_text: `[ElevenAgent Call] conv:${result.conversationId}`,
      status: "sent",
    });
  }

  return NextResponse.json({
    success: true,
    conversationId: result.conversationId,
    callSid: result.callSid,
  });
}
