import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { sendEmail } from "@/lib/email";

// POST /api/review-requests/send-manual
// Body: { config_id, client_id }
// Sends a review request immediately to the specified client using the given config.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { config_id, client_id } = await request.json();
  if (!config_id || !client_id) {
    return NextResponse.json({ error: "config_id and client_id are required" }, { status: 400 });
  }

  // Verify config belongs to this profile
  const { data: config, error: configErr } = await supabase
    .from("review_request_configs")
    .select("*")
    .eq("id", config_id)
    .eq("profile_id", ownerId)
    .single();

  if (configErr || !config) {
    return NextResponse.json({ error: "Config not found or access denied" }, { status: 404 });
  }

  // Load client
  const serviceSupabase = createServiceClient();
  const { data: client, error: clientErr } = await serviceSupabase
    .from("clients")
    .select("contact_name, email, phone")
    .eq("id", client_id)
    .eq("profile_id", ownerId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found or access denied" }, { status: 404 });
  }

  // Load profile for business_name
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("business_name, full_name")
    .eq("id", ownerId)
    .maybeSingle();

  const businessName = profile?.business_name || profile?.full_name || "us";
  const nameParts = (client.contact_name || "").split(" ");
  const firstName = nameParts[0] || "there";
  const lastName = nameParts.slice(1).join(" ");

  const message = (config.message_template as string)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{last_name\}\}/g, lastName)
    .replace(/\{\{review_url\}\}/g, config.review_url)
    .replace(/\{\{business_name\}\}/g, businessName);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  let dispatchOk = false;
  let dispatchError: string | null = null;

  try {
    if (config.channel === "sms" || config.channel === "whatsapp") {
      if (!client.phone) {
        return NextResponse.json({ error: "Client has no phone number on file" }, { status: 422 });
      }
      // Direct Twilio REST — no usage gate for manual sends (operator-initiated)
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
      if (!twilioSid || !twilioToken || !twilioFrom) {
        return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
      }
      const form = new URLSearchParams({
        To: client.phone,
        From: twilioFrom,
        Body: message,
      });
      const tw = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      if (!tw.ok) {
        const body = await tw.json().catch(() => ({}));
        dispatchError = (body as { message?: string }).message || "Twilio error";
      } else {
        dispatchOk = true;
      }
    } else if (config.channel === "email") {
      if (!client.email) {
        return NextResponse.json({ error: "Client has no email on file" }, { status: 422 });
      }
      dispatchOk = await sendEmail({
        to: client.email,
        subject: "Thanks for your visit — leave us a review!",
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <p style="font-size:15px;line-height:1.6;color:#222;">${message.replace(/\n/g, "<br/>")}</p>
          <p style="margin-top:20px;"><a href="${config.review_url}" style="background:#c8a855;color:#000;padding:10px 22px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px;">Leave a Review</a></p>
        </div>`,
        text: message,
      });
      if (!dispatchOk) dispatchError = "Email delivery failed (SMTP error)";
    }
  } catch (err) {
    dispatchError = String(err);
  }

  // Log the attempt regardless of outcome
  await serviceSupabase.from("review_requests_sent").insert({
    config_id: config.id,
    event_id: null,
    client_id,
    channel: config.channel,
    status: dispatchOk ? "sent" : "failed",
    sent_at: new Date().toISOString(),
  });

  if (!dispatchOk) {
    return NextResponse.json({ error: dispatchError || "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ sent: true, channel: config.channel });
}
