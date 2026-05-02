import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ── Twilio signature validation ──────────────────────────────────────────────
 * Applied on POST only. Returns false (→ 403) when:
 *   1. TWILIO_AUTH_TOKEN is unset — fail-closed in production.
 *   2. The x-twilio-signature header is missing or forged.
 *
 * The voice/inbound route was previously unprotected (CRITICAL — May 3).
 * Any internet actor could POST arbitrary caller_phone/call_sid values and
 * receive the full voice config dump (ElevenLabs voice_id, pricing tiers,
 * routing rules, qualification questions). Fixed with Twilio HMAC-SHA1.
 */
function validateTwilioSignature(request: NextRequest, body: URLSearchParams): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[voice/inbound] TWILIO_AUTH_TOKEN not set — rejecting all POST requests");
    return false;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Reconstruct the signed string: full URL + sorted POST params
  const url = request.url;
  const sorted = Array.from(body.entries()).sort(([a], [b]) => a.localeCompare(b));
  let data = url;
  for (const [key, val] of sorted) data += key + val;

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  // Timing-safe compare
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

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
    // Clone the request text before consuming it as JSON, so we can also
    // validate the Twilio HMAC-SHA1 signature over the raw URL-encoded body.
    // Twilio sends form-encoded POSTs, not JSON — handle both gracefully.
    const contentType = request.headers.get("content-type") ?? "";
    let body: InboundCallPayload;
    let rawParams: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      rawParams = new URLSearchParams(text);
      body = {
        caller_phone: rawParams.get("From") ?? rawParams.get("caller_phone") ?? "",
        caller_name: rawParams.get("CallerName") ?? rawParams.get("caller_name") ?? undefined,
        call_sid: rawParams.get("CallSid") ?? rawParams.get("call_sid") ?? "",
      };
    } else {
      body = (await request.json()) as InboundCallPayload;
      rawParams = new URLSearchParams(
        Object.entries(body as unknown as Record<string, string>).map(([k, v]) => [k, String(v ?? "")])
      );
    }

    // Validate Twilio signature — fail-closed when TWILIO_AUTH_TOKEN is set.
    if (!validateTwilioSignature(request, rawParams)) {
      console.warn("[voice/inbound] Twilio signature validation failed — rejecting POST");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
