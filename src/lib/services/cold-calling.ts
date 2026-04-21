// Cold-calling service — SUNSET Apr 21 per MEMORY migration plan.
// All GHL-based calling has been removed. Native cold calls now go through
// ElevenAgents via /api/call (see src/app/api/call/route.ts) and
// /api/caller/initiate (Retell AI). Functions below are kept as no-op shims
// so the daily-brief cron and the GHL webhook don't crash during cutover.

export async function triggerGHLCall(_contactId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: false, error: "GHL cold calling is sunset — use /api/call (ElevenAgents)" };
}

export async function triggerGHLWorkflow(_params: {
  contactId: string;
  workflowId?: string;
}): Promise<boolean> {
  return false;
}

export async function getGHLCallHistory(_contactId: string): Promise<Array<{
  id: string;
  direction: string;
  status: string;
  duration: number;
  dateAdded: string;
}>> {
  return [];
}

export async function updateContactAfterCall(_params: {
  contactId: string;
  outcome: "answered" | "voicemail" | "no_answer" | "booked" | "not_interested";
  notes?: string;
}): Promise<boolean> {
  return false;
}

export async function runDailyColdCalls(
  _supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  _maxCalls: number = 50,
): Promise<{
  totalQueued: number;
  alreadyCalled: number;
  errors: number;
  leads: Array<{ business: string; phone: string; status: string }>;
}> {
  return { totalQueued: 0, alreadyCalled: 0, errors: 0, leads: [] };
}

export async function handleGHLCallWebhook(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  payload: Record<string, unknown>,
): Promise<void> {
  // Legacy GHL call webhook — still accepts inbound payloads so any dangling
  // GHL workflows don't 500. We log the event but take no further action.
  // TODO: migrate to native ElevenAgents webhook at /api/webhooks/elevenlabs.
  try {
    await supabase.from("trinity_log").insert({
      action_type: "lead_gen",
      description: "Legacy GHL call webhook received (sunset — no action taken)",
      status: "warning",
      result: { payload_keys: Object.keys(payload || {}), sunset_note: "GHL integration removed Apr 21" },
    });
  } catch {}
}
