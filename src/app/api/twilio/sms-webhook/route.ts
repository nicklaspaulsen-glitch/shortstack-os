import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage, findContactByIdentifier, resolveUserIdForChannel } from "@/lib/conversations";
import crypto from "crypto";

// Twilio SMS + WhatsApp webhook — receives inbound messages to client numbers.
// Routes by client_id query param set during provisioning. WhatsApp messages
// arrive with "whatsapp:+14155551234" prefix on From/To — we detect that
// and upsert as channel='whatsapp'. Otherwise channel='sms'.
// TODO: Add rate limiting in production to prevent webhook flooding

function validateTwilioSignature(
  request: NextRequest,
  body: URLSearchParams,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Build the full URL Twilio used to generate the signature
  const url = request.url;

  // Sort the POST parameters and append them to the URL
  const sortedParams = Array.from(body.entries()).sort(([a], [b]) => a.localeCompare(b));
  let data = url;
  for (const [key, value] of sortedParams) {
    data += key + value;
  }

  // Compute HMAC-SHA1
  const computed = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");

  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;
  const to = formData.get("To") as string;

  // Validate Twilio signature to ensure this request is from Twilio
  const bodyParams = new URLSearchParams();
  formData.forEach((value, key) => bodyParams.append(key, String(value)));
  if (!validateTwilioSignature(request, bodyParams)) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 403, headers: { "Content-Type": "text/xml" } }
    );
  }

  // Detect WhatsApp by the "whatsapp:" prefix on the From number.
  const isWhatsApp = (from || "").startsWith("whatsapp:");
  const channel = isWhatsApp ? "whatsapp" : "sms";
  const cleanFrom = isWhatsApp ? from.replace(/^whatsapp:/, "") : from;
  const cleanTo = isWhatsApp ? to.replace(/^whatsapp:/, "") : to;

  // Log inbound message
  if (clientId) {
    await supabase.from("outreach_log").insert({
      platform: channel,
      business_name: cleanFrom,
      recipient_handle: cleanTo,
      message_text: body,
      status: "replied",
      sent_at: new Date().toISOString(),
      metadata: { direction: "inbound", client_id: clientId, from, to, channel },
    });

    // Check if this matches a lead and update status
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", cleanFrom)
      .single();

    if (lead) {
      await supabase.from("leads").update({ status: "replied" }).eq("id", lead.id);
    }

    // ── Unified Conversations: upsert + insert inbound message ──
    // Resolve the agency owner by matching the Twilio number (To) to a client.
    const ownerId = await resolveUserIdForChannel(supabase, channel, { clientPhoneTo: cleanTo });
    if (ownerId) {
      const contactId = await findContactByIdentifier(supabase, ownerId, cleanFrom);
      await upsertInboundMessage({
        supabase,
        userId: ownerId,
        channel,
        externalThreadId: cleanFrom, // one thread per phone number
        fromIdentifier: cleanFrom,
        toIdentifier: cleanTo,
        body,
        externalMessageId: formData.get("MessageSid") as string | null ?? undefined,
        contactId,
      });
    }

    // Telegram notification
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📱 Inbound SMS\n\nFrom: ${from}\nTo: ${to}\nMessage: ${body}`,
        }),
      }).catch(() => {});
    }
  }

  // Return TwiML empty response (no auto-reply)
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  );
}
