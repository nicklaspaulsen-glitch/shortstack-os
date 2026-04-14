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
  maxCalls: number = 10,
  clientId?: string,
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

  // Resolve agent config: per-client first, then system-wide fallback
  let agentId = "";
  let phoneNumberId = "";

  if (clientId) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("eleven_agent_id, eleven_phone_number_id")
      .eq("id", clientId)
      .single();

    if (clientRow?.eleven_agent_id) agentId = clientRow.eleven_agent_id;
    if (clientRow?.eleven_phone_number_id) phoneNumberId = clientRow.eleven_phone_number_id;
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
    return { ...results, errors: 1, leads: [{ business: "Config", phone: "", status: "ElevenAgent not configured — provision a phone for this client or set a system-wide agent" }] };
  }

  // Get leads recently called in last 48h to prevent duplicates
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentCalls } = await supabase
    .from("outreach_log")
    .select("lead_id")
    .eq("platform", "call")
    .gte("created_at", cutoff);
  const recentlyCalledIds = new Set((recentCalls || []).map(c => c.lead_id).filter(Boolean));

  // Get leads with phone numbers, prioritized by lead_score
  const { data: allLeads } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry, email, lead_score")
    .not("phone", "is", null)
    .in("status", ["new", "called"])
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(maxCalls * 2); // fetch extra to account for filtered duplicates

  const leads = (allLeads || []).filter(l => !recentlyCalledIds.has(l.id)).slice(0, maxCalls);

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

// ══════════════════════════════════
// Post-Call Processing
// ══════════════════════════════════

// Sync recent call outcomes — fetch transcripts, detect intent, update lead status
export async function syncCallOutcomes(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
): Promise<{ synced: number; errors: number }> {
  const result = { synced: 0, errors: 0 };

  // Get recent outreach entries with conversation IDs that haven't been processed
  const { data: pendingCalls } = await supabase
    .from("outreach_log")
    .select("id, lead_id, message_text, status, business_name, metadata")
    .eq("platform", "call")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!pendingCalls || pendingCalls.length === 0) return result;

  for (const call of pendingCalls) {
    // Extract conversation ID from message_text or metadata
    const convMatch = call.message_text?.match(/conv:([a-zA-Z0-9_-]+)/);
    const meta = (call.metadata as Record<string, unknown>) || {};
    const conversationId = convMatch?.[1] || (meta.conversation_id as string);
    if (!conversationId) continue;

    try {
      const conversation = await getConversation(conversationId);
      if (!conversation) continue;

      const status = conversation.status as string;
      // Only process completed conversations
      if (status !== "done" && status !== "ended" && status !== "failed") continue;

      const transcript = conversation.transcript as Array<{ role: string; message: string }> | undefined;
      const duration = (conversation.metadata as Record<string, unknown>)?.call_duration_secs as number | undefined;
      const fullTranscript = (transcript || []).map(t => `${t.role}: ${t.message}`).join("\n");

      // Detect outcome from transcript
      const outcome = detectCallOutcome(fullTranscript);

      // Update outreach log with outcome
      await supabase.from("outreach_log").update({
        status: outcome === "interested" ? "replied" : outcome === "voicemail" ? "sent" : "failed",
        metadata: {
          ...meta,
          conversation_id: conversationId,
          outcome,
          duration_secs: duration,
          transcript_length: fullTranscript.length,
          synced_at: new Date().toISOString(),
        },
      }).eq("id", call.id);

      // Update lead status based on outcome
      if (call.lead_id && outcome === "interested") {
        await supabase.from("leads").update({ status: "replied" }).eq("id", call.lead_id);
      } else if (call.lead_id && outcome === "not_interested") {
        await supabase.from("leads").update({ status: "lost" }).eq("id", call.lead_id);
      }

      // Store transcript
      if (fullTranscript) {
        await supabase.from("trinity_log").insert({
          action_type: "lead_gen",
          description: `Call transcript: ${call.business_name || "Unknown"} — ${outcome} (${duration || 0}s)`,
          status: "completed",
          metadata: {
            conversation_id: conversationId,
            outcome,
            duration_secs: duration,
            transcript: fullTranscript.slice(0, 5000),
            lead_id: call.lead_id,
          },
        });
      }

      result.synced++;
    } catch {
      result.errors++;
    }
  }

  return result;
}

// Detect call outcome from transcript text
function detectCallOutcome(transcript: string): "interested" | "not_interested" | "voicemail" | "no_answer" | "unknown" {
  const lower = transcript.toLowerCase();
  if (!transcript || transcript.length < 20) return "no_answer";
  if (lower.includes("leave a message") || lower.includes("voicemail") || lower.includes("not available")) return "voicemail";
  if (lower.includes("sounds good") || lower.includes("i'm interested") || lower.includes("book") || lower.includes("schedule") || lower.includes("what day") || lower.includes("send me") || lower.includes("tell me more")) return "interested";
  if (lower.includes("not interested") || lower.includes("no thanks") || lower.includes("don't call") || lower.includes("remove") || lower.includes("stop calling")) return "not_interested";
  return "unknown";
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
