import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { importPhoneNumber, createAgent, DEFAULT_COLD_CALL_PROMPT, DEFAULT_FIRST_MESSAGE } from "@/lib/services/eleven-agents";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { checkLimit } from "@/lib/usage-limits";

// Provision a Twilio phone number for a client
// Full pipeline: Twilio purchase → ElevenLabs phone import → ElevenAgent creation
// Gives each client their own phone number for AI calls + SMS
//
// Required env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ELEVENLABS_API_KEY

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, area_code, country, agent_name, voice_id, skip_agent } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // SECURITY: verify the caller owns this client BEFORE any Twilio purchase.
  // Previously this route accepted any authed user's body-supplied client_id
  // and provisioned a phone number on ShortStack's tab (ongoing $1/mo) and
  // attached it to another tenant's client.
  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx || !ctx.clientId) {
    return NextResponse.json({ error: "Client not found or access denied" }, { status: 403 });
  }
  const ownerId = ctx.ownerId;

  // Plan-tier concurrent cap: block new number purchase when the agency is
  // already at its tier's phone_numbers ceiling. Returns 402 on cap hit so the
  // client can surface an upgrade prompt. Uses the REAL owner's tier so a
  // Starter user can't bypass the cap by targeting an Enterprise tenant.
  const gate = await checkLimit(ownerId, "phone_numbers", 1);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Phone number limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSid || !twilioToken) {
    return NextResponse.json({ error: "Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
  const serviceSupabase = createServiceClient();

  // Get client info for naming (ownership already verified above).
  const { data: client } = await serviceSupabase
    .from("clients")
    .select("business_name, industry")
    .eq("id", ctx.clientId)
    .eq("profile_id", ownerId)
    .single();

  const clientName = client?.business_name || "Client";

  try {
    // ── Step 1: Search for available Twilio numbers ──
    const searchParams = new URLSearchParams({
      SmsEnabled: "true",
      VoiceEnabled: "true",
      ...(area_code ? { AreaCode: area_code } : {}),
    });

    const countryCode = country || "US";
    const searchRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/AvailablePhoneNumbers/${countryCode}/Local.json?${searchParams}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const searchData = await searchRes.json();

    if (!searchData.available_phone_numbers?.length) {
      return NextResponse.json({ error: "No numbers available for that area code. Try a different one." }, { status: 404 });
    }

    const number = searchData.available_phone_numbers[0];

    // ── Step 2: Purchase the Twilio number ──
    const buyRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers.json`,
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
          FriendlyName: `ShortStack - ${clientName}`,
        }),
      }
    );

    const buyData = await buyRes.json();

    if (!buyRes.ok) {
      return NextResponse.json({ error: buyData.message || "Failed to provision number" }, { status: 500 });
    }

    // ── Step 3: Import phone number to ElevenLabs ──
    let elevenPhoneId = "";
    const elevenResult = await importPhoneNumber({
      phoneNumber: buyData.phone_number,
      label: `${clientName} Caller`,
      twilioSid,
      twilioToken,
    });

    if (elevenResult.error) {
      console.warn("[provision] ElevenLabs phone import failed:", elevenResult.error);
      // Non-fatal — the number still works for SMS, just not AI calls yet
    } else {
      elevenPhoneId = elevenResult.phoneNumberId;
    }

    // ── Step 4: Create a per-client ElevenAgent (unless skipped) ──
    let elevenAgentId = "";
    if (!skip_agent && elevenPhoneId) {
      const agentResult = await createAgent({
        name: agent_name || `${clientName} AI Caller`,
        firstMessage: DEFAULT_FIRST_MESSAGE,
        systemPrompt: DEFAULT_COLD_CALL_PROMPT,
        voiceId: voice_id,
        language: "en",
        maxDurationSeconds: 300,
      });

      if (agentResult.error) {
        console.warn("[provision] ElevenAgent creation failed:", agentResult.error);
      } else {
        elevenAgentId = agentResult.agentId;
      }
    }

    // ── Step 5: Save everything to client record (scoped to owner) ──
    await serviceSupabase
      .from("clients")
      .update({
        twilio_phone_number: buyData.phone_number,
        twilio_phone_sid: buyData.sid,
        ...(elevenPhoneId && { eleven_phone_number_id: elevenPhoneId }),
        ...(elevenAgentId && { eleven_agent_id: elevenAgentId }),
      })
      .eq("id", ctx.clientId)
      .eq("profile_id", ownerId);

    // ── Step 6: Log ──
    await serviceSupabase.from("trinity_log").insert({
      action_type: "custom",
      description: `Phone provisioned for ${clientName}: ${buyData.phone_number}${elevenAgentId ? " + AI agent created" : ""}`,
      client_id,
      status: "completed",
      result: {
        type: "client_phone_provision",
        phone: buyData.phone_number,
        twilio_sid: buyData.sid,
        eleven_phone_id: elevenPhoneId || null,
        eleven_agent_id: elevenAgentId || null,
      },
    });

    return NextResponse.json({
      success: true,
      phone_number: buyData.phone_number,
      twilio_sid: buyData.sid,
      eleven_phone_number_id: elevenPhoneId || null,
      eleven_agent_id: elevenAgentId || null,
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
