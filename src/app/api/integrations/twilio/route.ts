import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Twilio Integration — SMS, voice calls, phone number management
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

function getConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  };
}

function twilioAuth() {
  const cfg = getConfig();
  return `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`;
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getConfig();
  if (!cfg.accountSid) return NextResponse.json({ error: "Twilio not configured", connected: false }, { status: 500 });

  const action = request.nextUrl.searchParams.get("action") || "messages";

  try {
    if (action === "messages") {
      const limit = request.nextUrl.searchParams.get("limit") || "20";
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json?PageSize=${limit}`,
        { headers: { Authorization: twilioAuth() } }
      );
      const data = await res.json();
      return NextResponse.json({
        success: true,
        messages: (data.messages || []).map((m: Record<string, unknown>) => ({
          sid: m.sid, to: m.to, from: m.from, body: m.body,
          status: m.status, direction: m.direction, date_sent: m.date_sent,
        })),
      });
    }

    if (action === "calls") {
      const limit = request.nextUrl.searchParams.get("limit") || "20";
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json?PageSize=${limit}`,
        { headers: { Authorization: twilioAuth() } }
      );
      const data = await res.json();
      return NextResponse.json({
        success: true,
        calls: (data.calls || []).map((c: Record<string, unknown>) => ({
          sid: c.sid, to: c.to, from: c.from, status: c.status,
          direction: c.direction, duration: c.duration, start_time: c.start_time,
        })),
      });
    }

    if (action === "account") {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}.json`,
        { headers: { Authorization: twilioAuth() } }
      );
      const data = await res.json();
      return NextResponse.json({
        success: true,
        account: { name: data.friendly_name, status: data.status, type: data.type, phone: cfg.phoneNumber },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Twilio error: ${err}` }, { status: 500 });
  }
}

// Send SMS or initiate a call
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getConfig();
  if (!cfg.accountSid) return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });

  const { action, to, client_id, ...params } = await request.json();
  if (!to) return NextResponse.json({ error: "Recipient number (to) required" }, { status: 400 });

  try {
    if (action === "send_sms") {
      const { body } = params;
      if (!body) return NextResponse.json({ error: "Message body required" }, { status: 400 });

      const formData = new URLSearchParams({
        To: to,
        From: params.from || cfg.phoneNumber,
        Body: body,
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
          body: formData,
        }
      );
      const data = await res.json();

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `SMS sent to ${to} via Twilio`,
          client_id,
          status: data.sid ? "completed" : "failed",
          result: { type: "twilio_sms", sid: data.sid, to },
        });
      }

      return NextResponse.json({ success: !!data.sid, sid: data.sid, status: data.status });
    }

    if (action === "make_call") {
      const { twiml_url } = params;
      const formData = new URLSearchParams({
        To: to,
        From: params.from || cfg.phoneNumber,
        Url: twiml_url || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/twilio/twiml`,
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`,
        {
          method: "POST",
          headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
          body: formData,
        }
      );
      const data = await res.json();

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Call initiated to ${to} via Twilio`,
          client_id,
          status: data.sid ? "completed" : "failed",
          result: { type: "twilio_call", sid: data.sid, to },
        });
      }

      return NextResponse.json({ success: !!data.sid, sid: data.sid, status: data.status });
    }

    return NextResponse.json({ error: "Unknown action. Use: send_sms, make_call" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Twilio error: ${err}` }, { status: 500 });
  }
}
