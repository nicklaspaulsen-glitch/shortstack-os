import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// POST /api/twilio/test-sms
// Fire a single test SMS from a client's provisioned Twilio number to a
// personal phone the agency owner specifies. Used by /dashboard/phone-setup
// after a successful number purchase so the owner can verify the number
// actually works end-to-end.
//
// Body:  { client_id, to_number, message }
// Auth:  requireOwnedClient — the caller must own the client
// Limits: one send per call, no plan-tier metering (test messages are a
//         single-digit number per provisioning; real outreach uses
//         /api/twilio/send-sms which IS metered).

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, to_number, message } = await request.json();
  if (!client_id || !to_number || !message) {
    return NextResponse.json(
      { error: "client_id, to_number, and message are required" },
      { status: 400 },
    );
  }

  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx || !ctx.clientId) {
    return NextResponse.json({ error: "Client not found or access denied" }, { status: 403 });
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  if (!twilioSid || !twilioToken) {
    return NextResponse.json(
      { error: "Twilio not configured. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN." },
      { status: 500 },
    );
  }

  // Pull the client's Twilio number (ownership already verified above)
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("twilio_phone_number, business_name")
    .eq("id", ctx.clientId)
    .eq("profile_id", ctx.ownerId)
    .single();
  const fromNumber = (client as { twilio_phone_number?: string } | null)?.twilio_phone_number;
  if (!fromNumber) {
    return NextResponse.json(
      { error: "This client has no provisioned Twilio number yet." },
      { status: 400 },
    );
  }

  // Validate recipient phone format — E.164 required
  const cleaned = String(to_number).replace(/[^\d+]/g, "");
  if (cleaned.length < 8 || cleaned.length > 16) {
    return NextResponse.json(
      { error: "Invalid phone number. Use E.164 format, e.g. +15551234567." },
      { status: 400 },
    );
  }
  const toE164 = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

  const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: toE164,
          From: fromNumber,
          Body: String(message).slice(0, 320),
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error: data.message || `Twilio returned ${res.status}`,
          code: data.code,
        },
        { status: res.status },
      );
    }

    // Audit log — record the test send so it shows up in outreach_log for visibility
    await service.from("trinity_log").insert({
      user_id: ctx.ownerId,
      client_id: ctx.clientId,
      action_type: "custom",
      description: `Test SMS sent from ${fromNumber} to ${toE164}`,
      status: "completed",
      result: { sid: data.sid, from: fromNumber, to: toE164 },
    });

    return NextResponse.json({
      success: true,
      sid: data.sid,
      from: fromNumber,
      to: toE164,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Twilio send failed" },
      { status: 500 },
    );
  }
}
