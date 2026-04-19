import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  createAgent, listAgents, deleteAgent, getAgent,
  importPhoneNumber, listPhoneNumbers, listConversations,
  DEFAULT_COLD_CALL_PROMPT, DEFAULT_FIRST_MESSAGE,
} from "@/lib/services/eleven-agents";

// Auth helper — require authenticated admin user
async function requireAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, parent_agency_id").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  // Effective agency owner for scoping lead pool in run_calls.
  const ownerId = profile?.parent_agency_id || user.id;
  return { user, ownerId };
}

// GET — list agents, phone numbers, or conversations
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

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
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

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

  if (action === "run_calls") {
    const { runElevenAgentCalls } = await import("@/lib/services/eleven-agents");
    const supabase = createServiceClient();
    // Pass owner id so the run only dials this agency's leads.
    const ownerId = "ownerId" in auth ? auth.ownerId : undefined;
    const results = await runElevenAgentCalls(supabase, body.maxCalls || 5, body.clientId, ownerId);
    return NextResponse.json(results);
  }

  if (action === "test_call") {
    const { makeOutboundCall } = await import("@/lib/services/eleven-agents");
    if (!body.agentId || !body.phoneNumberId || !body.toNumber) {
      return NextResponse.json({ error: "Need agentId, phoneNumberId, toNumber" }, { status: 400 });
    }
    const result = await makeOutboundCall({
      agentId: body.agentId,
      phoneNumberId: body.phoneNumberId,
      toNumber: body.toNumber,
      customData: body.customData,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  }

  if (action === "get_transcript") {
    const { getConversation } = await import("@/lib/services/eleven-agents");
    const convo = await getConversation(body.conversationId);
    if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    return NextResponse.json({ conversation: convo });
  }

  if (action === "sync_outcomes") {
    const { syncCallOutcomes } = await import("@/lib/services/eleven-agents");
    const supabase = createServiceClient();
    const results = await syncCallOutcomes(supabase);
    return NextResponse.json(results);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
