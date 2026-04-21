import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  validateTwilioSignature,
  resolveClientByToNumber,
  resolveClientById,
  mapTwilioStatus,
} from "@/lib/services/voice-calls";

// Twilio Voice webhook — handles inbound calls to client numbers.
//
// Fires on the very first leg of a Twilio voice call (the VoiceUrl). We:
//   1. Validate Twilio signature (skipped with warning if TWILIO_AUTH_TOKEN
//      isn't set — dev/staging only).
//   2. Resolve the owning client by `To` number, then by ?client_id= fallback
//      (the provisioned webhook URL still carries it).
//   3. Upsert a `voice_calls` row keyed by twilio_call_sid — "ringing" status.
//   4. Return TwiML that either forwards to the client's phone or plays a
//      polite fallback.
//
// End-of-call events (duration, recording, completed status) arrive at
// /api/twilio/voice-status-callback which owns the rest of the lifecycle.
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

    // TwiML forwarding: connect to the client's fallback phone if set.
    if (client.phone) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${client.businessName || "us"}. Please hold while we connect you.</Say>
  <Dial callerId="${to || ""}">${client.phone}</Dial>
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
