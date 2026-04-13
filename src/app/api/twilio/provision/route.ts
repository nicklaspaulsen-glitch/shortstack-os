import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Provision a Twilio phone number for a client
// Enables SMS outreach and call forwarding
//
// Required env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//
// The provisioned number is stored on the client record
// and can receive inbound SMS (routed via webhook)

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, area_code, country } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    // 1. Search for available numbers
    const searchParams = new URLSearchParams({
      SmsEnabled: "true",
      VoiceEnabled: "true",
      ...(area_code ? { AreaCode: area_code } : {}),
    });

    const countryCode = country || "US";
    const searchRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${countryCode}/Local.json?${searchParams}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const searchData = await searchRes.json();

    if (!searchData.available_phone_numbers?.length) {
      return NextResponse.json({ error: "No numbers available for that area code. Try a different one." }, { status: 404 });
    }

    const number = searchData.available_phone_numbers[0];

    // 2. Purchase the number
    const buyRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          PhoneNumber: number.phone_number,
          SmsUrl: `${baseUrl}/api/twilio/sms-webhook?client_id=${client_id}`,
          VoiceUrl: `${baseUrl}/api/twilio/voice-webhook?client_id=${client_id}`,
          FriendlyName: `ShortStack - ${client_id}`,
        }),
      }
    );

    const buyData = await buyRes.json();

    if (!buyRes.ok) {
      return NextResponse.json({ error: buyData.message || "Failed to provision number" }, { status: 500 });
    }

    // 3. Save to client record
    await supabase
      .from("clients")
      .update({
        metadata: {
          twilio_phone: buyData.phone_number,
          twilio_sid: buyData.sid,
          twilio_provisioned_at: new Date().toISOString(),
        },
      })
      .eq("id", client_id);

    // 4. Log
    await supabase.from("trinity_log").insert({
      action_type: "custom",
      description: `Phone number provisioned: ${buyData.friendly_name} (${buyData.phone_number})`,
      client_id,
      status: "completed",
      result: {
        type: "twilio_provision",
        phone: buyData.phone_number,
        sid: buyData.sid,
      },
    });

    return NextResponse.json({
      success: true,
      phone_number: buyData.phone_number,
      sid: buyData.sid,
    });
  } catch (err) {
    console.error("Twilio provision error:", err);
    return NextResponse.json({ error: "Failed to provision phone number. Please try again." }, { status: 500 });
  }
}

// List available numbers without purchasing
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const areaCode = searchParams.get("area_code") || "";
  const country = searchParams.get("country") || "US";

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    SmsEnabled: "true",
    VoiceEnabled: "true",
    ...(areaCode ? { AreaCode: areaCode } : {}),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${country}/Local.json?${params}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const data = await res.json();

    return NextResponse.json({
      numbers: (data.available_phone_numbers || []).slice(0, 10).map((n: Record<string, string>) => ({
        phone: n.phone_number,
        locality: n.locality,
        region: n.region,
      })),
    });
  } catch (err) {
    console.error("Twilio search error:", err);
    return NextResponse.json({ error: "Failed to search for available numbers" }, { status: 500 });
  }
}
