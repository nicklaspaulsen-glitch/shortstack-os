// AI Cold Calling Agent — Uses GoHighLevel's built-in AI calling system
// Automatically triggers cold calls on leads, tracks outcomes, updates pipeline

const GHL_BASE = "https://services.leadconnectorhq.com";

async function ghlFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error("GHL API key not configured");

  return fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      ...options.headers,
    },
  });
}

// Trigger a call to a contact in GHL using their built-in calling
export async function triggerGHLCall(contactId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Add to calling queue by updating contact and adding "cold-call-queue" tag
    const res = await ghlFetch(`/contacts/${contactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: ["cold-call-queue", "ai-caller"] }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Create a workflow trigger in GHL to initiate AI calling
export async function triggerGHLWorkflow(params: {
  contactId: string;
  workflowId?: string;
}): Promise<boolean> {
  try {
    const locationId = process.env.GHL_LOCATION_ID;
    // Add contact to a workflow that triggers the AI agent call
    const res = await ghlFetch(`/contacts/${params.contactId}/workflow/${params.workflowId || "cold-call"}`, {
      method: "POST",
      body: JSON.stringify({
        eventStartTime: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Get call history for a contact from GHL
export async function getGHLCallHistory(contactId: string): Promise<Array<{
  id: string;
  direction: string;
  status: string;
  duration: number;
  dateAdded: string;
}>> {
  try {
    const res = await ghlFetch(`/contacts/${contactId}/tasks`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks?.filter((t: Record<string, unknown>) => t.type === "call") || [];
  } catch {
    return [];
  }
}

// Update contact after call outcome
export async function updateContactAfterCall(params: {
  contactId: string;
  outcome: "answered" | "voicemail" | "no_answer" | "booked" | "not_interested";
  notes?: string;
}): Promise<boolean> {
  try {
    const tags = [`called`, `call-${params.outcome}`];
    if (params.outcome === "booked") tags.push("appointment-booked");

    // Add tags
    await ghlFetch(`/contacts/${params.contactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    });

    // Add note
    if (params.notes) {
      await ghlFetch(`/contacts/${params.contactId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: `[AI Cold Call] ${params.notes}` }),
      });
    }

    return true;
  } catch {
    return false;
  }
}

// Run the daily cold calling batch via GHL
export async function runDailyColdCalls(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  maxCalls: number = 50
): Promise<{
  totalQueued: number;
  alreadyCalled: number;
  errors: number;
  leads: Array<{ business: string; phone: string; status: string }>;
}> {
  const results = {
    totalQueued: 0,
    alreadyCalled: 0,
    errors: 0,
    leads: [] as Array<{ business: string; phone: string; status: string }>,
  };

  // Get leads with phone numbers that are new and synced to GHL
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .not("phone", "is", null)
    .eq("status", "new")
    .eq("ghl_sync_status", "synced")
    .not("ghl_contact_id", "is", null)
    .order("scraped_at", { ascending: false })
    .limit(maxCalls);

  if (!leads || leads.length === 0) return results;

  for (const lead of leads) {
    // Trigger GHL cold call workflow
    const callResult = await triggerGHLCall(lead.ghl_contact_id!);

    if (callResult.success) {
      results.totalQueued++;
      results.leads.push({
        business: lead.business_name,
        phone: lead.phone!,
        status: "queued",
      });

      // Update lead status to "called"
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);

      // Log in trinity
      await supabase.from("trinity_log").insert({
        action_type: "lead_gen",
        description: `Cold call queued: ${lead.business_name} (${lead.phone})`,
        status: "completed",
        result: { lead_id: lead.id, ghl_contact_id: lead.ghl_contact_id, phone: lead.phone },
        completed_at: new Date().toISOString(),
      });
    } else {
      results.errors++;
      results.leads.push({
        business: lead.business_name,
        phone: lead.phone!,
        status: "error",
      });
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

// Webhook handler for GHL call outcome callbacks
export async function handleGHLCallWebhook(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  payload: Record<string, unknown>
): Promise<void> {
  const contactId = payload.contactId as string;
  const callStatus = payload.callStatus as string;
  const duration = payload.duration as number;

  if (!contactId) return;

  // Find the lead by GHL contact ID
  const { data: lead } = await supabase
    .from("leads")
    .select("id, business_name")
    .eq("ghl_contact_id", contactId)
    .single();

  if (!lead) return;

  // Map GHL call status to our status
  let outcome: "answered" | "voicemail" | "no_answer" | "booked" | "not_interested" = "no_answer";
  let leadStatus: "called" | "booked" | "not_interested" = "called";

  if (callStatus === "completed" && duration > 30) {
    outcome = "answered";
    leadStatus = "called";
  } else if (callStatus === "completed" && payload.appointmentBooked) {
    outcome = "booked";
    leadStatus = "booked";
  } else if (callStatus === "voicemail") {
    outcome = "voicemail";
  } else if (callStatus === "no-answer" || callStatus === "busy") {
    outcome = "no_answer";
  }

  // Update lead
  await supabase.from("leads").update({ status: leadStatus }).eq("id", lead.id);

  // Update GHL contact
  await updateContactAfterCall({
    contactId,
    outcome,
    notes: `Call duration: ${duration}s. Status: ${callStatus}`,
  });

  // Log
  await supabase.from("trinity_log").insert({
    action_type: "lead_gen",
    description: `Cold call result: ${lead.business_name} — ${outcome}${outcome === "booked" ? " ✅ BOOKED" : ""}`,
    status: "completed",
    result: { lead_id: lead.id, outcome, duration, callStatus },
    completed_at: new Date().toISOString(),
  });

  // Notify on Telegram if booked
  if (outcome === "booked") {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🎉 *Call Booked!*\n\n${lead.business_name} just booked an appointment from the AI cold call!\nDuration: ${duration}s`);
    }
  }
}
