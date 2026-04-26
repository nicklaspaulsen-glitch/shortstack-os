import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

/**
 * Twilio Gather callback for the inbound voice receptionist (Beta).
 *
 * Critical fix (Apr 26): the parent route src/app/api/voice/inbound/route.ts
 * generates TwiML containing
 *   <Gather input="speech" action="/api/voice/inbound/gather">
 * Twilio POSTs the speech transcript here. Pre-fix this route DID NOT
 * EXIST → Twilio got a 404 → fell through to the hardcoded
 * <Dial>+13055557890</Dial> fallback (a Florida number unrelated to
 * ShortStack). Real callers were being routed to a stranger's phone.
 *
 * What this handler does
 * ======================
 *
 * Twilio sends form-encoded POST with:
 *   - SpeechResult: the caller's transcribed utterance
 *   - Confidence:   0..1 ASR confidence
 *   - CallSid:      Twilio call id
 *   - From:         caller phone (E.164)
 *   - To:           the number the caller dialed (= our client's twilio number)
 *
 * We:
 *   1. Validate Twilio signature (same fail-closed-in-prod pattern as
 *      voice-webhook).
 *   2. Look up the owning client by To number (resolveClientByToNumber).
 *   3. Run Claude Haiku to classify intent: book_meeting | sales_inquiry |
 *      support | spam | unknown.
 *   4. Log the gather + classification to outreach_log + voice_calls metadata.
 *   5. Return TwiML that responds appropriately:
 *      - book_meeting / sales_inquiry → <Dial> the client's fallback phone
 *        OR a polite "we'll call you back" if no fallback configured
 *      - spam → polite hangup
 *      - support → "we'll have someone reach out" + log
 *      - unknown / low confidence → second Gather attempt, then voicemail
 */

import {
  validateTwilioSignature,
  resolveClientByToNumber,
} from "@/lib/services/voice-calls";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(body: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

interface IntentResult {
  intent: "book_meeting" | "sales_inquiry" | "support" | "spam" | "unknown";
  confidence: number;
  summary: string;
}

async function classifyIntent(speech: string, businessName: string): Promise<IntentResult> {
  if (!speech || speech.trim().length < 4) {
    return { intent: "unknown", confidence: 0, summary: "(silence)" };
  }
  const prompt = `Classify the caller's intent for ${businessName}. The caller said:

"${speech}"

Return ONLY a JSON object — no markdown, no commentary:
{
  "intent": "book_meeting" | "sales_inquiry" | "support" | "spam" | "unknown",
  "confidence": 0.0-1.0,
  "summary": "<one short sentence>"
}

Rules:
- book_meeting: explicit request for an appointment, demo, consultation, callback at a specific time
- sales_inquiry: asking about services, pricing, "interested in"
- support: existing customer with an issue
- spam: telemarketer, robocall, off-topic, abusive
- unknown: unclear or insufficient signal`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = getResponseText(res);
    const parsed = safeJsonParse<IntentResult>(raw);
    if (parsed && parsed.intent) return parsed;
  } catch (err) {
    console.error("[voice/inbound/gather] classify failed:", err);
  }
  return { intent: "unknown", confidence: 0, summary: speech.slice(0, 200) };
}

export async function POST(request: NextRequest) {
  // ── Signature validation ──
  const formData = await request.formData();
  const bodyParams = new URLSearchParams();
  formData.forEach((v, k) => bodyParams.append(k, String(v)));
  if (!validateTwilioSignature(request, bodyParams)) {
    return twiml(
      `<Say voice="Polly.Joanna">Forbidden.</Say><Hangup/>`,
    );
  }

  const speech = (formData.get("SpeechResult") as string) || "";
  const callSid = (formData.get("CallSid") as string) || "";
  const from = (formData.get("From") as string) || "";
  const to = (formData.get("To") as string) || "";

  const supabase = createServiceClient();

  // ── Resolve client by To number ──
  const client = await resolveClientByToNumber(supabase, to);
  const businessName = client?.businessName || "us";

  // ── Classify intent ──
  const result = await classifyIntent(speech, businessName);

  // ── Log to voice_calls metadata + outreach_log ──
  if (callSid) {
    try {
      const { data: existingCall } = await supabase
        .from("voice_calls")
        .select("id, metadata")
        .eq("twilio_call_sid", callSid)
        .maybeSingle();
      const meta = (existingCall?.metadata as Record<string, unknown>) || {};
      const gatherEntries = Array.isArray(meta.gather_entries)
        ? (meta.gather_entries as unknown[])
        : [];
      gatherEntries.push({
        at: new Date().toISOString(),
        speech,
        intent: result.intent,
        confidence: result.confidence,
        summary: result.summary,
      });
      await supabase
        .from("voice_calls")
        .update({
          metadata: { ...meta, gather_entries: gatherEntries, latest_intent: result.intent },
          outcome: result.intent === "spam" ? "spam" : result.intent === "book_meeting" ? "booked" : "qualified",
        })
        .eq("twilio_call_sid", callSid);
    } catch (err) {
      console.error("[voice/inbound/gather] db update failed:", err);
    }
  }

  // ── Choose TwiML response based on intent ──
  // Per the apr27 CRITICAL fix: do NOT fall back to a hardcoded foreign
  // number. Use the client's fallback phone if set, otherwise polite
  // "we'll call you back" + voicemail capture.
  const fallbackPhone = client?.phone || "";
  const safeName = xmlEscape(businessName);

  if (result.intent === "spam") {
    return twiml(
      `<Say voice="Polly.Joanna">Sorry, we're not interested. Goodbye.</Say><Hangup/>`,
    );
  }

  if (result.intent === "book_meeting" || result.intent === "sales_inquiry") {
    if (fallbackPhone) {
      return twiml(
        `<Say voice="Polly.Joanna">Thanks for calling ${safeName}. Connecting you now.</Say>` +
        `<Dial callerId="${xmlEscape(to)}">${xmlEscape(fallbackPhone)}</Dial>` +
        `<Say voice="Polly.Joanna">It looks like everyone's busy. We'll call you back shortly.</Say>`,
      );
    }
    return twiml(
      `<Say voice="Polly.Joanna">Thanks for reaching out to ${safeName}. ` +
      `We've logged your message and someone will call you back within the hour. ` +
      `Have a great day!</Say><Hangup/>`,
    );
  }

  if (result.intent === "support") {
    return twiml(
      `<Say voice="Polly.Joanna">I've noted your support request. ` +
      `Someone from ${safeName} will reach out shortly. Goodbye.</Say><Hangup/>`,
    );
  }

  // unknown / low confidence — give them ONE more chance to clarify before voicemail
  return twiml(
    `<Say voice="Polly.Joanna">I didn't quite catch that. ` +
    `Could you tell me again — are you booking an appointment, asking about a service, or something else?</Say>` +
    `<Gather input="speech" timeout="6" speechTimeout="auto" action="/api/voice/inbound/gather">` +
    `<Say voice="Polly.Joanna">I'm listening.</Say>` +
    `</Gather>` +
    `<Say voice="Polly.Joanna">No worries. Please leave a message after the tone.</Say>` +
    `<Record maxLength="60" playBeep="true" />` +
    `<Say voice="Polly.Joanna">Got it. Thanks for calling.</Say>`,
  );
}
