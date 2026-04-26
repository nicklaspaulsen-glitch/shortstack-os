import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  validateTwilioSignature,
  resolveClientByToNumber,
  resolveClientById,
  mapTwilioStatus,
} from "@/lib/services/voice-calls";

// XML-escape dynamic values before interpolating into TwiML to prevent
// injection via client.businessName or inbound From/To strings.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Build TwiML that streams the call audio to ElevenLabs ConvAI for AI
// answering. Uses the dynamic-variables mechanism so ElevenLabs echoes
// `twilio_call_sid` back on its conversation_initiation + conversation_ended
// webhooks — that's how /api/webhooks/elevenlabs joins the transcript +
// outcome back to the originating voice_calls row.
//
// SECURITY: never embed XI_API_KEY in the URL/parameters. Twilio logs the
// full Stream URL on the call detail page; an exposed key would let any
// Twilio console viewer call ElevenLabs on our account. The auth flows via
// the agent's signed-url endpoint (server-to-server, before TwiML returns).
function buildElevenLabsStreamTwiml(opts: {
  agentId: string;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  clientId: string;
  signedUrl: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlEscape(opts.signedUrl)}">
      <Parameter name="twilio_call_sid" value="${xmlEscape(opts.callSid)}"/>
      <Parameter name="caller_id" value="${xmlEscape(opts.fromNumber)}"/>
      <Parameter name="agency_to_number" value="${xmlEscape(opts.toNumber)}"/>
      <Parameter name="client_id" value="${xmlEscape(opts.clientId)}"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Fetch a short-lived signed WebSocket URL from ElevenLabs ConvAI for the
 * given agent. Falls back to `null` if the API key isn't set or the request
 * fails — caller should then take the dial-the-client-phone fallback path.
 *
 * Why signed URL: prevents XI_API_KEY leaking to Twilio call logs (see
 * buildElevenLabsStreamTwiml comment). Signed URLs are bound to the agent
 * + expire in ~15 minutes, scoped per call.
 */
async function getElevenLabsSignedUrl(agentId: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: "GET",
        headers: { "xi-api-key": apiKey },
      },
    );
    if (!res.ok) {
      console.warn(
        `[voice-webhook] ElevenLabs signed-url fetch failed: ${res.status} for agent ${agentId}`,
      );
      return null;
    }
    const data = (await res.json()) as { signed_url?: string };
    return data.signed_url ?? null;
  } catch (err) {
    console.warn("[voice-webhook] ElevenLabs signed-url error:", err);
    return null;
  }
}

// Twilio Voice webhook — handles inbound calls to client numbers.
//
// Fires on the very first leg of a Twilio voice call (the VoiceUrl). We:
//   1. Validate Twilio signature (skipped with warning if TWILIO_AUTH_TOKEN
//      isn't set — dev/staging only).
//   2. Resolve the owning client by `To` number, then by ?client_id= fallback
//      (the provisioned webhook URL still carries it).
//   3. Upsert a `voice_calls` row keyed by twilio_call_sid — "ringing" status.
//   4. Return TwiML — preferred path streams the call to ElevenLabs ConvAI
//      so the AI agent answers. Falls back to dialing the client's phone
//      when ElevenLabs isn't configured (no API key, no agent ID, or signed-
//      url fetch fails).
//
// End-of-call events (duration, recording, completed status) arrive at
// /api/twilio/voice-status-callback which owns the rest of the lifecycle.
// ElevenLabs conversation events arrive at /api/webhooks/elevenlabs which
// joins the transcript + outcome back onto the voice_calls row by the
// twilio_call_sid dynamic variable we pass in via Stream parameters.
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const clientIdHint = searchParams.get("client_id");

  const formData = await request.formData();
  const from = (formData.get("From") as string) || null;
  const to = (formData.get("To") as string) || null;
  const callSid = (formData.get("CallSid") as string) || null;
  const direction = (formData.get("Direction") as string) || "inbound";
  const callStatus = (formData.get("CallStatus") as string) || null;

  // Signature validation — pass the *exact* body Twilio signed.
  const bodyParams = new URLSearchParams();
  formData.forEach((value, key) => bodyParams.append(key, String(value)));
  if (!validateTwilioSignature(request, bodyParams)) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 403, headers: { "Content-Type": "text/xml" } },
    );
  }

  // Resolve client: by To first (most reliable — not spoofable), fall back
  // to the query-string hint from the provisioned webhook URL.
  const client =
    (await resolveClientByToNumber(supabase, to)) ||
    (await resolveClientById(supabase, clientIdHint));

  // Upsert the "ringing" / inbound row so the dashboard shows in-progress
  // calls live. Status-callback updates duration + status later.
  if (callSid && client) {
    const twilioInbound = direction?.toLowerCase().startsWith("inbound")
      ? "inbound"
      : "outbound";
    const mappedStatus = mapTwilioStatus(callStatus) ?? "ringing";
    await supabase
      .from("voice_calls")
      .upsert(
        {
          profile_id: client.profileId,
          client_id: client.clientId,
          twilio_call_sid: callSid,
          eleven_agent_id: client.elevenAgentId,
          from_number: from,
          to_number: to,
          direction: twilioInbound,
          status: mappedStatus,
          outcome: "pending",
          started_at: new Date().toISOString(),
          metadata: { via: "voice-webhook" },
        },
        { onConflict: "twilio_call_sid" },
      )
      .select("id")
      .maybeSingle();

    // Keep existing inbound-call surfaces: outreach_log + Telegram ping.
    await supabase.from("outreach_log").insert({
      platform: "phone",
      business_name: from || "Unknown",
      recipient_handle: to,
      message_text: `Inbound call from ${from}`,
      status: "replied",
      sent_at: new Date().toISOString(),
      metadata: {
        direction: "inbound",
        client_id: client.clientId,
        call_sid: callSid,
      },
    });

    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Inbound Call\n\nFrom: ${from}\nTo: ${to}\nClient: ${client.businessName || client.clientId}`,
        }),
      }).catch(() => {});
    }

    // ── TwiML response (preferred: ElevenLabs AI receptionist) ────────
    // If the client has an ElevenLabs agent configured AND we can fetch a
    // signed WebSocket URL, stream the call to ElevenLabs ConvAI so their
    // AI agent answers the phone. Otherwise fall back to dialing the
    // client's mobile.
    if (client.elevenAgentId) {
      const signedUrl = await getElevenLabsSignedUrl(client.elevenAgentId);
      if (signedUrl) {
        return new NextResponse(
          buildElevenLabsStreamTwiml({
            agentId: client.elevenAgentId,
            callSid: callSid,
            fromNumber: from || "",
            toNumber: to || "",
            clientId: client.clientId,
            signedUrl,
          }),
          { headers: { "Content-Type": "text/xml" } },
        );
      }
      // signed-url fetch failed — log but fall through to dial-phone path
      console.warn(
        `[voice-webhook] ElevenLabs configured but signed-url fetch failed; falling back to dial for client ${client.clientId}`,
      );
    }

    // TwiML forwarding: connect to the client's fallback phone if set.
    if (client.phone) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${xmlEscape(client.businessName || "us")}. Please hold while we connect you.</Say>
  <Dial callerId="${xmlEscape(to || "")}">${xmlEscape(client.phone)}</Dial>
</Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }
  }

  // No owning client or no forwarding number — play a default message.
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We are unable to take your call right now. Please try again later.</Say>
</Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}
