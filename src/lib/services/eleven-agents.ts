// ElevenLabs Conversational AI (ElevenAgents) — Replaces GHL cold calling
// Creates AI voice agents that make outbound calls to leads

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

function getHeaders() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    "xi-api-key": apiKey,
  };
}

// ══════════════════════════════════
// Agent Management
// ══════════════════════════════════

export async function createAgent(params: {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voiceId?: string;
  language?: string;
  maxDurationSeconds?: number;
}): Promise<{ agentId: string; error?: string }> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/agents/create`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        name: params.name,
        conversation_config: {
          agent: {
            first_message: params.firstMessage,
            language: params.language || "en",
            prompt: {
              prompt: params.systemPrompt,
              llm: "gemini-2.5-flash",
              temperature: 0.7,
            },
          },
          tts: {
            voice_id: params.voiceId || "21m00Tcm4TlvDq8ikWAM", // Rachel default
            model_id: "eleven_flash_v2_5",
          },
          conversation: {
            max_duration_seconds: params.maxDurationSeconds || 300,
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { agentId: "", error: `ElevenLabs ${res.status}: ${err}` };
    }

    const data = await res.json();
    return { agentId: data.agent_id };
  } catch (err) {
    return { agentId: "", error: String(err) };
  }
}

export async function getAgent(agentId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/agents/${agentId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function listAgents(): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/agents`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents || [];
  } catch {
    return [];
  }
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/agents/${agentId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ══════════════════════════════════
// Phone Numbers (Twilio)
// ══════════════════════════════════

export async function importPhoneNumber(params: {
  phoneNumber: string;
  label: string;
  twilioSid: string;
  twilioToken: string;
}): Promise<{ phoneNumberId: string; error?: string }> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/phone-numbers/create`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        phone_number: params.phoneNumber,
        label: params.label,
        provider: {
          type: "twilio",
          twilio_account_sid: params.twilioSid,
          twilio_auth_token: params.twilioToken,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { phoneNumberId: "", error: `ElevenLabs ${res.status}: ${err}` };
    }

    const data = await res.json();
    return { phoneNumberId: data.phone_number_id };
  } catch (err) {
    return { phoneNumberId: "", error: String(err) };
  }
}

export async function listPhoneNumbers(): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/phone-numbers`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.phone_numbers || data || [];
  } catch {
    return [];
  }
}

// ════════════════════════════���═════
// Outbound Calling
// ══════════════════════════════════

export async function makeOutboundCall(params: {
  agentId: string;
  phoneNumberId: string;
  toNumber: string;
  customData?: Record<string, string>;
}): Promise<{ conversationId: string; callSid: string; error?: string }> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/twilio/outbound-call`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        agent_id: params.agentId,
        agent_phone_number_id: params.phoneNumberId,
        to_number: params.toNumber,
        conversation_initiation_client_data: params.customData
          ? { dynamic_variables: params.customData }
          : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { conversationId: "", callSid: "", error: `ElevenLabs ${res.status}: ${err}` };
    }

    const data = await res.json();
    return {
      conversationId: data.conversation_id || "",
      callSid: data.call_sid || data.callSid || "",
    };
  } catch (err) {
    return { conversationId: "", callSid: "", error: String(err) };
  }
}

// Get conversation details (transcript, outcome, etc.)
export async function getConversation(conversationId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${ELEVEN_BASE}/convai/conversations/${conversationId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function listConversations(agentId?: string): Promise<Array<Record<string, unknown>>> {
  try {
    const url = agentId
      ? `${ELEVEN_BASE}/convai/conversations?agent_id=${agentId}`
      : `${ELEVEN_BASE}/convai/conversations`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch {
    return [];
  }
}

// ══════════════════════════════════
// Cold Calling Engine (replaces GHL)
// ══════════════════════════════════

export async function runElevenAgentCalls(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  maxCalls: number = 10
): Promise<{
  totalCalled: number;
  errors: number;
  leads: Array<{ business: string; phone: string; status: string; conversationId?: string }>;
}> {
  const results = {
    totalCalled: 0,
    errors: 0,
    leads: [] as Array<{ business: string; phone: string; status: string; conversationId?: string }>,
  };

  // Get agent config from settings
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
    return { ...results, errors: 1, leads: [{ business: "Config", phone: "", status: "ElevenAgent not configured (need agent_id + phone_number_id)" }] };
  }

  // Get leads with phone numbers, prioritized by lead_score
  const { data: leads } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry, email, lead_score")
    .not("phone", "is", null)
    .in("status", ["new", "called"])
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(maxCalls);

  if (!leads || leads.length === 0) return results;

  for (const lead of leads) {
    if (!lead.phone) continue;

    // Clean phone number — ensure it starts with +
    let phone = lead.phone.replace(/[^\d+]/g, "");
    if (!phone.startsWith("+")) phone = `+1${phone}`; // default US

    const callResult = await makeOutboundCall({
      agentId,
      phoneNumberId,
      toNumber: phone,
      customData: {
        business_name: lead.business_name || "your business",
        industry: lead.industry || "local business",
        caller_name: "Alex from ShortStack",
      },
    });

    if (!callResult.error) {
      results.totalCalled++;
      results.leads.push({
        business: lead.business_name,
        phone: lead.phone,
        status: "calling",
        conversationId: callResult.conversationId,
      });

      // Update lead
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);

      // Log with conversation ID for later transcript fetch
      await supabase.from("outreach_log").insert({
        lead_id: lead.id,
        platform: "call",
        business_name: lead.business_name,
        recipient_handle: lead.phone,
        message_text: `[ElevenAgent Call] conv:${callResult.conversationId}`,
        status: "sent",
      });

      await supabase.from("trinity_log").insert({
        action_type: "lead_gen",
        description: `AI call: ${lead.business_name} (${lead.phone})`,
        status: "completed",
        result: {
          lead_id: lead.id,
          conversation_id: callResult.conversationId,
          call_sid: callResult.callSid,
          phone: lead.phone,
        },
        completed_at: new Date().toISOString(),
      });
    } else {
      results.errors++;
      results.leads.push({
        business: lead.business_name,
        phone: lead.phone,
        status: `error: ${callResult.error}`,
      });
    }

    // Rate limit — 2 seconds between calls
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

// Default cold calling agent prompt
export const DEFAULT_COLD_CALL_PROMPT = `You are Alex, a friendly and professional sales representative from ShortStack, a digital marketing agency that helps local businesses get more clients.

CONTEXT:
- You are calling {{business_name}}, a {{industry}} business
- Your goal is to book a 10-minute discovery call
- Be conversational, warm, and genuine — NOT robotic or salesy

SCRIPT FLOW:
1. Introduce yourself: "Hi, this is Alex from ShortStack. Am I speaking with the owner of {{business_name}}?"
2. If yes: "Great! I'll keep this super quick — I noticed {{business_name}} online and we've been helping similar {{industry}} businesses in your area get 40-60% more clients through digital marketing. Would you be open to a quick 10-minute call where I can show you exactly how?"
3. If they're interested: "Awesome! What day works best for you this week? We have some slots on [suggest 2-3 days]."
4. If they're hesitant: "Totally understand! No pressure at all. We could also just send you a quick case study showing what we did for a similar {{industry}} business. Would that be helpful?"
5. If they say no: "No worries at all! Thanks for your time. If you ever want to chat about growing your business online, feel free to reach out. Have a great day!"

RULES:
- Keep it under 2 minutes
- Never be pushy or aggressive
- If they ask about pricing, say "It depends on the package, but we start around $500/month. The discovery call is free and we can go over everything."
- If they ask who referred you, say "We found your business online and thought you'd be a great fit"
- Always be respectful of their time
- If it goes to voicemail, leave a brief 15-second message`;

export const DEFAULT_FIRST_MESSAGE = "Hi! This is Alex from ShortStack. Am I speaking with the owner of {{business_name}}?";
