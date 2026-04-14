import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeOutboundCall } from "@/lib/services/eleven-agents";

// POST — make an outbound AI call to a lead via ElevenAgents
// TODO: Add rate limiting in production to prevent call abuse
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can initiate calls
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // If client_id provided, try per-client agent
  if (body.client_id) {
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

  // Update lead status + log the call (only advance forward, never overwrite replied/booked)
  if (lead_id) {
    await supabase.from("leads").update({ status: "called" }).eq("id", lead_id).in("status", ["new"]);

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
