import { NextRequest, NextResponse } from "next/server";

/* ── Types ── */
interface InboundCallPayload {
  caller_phone: string;
  caller_name?: string;
  call_sid: string;
}

interface QualificationQuestion {
  id: string;
  text: string;
  required: boolean;
}

interface RoutingRule {
  condition: string;
  action: string;
  detail: string;
  enabled: boolean;
}

interface ElevenLabsVoiceConfig {
  voice_id: string;
  voice_name: string;
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  language: string;
}

/* ── Default Configuration ── */
const DEFAULT_GREETING =
  "Thank you for calling ShortStack Digital. My name is Ava, your virtual receptionist. How can I help you today?";

const DEFAULT_QUESTIONS: QualificationQuestion[] = [
  { id: "q1", text: "What service are you interested in?", required: true },
  { id: "q2", text: "What's your timeline for getting started?", required: true },
  { id: "q3", text: "What's your budget range?", required: true },
  { id: "q4", text: "How did you hear about us?", required: false },
  { id: "q5", text: "What's the best email to reach you?", required: false },
];

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  { condition: "caller_qualified", action: "book_calendly", detail: "Offer available time slots and confirm booking", enabled: true },
  { condition: "existing_client", action: "transfer_team", detail: "Warm transfer with context summary", enabled: true },
  { condition: "spam_detected", action: "end_call", detail: "Politely end after 10 seconds", enabled: true },
  { condition: "after_hours", action: "voicemail", detail: "Collect name, number, and reason", enabled: true },
  { condition: "human_requested", action: "transfer_team", detail: "Transfer to next available agent", enabled: true },
];

const DEFAULT_VOICE_CONFIG: ElevenLabsVoiceConfig = {
  voice_id: "EXAVITQu4vr4xnSDxMaL",
  voice_name: "Ava (Professional Female)",
  model_id: "eleven_turbo_v2_5",
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  speed: 1.0,
  language: "en-US",
};

/* ── POST handler ── */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InboundCallPayload;
    const { caller_phone, caller_name, call_sid } = body;

    if (!caller_phone || !call_sid) {
      return NextResponse.json(
        { error: "Missing required fields: caller_phone and call_sid" },
        { status: 400 }
      );
    }

    // Log the inbound call for observability
    console.info(
      `[Voice Inbound] call_sid=${call_sid} phone=${caller_phone} name=${caller_name || "Unknown"} time=${new Date().toISOString()}`
    );

    // Build TwiML-style XML greeting response.
    //
    // SECURITY FIX (Apr 26): pre-fix this had a hardcoded
    // <Dial>+13055557890</Dial> fallback (a Florida number unrelated to
    // ShortStack) that fired whenever the Gather route 404'd. The
    // matching Gather handler at /api/voice/inbound/gather didn't exist
    // until today's commit — every inbound call's silence was being
    // routed to a stranger's phone.
    //
    // Now: if Gather fails (no speech detected), capture voicemail to
    // give the caller a way to leave a message instead of dialing a
    // random number.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${escapeXml(DEFAULT_GREETING)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/voice/inbound/gather">
    <Say voice="Polly.Joanna" language="en-US">Please tell me how I can assist you.</Say>
  </Gather>
  <Say voice="Polly.Joanna" language="en-US">I didn't catch that. Please leave a message after the tone and we'll call you back.</Say>
  <Record maxLength="60" playBeep="true" />
  <Say voice="Polly.Joanna" language="en-US">Got it. Thanks for calling.</Say>
</Response>`;

    // Return comprehensive JSON response with config
    return NextResponse.json({
      success: true,
      call_sid,
      caller: {
        phone: caller_phone,
        name: caller_name || "Unknown",
      },
      greeting: DEFAULT_GREETING,
      twiml,
      qualification: {
        questions: DEFAULT_QUESTIONS,
        scoring: {
          method: "weighted",
          threshold_qualified: 70,
          weights: {
            service_interest: 30,
            timeline: 25,
            budget: 25,
            engagement: 20,
          },
        },
      },
      routing: {
        rules: DEFAULT_ROUTING_RULES,
        default_action: "voicemail",
        // transfer_number intentionally omitted — pre-fix this advertised a
        // stranger's Florida number (+13055557890) as the transfer target.
        // Real transfers route through the live Twilio webhook
        // (/api/twilio/voice-webhook) using the agency's configured number.
        calendly_url: "https://calendly.com/shortstack-digital/strategy-call",
      },
      voice: DEFAULT_VOICE_CONFIG,
      business: {
        name: "ShortStack Digital",
        services: [
          "Social Media Management",
          "Website Design",
          "SEO",
          "Paid Advertising",
          "Brand Identity",
        ],
        pricing_tiers: [
          { name: "Starter", price: 497 },
          { name: "Growth", price: 997 },
          { name: "Scale", price: 1997 },
        ],
        hours: {
          monday: { open: "09:00", close: "18:00" },
          tuesday: { open: "09:00", close: "18:00" },
          wednesday: { open: "09:00", close: "18:00" },
          thursday: { open: "09:00", close: "18:00" },
          friday: { open: "09:00", close: "17:00" },
          saturday: null,
          sunday: null,
        },
      },
      metadata: {
        api_version: "1.0.0",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[Voice Inbound] Error:", err);
    return NextResponse.json(
      { error: "Internal server error processing inbound call" },
      { status: 500 }
    );
  }
}

/* ── GET handler for health check ── */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "voice-receptionist-inbound",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}

/* ── Helpers ── */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
