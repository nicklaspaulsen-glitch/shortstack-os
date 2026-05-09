/**
 * Outreach event classifier.
 *
 * Given a single timeline event (call transcript / email body / SMS / DM),
 * returns an outcome label + one-sentence summary. Used by the lazy
 * background populator so the chat-bubble UI can render outcome chips
 * without a per-render LLM call.
 *
 * Cheap path: routes through callLLM({ taskType: "simple_classification" })
 * which goes to Llama-3.1-70B via OpenRouter (≈ $0.0001/call) with Haiku
 * as fallback. We cap the input at ~200 tokens by truncating before send,
 * because outcome detection is a high-recall coarse classification — the
 * first paragraph + last paragraph is plenty of signal.
 */

import { callLLMTraced } from "@/lib/ai/llm-router";
import { reportError } from "@/lib/observability/error-reporter";
import type { OutreachChannel, OutreachOutcome } from "./types";

const VALID_OUTCOMES = new Set<OutreachOutcome>([
  "interested",
  "objection",
  "no_answer",
  "booked",
  "replied",
  "voicemail",
  "bounced",
  "unknown",
]);

const FALLBACK_OUTCOMES: OutreachOutcome[] = [
  "interested",
  "objection",
  "no_answer",
  "booked",
  "replied",
  "voicemail",
  "bounced",
  "unknown",
];

const MAX_BODY_CHARS = 800;
const MAX_TRANSCRIPT_CHARS = 1200;

interface ClassifyInput {
  channel: OutreachChannel;
  body: string;
  transcript?: string;
  /** Used for usage tracking + route attribution. */
  agencyOwnerId?: string;
}

export interface ClassifyResult {
  outcome: OutreachOutcome;
  summary: string;
}

/**
 * Truncate to the head + tail of the text so we keep the opening hook
 * and the closing line (where outcomes usually surface).
 */
function truncateWindow(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.6));
  const tail = text.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n[…]\n${tail}`;
}

function buildPrompt({ channel, body, transcript }: ClassifyInput): string {
  const channelLabel: Record<OutreachChannel, string> = {
    voice_call: "phone call",
    email: "email",
    sms: "SMS",
    dm: "direct message",
  };

  const content = transcript
    ? `Call transcript:\n${truncateWindow(transcript, MAX_TRANSCRIPT_CHARS)}`
    : `Message body:\n${truncateWindow(body || "", MAX_BODY_CHARS)}`;

  return `Classify the outcome of this ${channelLabel[channel]}.

Possible outcomes:
- "interested" — prospect engaged positively, asked questions, asked for more info
- "objection" — prospect pushed back (price, timing, bad fit)
- "no_answer" — no response, ringing, dead air, no reply yet
- "booked" — meeting/call/demo was scheduled
- "replied" — they replied but it's neutral (acknowledgement only)
- "voicemail" — left a voicemail
- "bounced" — message bounced (invalid email/number)
- "unknown" — cannot determine

${content}

Respond with ONLY a JSON object on a single line, no markdown, no commentary:
{"outcome":"<one of the values above>","summary":"<one short sentence summarizing what happened>"}`;
}

function safeParse(raw: string): ClassifyResult {
  // Strip code fences if a model added them despite the no-markdown instruction.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not object");
    const outcome = String(parsed.outcome || "").toLowerCase() as OutreachOutcome;
    const summary = String(parsed.summary || "").slice(0, 200);
    if (!VALID_OUTCOMES.has(outcome)) {
      return { outcome: "unknown", summary: summary || "" };
    }
    return { outcome, summary };
  } catch {
    // Last-ditch: scan for one of the known labels in the raw output.
    const lower = cleaned.toLowerCase();
    for (const label of FALLBACK_OUTCOMES) {
      if (lower.includes(label)) {
        return { outcome: label, summary: cleaned.slice(0, 200) };
      }
    }
    return { outcome: "unknown", summary: "" };
  }
}

/**
 * Classify a single outreach event. Never throws — returns
 * { outcome: "unknown", summary: "" } on any failure path so the caller
 * can persist a placeholder row and retry later.
 */
export async function classifyOutcome(input: ClassifyInput): Promise<ClassifyResult> {
  if (!input.body && !input.transcript) {
    return { outcome: "unknown", summary: "" };
  }

  try {
    const result = await callLLMTraced({
      taskType: "simple_classification",
      systemPrompt:
        "You are a sales-outreach outcome classifier. Read the message and return a strict JSON object with the outcome label and a one-sentence summary. No prose, no markdown.",
      userPrompt: buildPrompt(input),
      maxTokens: 120,
      temperature: 0,
      userId: input.agencyOwnerId,
      context: "/api/outreach/classify",
      surface: "outreach-classify",
      humanize: false,
    });
    return safeParse(result.text);
  } catch (err) {
    reportError(err, {
      route: "outreach-classify",
      component: "classifyOutcome",
      reason: "llm-failure",
    });
    return { outcome: "unknown", summary: "" };
  }
}
