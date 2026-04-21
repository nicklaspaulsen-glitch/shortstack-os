/**
 * Shared helpers for the Twilio voice-call pipeline.
 *
 * - validateTwilioSignature: HMAC-SHA1 check of X-Twilio-Signature header
 *   (matches the pattern used by sms-webhook; fails open with a warning when
 *   TWILIO_AUTH_TOKEN isn't set so dev/staging still function).
 * - resolveClientByToNumber: looks up which client/agency owns the inbound
 *   phone number via `clients.twilio_phone_number`.
 * - classifyCallOutcome: Claude Haiku one-shot that maps transcript + duration
 *   to one of {booked,qualified,unqualified,spam}. Cheap (~$0.0002/call).
 * - mapTwilioStatus: normalises Twilio's CallStatus strings to our check
 *   constraint enum.
 * - fireVoiceCallCompletedTrigger: fires the `voice_call_completed` workflow
 *   trigger with a filter-matchable payload { outcome, duration, ... }.
 */

import crypto from "crypto";
import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";

// ── Twilio signature validation ────────────────────────────────────
// Shape of validation matches the one in sms-webhook: build data string from
// URL + sorted POST params, HMAC-SHA1 with auth token, constant-time compare.
// When TWILIO_AUTH_TOKEN isn't set, we log a warning and continue (return true)
// so local dev and preview envs still work — production should always have it.
export function validateTwilioSignature(
  request: NextRequest,
  body: URLSearchParams,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn(
      "[voice-webhook] TWILIO_AUTH_TOKEN missing — skipping signature validation.",
    );
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = request.url;
  const sortedParams = Array.from(body.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  let data = url;
  for (const [key, value] of sortedParams) {
    data += key + value;
  }

  const computed = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false;
  }
}

// ── Twilio → internal status map ───────────────────────────────────
const TWILIO_STATUS_MAP: Record<string, string> = {
  queued: "ringing",
  initiated: "ringing",
  ringing: "ringing",
  "in-progress": "in_progress",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "failed",
};

export function mapTwilioStatus(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  return TWILIO_STATUS_MAP[raw.toLowerCase()] ?? null;
}

// ── Client lookup by To number ─────────────────────────────────────
// Twilio webhooks arrive with `To` = the client's provisioned number. Match
// against clients.twilio_phone_number to resolve owner + client_id. Returns
// null if the number isn't tracked (caller should fall back to a clientId
// query-string hint from the provisioned webhook URL).
export async function resolveClientByToNumber(
  supabase: SupabaseClient,
  toNumber: string | null,
): Promise<{ clientId: string; profileId: string; businessName: string | null; phone: string | null; elevenAgentId: string | null } | null> {
  if (!toNumber) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, profile_id, business_name, phone, eleven_agent_id")
    .eq("twilio_phone_number", toNumber)
    .maybeSingle();
  if (!data) return null;
  return {
    clientId: data.id as string,
    profileId: data.profile_id as string,
    businessName: (data.business_name as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    elevenAgentId: (data.eleven_agent_id as string | null) ?? null,
  };
}

export async function resolveClientById(
  supabase: SupabaseClient,
  clientId: string | null,
): Promise<{ clientId: string; profileId: string; businessName: string | null; phone: string | null; elevenAgentId: string | null } | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, profile_id, business_name, phone, eleven_agent_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    clientId: data.id as string,
    profileId: data.profile_id as string,
    businessName: (data.business_name as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    elevenAgentId: (data.eleven_agent_id as string | null) ?? null,
  };
}

// ── Outcome classification via Claude Haiku ────────────────────────
// Strategy: one structured JSON-only prompt. Four categories that map 1:1 to
// the UI — booked/qualified/unqualified/spam. Duration < 15s short-circuits
// to spam without hitting the API; the rest go through Haiku with a 200-token
// cap so cost is bounded (~$0.0002/call, ~$0.20 per 1k calls).
export interface ClassifyInput {
  transcript: string;
  durationSeconds: number;
}

export interface ClassifyResult {
  outcome: "booked" | "qualified" | "unqualified" | "spam";
  reason: string;
}

export async function classifyCallOutcome(
  input: ClassifyInput,
): Promise<ClassifyResult> {
  // Short-circuit for obvious spam / dropped calls — don't pay Haiku for it.
  if (input.durationSeconds < 15) {
    return { outcome: "spam", reason: "Call < 15 seconds — likely robocall or dropped." };
  }

  // Missing transcript → we can't classify; best-effort label as unqualified.
  if (!input.transcript || input.transcript.trim().length < 30) {
    return {
      outcome: "unqualified",
      reason: "No usable transcript — cannot determine lead quality.",
    };
  }

  // Cap transcript to keep cost bounded (~6k chars is safe and fits in Haiku
  // context easily).
  const trimmed = input.transcript.slice(0, 6000);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { outcome: "unqualified", reason: "ANTHROPIC_API_KEY missing — default label." };
  }

  try {
    const res = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 200,
      system:
        "You classify voice-receptionist call transcripts into exactly one outcome. Respond with ONLY a JSON object, no prose, no markdown.",
      messages: [
        {
          role: "user",
          content: `Classify the following call transcript into one of:
- "booked": caller agreed to a meeting / demo / callback at a specific time
- "qualified": caller is a real prospect with a genuine need, but no booking yet
- "unqualified": real person, but not a prospect (wrong number, informational only, not a fit)
- "spam": robocall, solicitation, or obvious junk

Call duration: ${input.durationSeconds}s

Transcript:
"""
${trimmed}
"""

Respond with JSON:
{"outcome": "<one of the four>", "reason": "<under 20 words>"}`,
        },
      ],
    });

    const text = getResponseText(res);
    const parsed = safeJsonParse<{ outcome: string; reason: string }>(text);
    if (!parsed || !parsed.outcome) {
      return { outcome: "unqualified", reason: "Classifier returned unparseable response." };
    }
    const valid = ["booked", "qualified", "unqualified", "spam"];
    const outcome = valid.includes(parsed.outcome)
      ? (parsed.outcome as ClassifyResult["outcome"])
      : "unqualified";
    return { outcome, reason: parsed.reason?.slice(0, 200) ?? "" };
  } catch (err) {
    console.warn("[voice-calls] classify failed:", err);
    return {
      outcome: "unqualified",
      reason: "Classifier error — defaulted to unqualified.",
    };
  }
}

// ── Fire voice_call_completed workflow trigger ─────────────────────
// Filter-matchable payload so users can wire "qualified call → email" etc.
// in the workflow builder via simple { outcome: "qualified" } config.
export async function fireVoiceCallCompletedTrigger(
  supabase: SupabaseClient,
  profileId: string,
  payload: {
    call_id: string;
    twilio_call_sid: string | null;
    client_id: string | null;
    from_number: string | null;
    to_number: string | null;
    direction: string | null;
    duration_seconds: number | null;
    outcome: string;
    transcript: string | null;
  },
): Promise<void> {
  try {
    await fireTrigger({
      supabase,
      userId: profileId,
      triggerType: "voice_call_completed",
      payload,
    });
  } catch (err) {
    console.warn("[voice-calls] fireTrigger failed:", err);
  }
}
