import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

interface SendManualRequest {
  to: string;
  body: string;
  from?: string;
  contact_id?: string;
  contact_name?: string;
}

function toE164(raw: string): string | null {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (cleaned.length < 7 || cleaned.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

// POST /api/sms/send-manual
// Send a single SMS through Twilio from the dialer's manual SMS console.
// Plan-tier metered (usage_limits) + records to outreach_log so the
// existing inbox aggregator picks it up.
//
// The bulk endpoint is /api/sms/send-bulk. Routes are split because:
//   - Single sends should be synchronous; bulk should queue + return jobId.
//   - Different validation surface (recipients array shape).
//   - Different rate-limit semantics (bulk needs throttle_ms knob).
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<SendManualRequest>;
  if (!body.to) {
    return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
  }
  const message = (body.body || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Empty SMS body" }, { status: 400 });
  }
  if (message.length > 1600) {
    // 10 segments cap — SMS over 10 segments is a smell, fail fast.
    return NextResponse.json({ error: "SMS body exceeds 1600 chars (10 segments)" }, { status: 400 });
  }

  const toNumber = toE164(body.to);
  if (!toNumber) {
    return NextResponse.json({ error: "Invalid 'to' phone number" }, { status: 400 });
  }

  // Plan-tier meter check (single SMS counts as 1 unit).
  const gate = await checkLimit(ownerId, "sms", 1);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Monthly SMS limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }

  const fromNumber =
    (body.from && toE164(body.from)) ||
    process.env.TWILIO_DEFAULT_NUMBER ||
    "";
  if (!fromNumber) {
    return NextResponse.json({ error: "No 'from' number configured" }, { status: 400 });
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toNumber,
        From: fromNumber,
        Body: message,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[sms/send-manual] twilio error ${res.status}:`, errText);
    return NextResponse.json(
      { error: `Twilio error ${res.status}` },
      { status: 502 },
    );
  }

  const twilioData = (await res.json()) as { sid?: string };

  // Plan-tier usage metering — single SMS, single unit.
  await recordUsage(ownerId, "sms", 1, {
    contact_id: body.contact_id || null,
    platform: "sms",
    twilio_sid: twilioData.sid,
  });

  // Log to outreach_log so existing inbox aggregation picks it up.
  const service = createServiceClient();
  await service.from("outreach_log").insert({
    platform: "sms",
    business_name: body.contact_name || null,
    recipient_handle: toNumber,
    message_text: message,
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: {
      direction: "outbound",
      via: "dialer",
      twilio_sid: twilioData.sid,
      contact_id: body.contact_id || null,
    },
  });

  return NextResponse.json({
    success: true,
    twilio_sid: twilioData.sid || null,
    to: toNumber,
    from: fromNumber,
  });
}
