import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Twilio Voice webhook — handles inbound calls to client numbers
// Returns TwiML to greet caller and optionally forward to client's phone
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");

  const formData = await request.formData();
  const from = formData.get("From") as string;
  const to = formData.get("To") as string;
  const callSid = formData.get("CallSid") as string;

  // Log the inbound call
  if (clientId) {
    await supabase.from("outreach_log").insert({
      platform: "phone",
      business_name: from || "Unknown",
      recipient_handle: to,
      message_text: `Inbound call from ${from}`,
      status: "replied",
      sent_at: new Date().toISOString(),
      metadata: { direction: "inbound", client_id: clientId, call_sid: callSid },
    });

    // Notify on Telegram
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📞 Inbound Call\n\nFrom: ${from}\nTo: ${to}\nClient: ${clientId}`,
        }),
      }).catch(() => {});
    }

    // Try to find the client's forwarding number
    const { data: client } = await supabase
      .from("clients")
      .select("phone, business_name")
      .eq("id", clientId)
      .single();

    if (client?.phone) {
      // Forward the call to the client's phone
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${client.business_name || "us"}. Please hold while we connect you.</Say>
  <Dial callerId="${to}">${client.phone}</Dial>
</Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }
  }

  // Default: play a message and hang up
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We are unable to take your call right now. Please try again later.</Say>
</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
