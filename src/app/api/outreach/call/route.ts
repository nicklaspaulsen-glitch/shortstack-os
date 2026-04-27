/**
 * POST /api/outreach/call
 *
 * Initiate an outbound call to a contact. Two modes:
 *
 *   mode: "ai"     -> trigger the existing ElevenLabs voice receptionist
 *                     to call the contact's phone (uses the agent
 *                     configured on the agency owner's clients table or a
 *                     default `ELEVENLABS_DEFAULT_AGENT_ID`).
 *
 *   mode: "human"  -> initiate a Twilio click-to-call: ring the agency
 *                     owner's phone (read from the user's profile), then
 *                     bridge to the contact when picked up. Returns a
 *                     pending voice_calls.id so the UI can poll status.
 *
 * Body:
 *   { contact_id: string, contact_kind?: "lead" | "client", mode: "ai" | "human" }
 *
 * Returns: { success: true, call_id: <voice_calls.id>, provider: "elevenlabs"|"twilio" }
 *
 * SAFETY: never charge the caller for missing config — return 503 with a
 * clear message instead of silently failing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { reportError } from "@/lib/observability/error-reporter";
import type { ContactKind } from "@/lib/outreach/types";

interface CallBody {
  contact_id?: string;
  contact_kind?: ContactKind;
  mode?: "ai" | "human";
}

interface ContactResolved {
  phone: string | null;
  name: string;
  client_id: string | null;
}

async function resolveContact(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  contactKind: ContactKind,
  contactId: string,
): Promise<ContactResolved | null> {
  if (contactKind === "lead") {
    const { data } = await serviceSupabase
      .from("leads")
      .select("id, phone, business_name, owner_name, client_id")
      .eq("id", contactId)
      .eq("user_id", ownerId)
      .single();
    if (!data) return null;
    return {
      phone: data.phone,
      name: data.business_name || data.owner_name || "Lead",
      client_id: data.client_id,
    };
  }
  const { data } = await serviceSupabase
    .from("clients")
    .select("id, phone, business_name, contact_name")
    .eq("id", contactId)
    .eq("profile_id", ownerId)
    .single();
  if (!data) return null;
  return {
    phone: data.phone,
    name: data.business_name || data.contact_name || "Client",
    client_id: data.id,
  };
}

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return "";
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

async function startElevenLabsCall(args: {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
  toNumber: string;
}): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": args.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: args.agentId,
        agent_phone_number_id: args.agentPhoneNumberId,
        to_number: args.toNumber,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: typeof json.detail === "string" ? json.detail : `ElevenLabs ${res.status}` };
    }
    return {
      ok: true,
      conversationId: typeof json.conversation_id === "string" ? json.conversation_id : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "ElevenLabs error" };
  }
}

async function startTwilioBridge(args: {
  sid: string;
  token: string;
  fromNumber: string;
  ownerPhone: string;
  contactPhone: string;
}): Promise<{ ok: boolean; callSid?: string; error?: string }> {
  // Two-leg bridge: dial the owner first; on answer, the TwiML returned
  // by /api/twilio/voice-webhook bridges to the contact.
  const auth = Buffer.from(`${args.sid}:${args.token}`).toString("base64");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${args.sid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: args.ownerPhone,
          From: args.fromNumber,
          Url: `${appUrl}/api/twilio/voice-webhook?bridge_to=${encodeURIComponent(args.contactPhone)}`,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: body.slice(0, 200) || `Twilio ${res.status}` };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, callSid: typeof json.sid === "string" ? json.sid : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio error" };
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: CallBody;
  try {
    body = (await request.json()) as CallBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "ai" ? "ai" : "human";
  const contactId = body.contact_id;
  const contactKind: ContactKind = body.contact_kind === "client" ? "client" : "lead";
  if (!contactId) return NextResponse.json({ error: "Missing contact_id" }, { status: 400 });

  const serviceSupabase = createServiceClient();
  const contact = await resolveContact(serviceSupabase, ownerId, contactKind, contactId);
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (!contact.phone) return NextResponse.json({ error: "Contact has no phone" }, { status: 400 });

  const toNumber = normalizePhone(contact.phone);
  if (!toNumber) return NextResponse.json({ error: "Invalid contact phone" }, { status: 400 });

  // Persist a placeholder voice_calls row regardless of mode so the
  // thread reflects the call attempt immediately.
  const callInsert = {
    profile_id: ownerId,
    client_id: contact.client_id,
    to_number: toNumber,
    direction: "outbound",
    status: "initiated",
    mode,
    started_at: new Date().toISOString(),
    metadata: { initiated_by_user_id: user.id, contact_kind: contactKind, contact_id: contactId },
  };

  const { data: callRow, error: insertErr } = await serviceSupabase
    .from("voice_calls")
    .insert(callInsert)
    .select("id")
    .single();
  if (insertErr || !callRow) {
    return NextResponse.json(
      { error: `Failed to log call: ${insertErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  if (mode === "ai") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs not configured", call_id: callRow.id },
        { status: 503 },
      );
    }
    // Look up agent & phone-number ids: client-specific first, then default.
    let agentId = process.env.ELEVENLABS_DEFAULT_AGENT_ID || "";
    let agentPhoneNumberId = process.env.ELEVENLABS_DEFAULT_PHONE_NUMBER_ID || "";
    if (contact.client_id) {
      const { data: clientRow } = await serviceSupabase
        .from("clients")
        .select("eleven_agent_id, eleven_phone_number_id")
        .eq("id", contact.client_id)
        .eq("profile_id", ownerId)
        .single();
      if (clientRow?.eleven_agent_id) agentId = clientRow.eleven_agent_id;
      if (clientRow?.eleven_phone_number_id) agentPhoneNumberId = clientRow.eleven_phone_number_id;
    }
    if (!agentId || !agentPhoneNumberId) {
      return NextResponse.json(
        {
          error: "ElevenLabs agent or phone-number id missing — configure on the client or set ELEVENLABS_DEFAULT_AGENT_ID/ELEVENLABS_DEFAULT_PHONE_NUMBER_ID",
          call_id: callRow.id,
        },
        { status: 503 },
      );
    }

    const result = await startElevenLabsCall({
      apiKey,
      agentId,
      agentPhoneNumberId,
      toNumber,
    });
    if (!result.ok) {
      reportError(new Error(result.error || "elevenlabs-failed"), {
        route: "outreach-call",
        component: "ai-mode",
        reason: "provider-error",
      });
      await serviceSupabase
        .from("voice_calls")
        .update({ status: "failed", metadata: { ...callInsert.metadata, error: result.error } })
        .eq("id", callRow.id);
      return NextResponse.json(
        { error: result.error || "ElevenLabs call failed", call_id: callRow.id },
        { status: 502 },
      );
    }
    await serviceSupabase
      .from("voice_calls")
      .update({
        eleven_agent_id: agentId,
        eleven_conversation_id: result.conversationId,
        status: "in_progress",
      })
      .eq("id", callRow.id);
    return NextResponse.json({ success: true, call_id: callRow.id, provider: "elevenlabs" });
  }

  // Human click-to-call: bridge owner's phone to the contact.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_DEFAULT_NUMBER;
  if (!sid || !token || !fromNumber) {
    return NextResponse.json(
      { error: "Twilio not configured", call_id: callRow.id },
      { status: 503 },
    );
  }

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("phone")
    .eq("id", ownerId)
    .single();
  const ownerPhone = profile?.phone ? normalizePhone(profile.phone) : "";
  if (!ownerPhone) {
    return NextResponse.json(
      {
        error: "Add a phone number to your profile to use click-to-dial",
        call_id: callRow.id,
      },
      { status: 400 },
    );
  }

  const result = await startTwilioBridge({
    sid,
    token,
    fromNumber,
    ownerPhone,
    contactPhone: toNumber,
  });
  if (!result.ok) {
    await serviceSupabase
      .from("voice_calls")
      .update({ status: "failed", metadata: { ...callInsert.metadata, error: result.error } })
      .eq("id", callRow.id);
    return NextResponse.json(
      { error: result.error || "Twilio call failed", call_id: callRow.id },
      { status: 502 },
    );
  }
  await serviceSupabase
    .from("voice_calls")
    .update({
      twilio_call_sid: result.callSid,
      from_number: fromNumber,
      status: "in_progress",
    })
    .eq("id", callRow.id);

  return NextResponse.json({ success: true, call_id: callRow.id, provider: "twilio" });
}
