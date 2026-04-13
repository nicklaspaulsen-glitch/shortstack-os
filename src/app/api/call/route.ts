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

  // Get agent config from system_health
  const supabase = createServiceClient();
  const { data: settingsRow } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "agent_settings")
    .single();

  const settings = (settingsRow?.metadata as Record<string, Record<string, unknown>> | null) || {};
  const elevenConfig = settings.eleven_agents || {};
  const agentId = elevenConfig.agent_id as string;
  const phoneNumberId = elevenConfig.phone_number_id as string;

  if (!agentId || !phoneNumberId) {
    return NextResponse.json(
      { error: "ElevenAgent not configured. Go to AI Caller → Setup to configure agent and phone number." },
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

  // Update lead status + log the call
  if (lead_id) {
    await supabase.from("leads").update({ status: "called" }).eq("id", lead_id);

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
