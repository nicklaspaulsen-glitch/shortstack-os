import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Direct Messaging — Send SMS (Twilio) or email (Resend) to leads/clients.
// GHL path removed Apr 21 — all sends now go through native providers.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to_phone, to_email, message, channel, lead_id, client_id, subject } = await request.json();

  const results: Record<string, boolean> = {};
  let failureReason: string | null = null;

  // SMS via Twilio
  if (channel === "sms" && to_phone) {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_DEFAULT_NUMBER;
    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: to_phone, From: twilioFrom, Body: String(message || "") }),
          },
        );
        results.sms = smsRes.ok;
        if (!smsRes.ok) failureReason = `Twilio returned ${smsRes.status}`;
      } catch (err) {
        results.sms = false;
        failureReason = err instanceof Error ? err.message : "Twilio send failed";
      }
    } else {
      failureReason = "Twilio is not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_DEFAULT_NUMBER)";
    }
  }

  // Email via Resend (sendEmail helper wraps Resend SMTP)
  if (channel === "email" && to_email) {
    try {
      const sent = await sendEmail({
        to: to_email,
        subject: subject || "Message from ShortStack",
        html: `<p>${String(message || "").replace(/\n/g, "<br>")}</p>`,
      });
      results.email = sent;
      if (!sent && !failureReason) failureReason = "Email send returned false (check SMTP config)";
    } catch (err) {
      results.email = false;
      failureReason = err instanceof Error ? err.message : "Email send failed";
    }
  }

  const anySent = Object.values(results).some(v => v);

  // Log the message
  await supabase.from("trinity_log").insert({
    action_type: "sms_campaign",
    description: `Message ${anySent ? "sent" : "failed"} via ${channel || "unknown"}: ${(message || "").substring(0, 50)}...`,
    client_id: client_id || null,
    status: anySent ? "completed" : "failed",
    result: { channel, results, lead_id: lead_id || null, failure_reason: failureReason },
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: anySent,
    results,
    error: anySent ? undefined : (failureReason || "No message was sent — missing channel or provider config"),
  });
}
