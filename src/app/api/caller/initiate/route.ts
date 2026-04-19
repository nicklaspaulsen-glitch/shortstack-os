import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// ShortStack AI Cold Caller — Uses Retell AI (our own, not GHL)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, phone_number, business_name, owner_name, industry, script_override } = await request.json();

  const retellKey = process.env.RETELL_API_KEY;
  if (!retellKey) return NextResponse.json({ error: "Retell AI not configured" }, { status: 500 });

  // Get lead data if lead_id provided — scoped to caller's owned leads.
  let leadData = { business_name, owner_name, industry, phone: phone_number };
  if (lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("user_id", ownerId)
      .single();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or not owned by caller" }, { status: 403 });
    }
    leadData = {
      business_name: lead.business_name,
      owner_name: lead.owner_name || "the owner",
      industry: lead.industry || "business",
      phone: lead.phone || phone_number,
    };
  }

  if (!leadData.phone) return NextResponse.json({ error: "No phone number" }, { status: 400 });

  // First ensure we have an agent
  let agentId = null;
  try {
    const listRes = await fetch("https://api.retellai.com/v2/list-agents", {
      headers: { Authorization: `Bearer ${retellKey}` },
    });
    const agents = await listRes.json();
    agentId = agents?.find?.((a: Record<string, string>) => a.agent_name?.includes("ShortStack"))?.agent_id;

    if (!agentId) {
      // Create the ShortStack cold caller agent
      const createRes = await fetch("https://api.retellai.com/v2/create-agent", {
        method: "POST",
        headers: { Authorization: `Bearer ${retellKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: "ShortStack Cold Caller",
          voice_id: "11labs-Adrian",
          general_prompt: script_override || `You are Alex from ShortStack digital marketing agency. You're calling {{business_name}} to offer digital marketing services. Be friendly, not pushy. Goal: book a 15-minute discovery call. If not interested, thank them and end politely. Max 3 minutes.`,
          begin_message: `Hi, is this {{owner_name}} from {{business_name}}?`,
          language: "en-US",
        }),
      });
      const agent = await createRes.json();
      agentId = agent.agent_id;
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to setup agent: ${err}` }, { status: 500 });
  }

  if (!agentId) return NextResponse.json({ error: "Failed to create call agent" }, { status: 500 });

  // Initiate the call
  try {
    const callRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${retellKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to_number: leadData.phone,
        agent_id: agentId,
        retell_llm_dynamic_variables: {
          business_name: leadData.business_name,
          owner_name: leadData.owner_name,
          industry: leadData.industry,
        },
        metadata: { source: "shortstack_os", lead_id },
      }),
    });

    const callData = await callRes.json();

    // Update lead status (scoped to owner — ownership already verified above)
    if (lead_id) {
      await supabase.from("leads").update({ status: "called" }).eq("id", lead_id).eq("user_id", ownerId);
    }

    // Log
    await supabase.from("trinity_log").insert({
      action_type: "lead_gen",
      description: `AI call initiated: ${leadData.business_name} (${leadData.phone})`,
      status: "in_progress",
      result: { call_id: callData.call_id, phone: leadData.phone, business: leadData.business_name },
      completed_at: new Date().toISOString(),
    });

    // Notify on Telegram
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `📞 *AI Call Started*\n${leadData.business_name}\n${leadData.phone}`);
    }

    return NextResponse.json({ success: true, call_id: callData.call_id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
