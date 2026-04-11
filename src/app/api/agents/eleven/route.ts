import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createAgent, listAgents, deleteAgent, getAgent,
  importPhoneNumber, listPhoneNumbers, listConversations,
  DEFAULT_COLD_CALL_PROMPT, DEFAULT_FIRST_MESSAGE,
} from "@/lib/services/eleven-agents";

// GET — list agents, phone numbers, or conversations
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "agents";

  if (type === "agents") {
    const agents = await listAgents();
    return NextResponse.json({ agents });
  }
  if (type === "phones") {
    const phones = await listPhoneNumbers();
    return NextResponse.json({ phones });
  }
  if (type === "conversations") {
    const agentId = request.nextUrl.searchParams.get("agent_id") || undefined;
    const conversations = await listConversations(agentId);
    return NextResponse.json({ conversations });
  }
  if (type === "agent" && request.nextUrl.searchParams.get("id")) {
    const agent = await getAgent(request.nextUrl.searchParams.get("id")!);
    return NextResponse.json({ agent });
  }
  if (type === "defaults") {
    return NextResponse.json({
      prompt: DEFAULT_COLD_CALL_PROMPT,
      firstMessage: DEFAULT_FIRST_MESSAGE,
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// POST — create agent, import phone, or save config
export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action as string;

  if (action === "create_agent") {
    const result = await createAgent({
      name: body.name || "ShortStack Cold Caller",
      firstMessage: body.firstMessage || DEFAULT_FIRST_MESSAGE,
      systemPrompt: body.systemPrompt || DEFAULT_COLD_CALL_PROMPT,
      voiceId: body.voiceId,
      language: body.language || "en",
      maxDurationSeconds: body.maxDuration || 300,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Auto-save agent_id to settings
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, metadata")
      .eq("integration_name", "agent_settings")
      .single();

    if (existing) {
      const metadata = (existing.metadata as Record<string, Record<string, unknown>>) || {};
      metadata.eleven_agents = { ...metadata.eleven_agents, agent_id: result.agentId };
      await supabase.from("system_health").update({ metadata }).eq("id", existing.id);
    }

    return NextResponse.json({ agentId: result.agentId });
  }

  if (action === "import_phone") {
    const result = await importPhoneNumber({
      phoneNumber: body.phoneNumber,
      label: body.label || "ShortStack Caller",
      twilioSid: body.twilioSid || process.env.TWILIO_ACCOUNT_SID || "",
      twilioToken: body.twilioToken || process.env.TWILIO_AUTH_TOKEN || "",
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Auto-save phone_number_id to settings
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, metadata")
      .eq("integration_name", "agent_settings")
      .single();

    if (existing) {
      const metadata = (existing.metadata as Record<string, Record<string, unknown>>) || {};
      metadata.eleven_agents = { ...metadata.eleven_agents, phone_number_id: result.phoneNumberId };
      await supabase.from("system_health").update({ metadata }).eq("id", existing.id);
    }

    return NextResponse.json({ phoneNumberId: result.phoneNumberId });
  }

  if (action === "save_config") {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, metadata")
      .eq("integration_name", "agent_settings")
      .single();

    if (existing) {
      const metadata = (existing.metadata as Record<string, Record<string, unknown>>) || {};
      metadata.eleven_agents = {
        ...metadata.eleven_agents,
        ...(body.agentId && { agent_id: body.agentId }),
        ...(body.phoneNumberId && { phone_number_id: body.phoneNumberId }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.maxCallsPerDay && { max_calls_per_day: body.maxCallsPerDay }),
      };
      await supabase.from("system_health").update({ metadata }).eq("id", existing.id);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete_agent") {
    const success = await deleteAgent(body.agentId);
    return NextResponse.json({ success });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
