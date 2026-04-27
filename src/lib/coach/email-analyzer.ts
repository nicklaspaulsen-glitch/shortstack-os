/**
 * AI Sales Coach — email-thread analyzer.
 *
 * Companion to ./analyzer.ts but for written exchanges. Computes a few
 * deterministic signals (response speed, message-length ratio, who replied
 * last) and asks the LLM for tone, deal-stage drift, and risk callouts.
 *
 * The shape of `CoachAnalysis` is shared between voice + email, so the API
 * routes and UI can render either source uniformly.
 */

import { callLLM } from "@/lib/ai/llm-router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import type {
  CoachAnalysis,
  CoachInsight,
  CoachInsightCategory,
  CoachNextAction,
} from "@/lib/coach/analyzer";

export interface EmailMessage {
  /** Who sent it. Use "rep" / "prospect" if exact identity is unknown. */
  from: string;
  /** Treated as either "rep" or "prospect" by the analyzer. */
  direction?: "outbound" | "inbound";
  /** ISO timestamp. */
  sent_at: string;
  subject?: string;
  body: string;
}

export interface AnalyzeEmailArgs {
  emails: EmailMessage[];
  userId?: string;
  context?: string;
}

export interface EmailMetrics {
  message_count: number;
  rep_message_count: number;
  prospect_message_count: number;
  avg_rep_response_minutes: number | null;
  avg_prospect_response_minutes: number | null;
  rep_avg_words: number;
  prospect_avg_words: number;
  /** "rep" or "prospect" — whoever sent the most recent message. */
  last_replied: "rep" | "prospect" | "none";
  /** Hours since the last message. */
  last_message_age_hours: number | null;
}

const SYSTEM_PROMPT = `You are an elite sales coach reviewing an email thread between a rep and a prospect. Surface coaching feedback the rep can act on — not a generic summary.

The downstream UI renders insights, next actions, and a 0..100 health score for the thread.

### Output contract — STRICT JSON, no prose, no code fences.

{
  "insights": [
    {
      "category": "objection" | "missed_question" | "positive_moment" | "risk" | "tone",
      "text": string,           // 1-2 sentence specific observation
      "severity": 1 | 2 | 3 | 4 | 5
    }
  ],
  "next_actions": [
    { "text": string, "due": string | null }
  ],
  "score": number   // 0..100 for the thread health
}

### Quality rules

- Comment on tone calibration (overly formal, too casual, mismatched energy with prospect).
- Flag deal-stage drift: thread started about pricing but devolved into feature debate; or vice versa.
- Highlight when the rep failed to answer a question the prospect asked.
- Highlight ghosting risk: prospect went silent after a strong message from the rep, or the rep let a thread die.
- Next actions are concrete: "Send a calendar link with three 20-min slots this week" beats "follow up".

### Hard rules

- Output ONLY the JSON object. No markdown. No code fences. No commentary.
- Empty arrays are valid where applicable.
- Do not invent quotes — anything you reference must appear in the thread.`;

function asDirection(msg: EmailMessage, repTokens: ReadonlyArray<string>): "outbound" | "inbound" {
  if (msg.direction) return msg.direction;
  const from = (msg.from || "").toLowerCase();
  for (const tok of repTokens) {
    if (tok && from.includes(tok)) return "outbound";
  }
  // Fallback: treat the first sender as the rep (best-effort heuristic).
  return "outbound";
}

function tokenizeWords(text: string): number {
  return (text || "")
    .replace(/[^A-Za-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function computeEmailMetrics(emails: EmailMessage[]): EmailMetrics {
  const sorted = [...emails]
    .filter((m) => m && typeof m.sent_at === "string")
    .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  if (sorted.length === 0) {
    return {
      message_count: 0,
      rep_message_count: 0,
      prospect_message_count: 0,
      avg_rep_response_minutes: null,
      avg_prospect_response_minutes: null,
      rep_avg_words: 0,
      prospect_avg_words: 0,
      last_replied: "none",
      last_message_age_hours: null,
    };
  }

  // Heuristic: the first sender is "the rep" unless directions are explicit.
  const repTokens: string[] = [];
  const firstFrom = sorted[0].from?.toLowerCase() || "";
  if (firstFrom) repTokens.push(firstFrom);

  let repCount = 0;
  let prospectCount = 0;
  let repWords = 0;
  let prospectWords = 0;

  const repResponseTimes: number[] = [];
  const prospectResponseTimes: number[] = [];

  let last: { dir: "outbound" | "inbound"; ts: number } | null = null;

  for (const msg of sorted) {
    const dir = asDirection(msg, repTokens);
    const ts = new Date(msg.sent_at).getTime();
    const wc = tokenizeWords(msg.body);

    if (dir === "outbound") {
      repCount += 1;
      repWords += wc;
    } else {
      prospectCount += 1;
      prospectWords += wc;
    }

    if (last && last.dir !== dir) {
      const minutes = (ts - last.ts) / 60000;
      if (minutes >= 0) {
        if (dir === "outbound") repResponseTimes.push(minutes);
        else prospectResponseTimes.push(minutes);
      }
    }
    last = { dir, ts };
  }

  const lastMsg = sorted[sorted.length - 1];
  const lastDir = asDirection(lastMsg, repTokens);
  const ageMs = Date.now() - new Date(lastMsg.sent_at).getTime();

  const avg = (arr: number[]): number | null =>
    arr.length === 0 ? null : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

  return {
    message_count: sorted.length,
    rep_message_count: repCount,
    prospect_message_count: prospectCount,
    avg_rep_response_minutes: avg(repResponseTimes),
    avg_prospect_response_minutes: avg(prospectResponseTimes),
    rep_avg_words: repCount > 0 ? Math.round(repWords / repCount) : 0,
    prospect_avg_words: prospectCount > 0 ? Math.round(prospectWords / prospectCount) : 0,
    last_replied: lastDir === "outbound" ? "rep" : "prospect",
    last_message_age_hours: ageMs >= 0 ? Math.round((ageMs / 3600000) * 10) / 10 : null,
  };
}

/**
 * Anchor score for a thread. Penalises ghost risk and mismatched cadence.
 */
function scoreEmailMetrics(metrics: EmailMetrics): number {
  let score = 80;
  if (metrics.message_count <= 1) score -= 20;
  if (metrics.last_replied === "prospect" && (metrics.last_message_age_hours ?? 0) > 48) {
    // Rep is sitting on a reply.
    score -= 15;
  }
  if (metrics.last_replied === "rep" && (metrics.last_message_age_hours ?? 0) > 96) {
    // Prospect went dark after a rep message — mild ghosting risk.
    score -= 10;
  }
  if (metrics.rep_avg_words > 250 && metrics.prospect_avg_words < 60) {
    // Rep is over-explaining.
    score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

interface RawEmailLLMOutput {
  insights?: Array<Partial<CoachInsight>>;
  next_actions?: Array<Partial<CoachNextAction>>;
  score?: number;
}

function sanitizeCategory(value: unknown): CoachInsightCategory {
  const allowed: CoachInsightCategory[] = [
    "objection",
    "missed_question",
    "positive_moment",
    "risk",
    "tone",
  ];
  return allowed.includes(value as CoachInsightCategory)
    ? (value as CoachInsightCategory)
    : "tone";
}

function sanitizeInsights(items: Array<Partial<CoachInsight>> | undefined): CoachInsight[] {
  if (!Array.isArray(items)) return [];
  return items
    .map<CoachInsight | null>((item) => {
      if (!item || typeof item.text !== "string" || !item.text.trim()) return null;
      return {
        category: sanitizeCategory(item.category),
        text: item.text.trim().slice(0, 500),
        timestamp_secs: null,
        severity:
          typeof item.severity === "number"
            ? Math.max(1, Math.min(5, Math.round(item.severity)))
            : null,
      };
    })
    .filter((x): x is CoachInsight => x !== null)
    .slice(0, 10);
}

function sanitizeNextActions(items: Array<Partial<CoachNextAction>> | undefined): CoachNextAction[] {
  if (!Array.isArray(items)) return [];
  return items
    .map<CoachNextAction | null>((item) => {
      if (!item || typeof item.text !== "string" || !item.text.trim()) return null;
      const due =
        typeof item.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.due)
          ? item.due
          : null;
      return { text: item.text.trim().slice(0, 280), due };
    })
    .filter((x): x is CoachNextAction => x !== null)
    .slice(0, 6);
}

/**
 * Analyze an email thread and return a `CoachAnalysis`-compatible payload so
 * the UI can render voice + email analyses uniformly. The `metrics` field is
 * intentionally a proxy: we map email-specific numbers into the call-shaped
 * struct so the schema stays one-shape across surfaces.
 */
export async function analyzeEmailThread(args: AnalyzeEmailArgs): Promise<CoachAnalysis> {
  const emailMetrics = computeEmailMetrics(args.emails);
  const baseScore = scoreEmailMetrics(emailMetrics);

  // Map email metrics into the shared call-metrics shape so the API + UI
  // don't have to fork their renderers. Talk-ratio is repurposed as the
  // rep word share over total words; WPM doesn't apply (set to 0).
  const totalWords = emailMetrics.rep_avg_words * emailMetrics.rep_message_count
    + emailMetrics.prospect_avg_words * emailMetrics.prospect_message_count;
  const repWords = emailMetrics.rep_avg_words * emailMetrics.rep_message_count;
  const proxyTalkRatio = totalWords > 0 ? Math.round((repWords / totalWords) * 1000) / 1000 : 0;

  const sharedMetrics = {
    talk_ratio: proxyTalkRatio,
    words_per_minute: 0,
    filler_words_count: 0,
    longest_monologue_secs: 0,
    rep_word_count: repWords,
    prospect_word_count: totalWords - repWords,
    rep_turn_count: emailMetrics.rep_message_count,
    prospect_turn_count: emailMetrics.prospect_message_count,
    duration_seconds: 0,
  };

  if (emailMetrics.message_count === 0) {
    return {
      metrics: sharedMetrics,
      insights: [],
      next_actions: [],
      overall_score: baseScore,
      cost_usd: 0,
    };
  }

  const threadBlock = args.emails
    .map((m, i) => {
      const dir = m.direction || "(unknown)";
      const subj = m.subject ? `Subject: ${m.subject}\n` : "";
      return `--- Message ${i + 1} (${dir}, ${m.from}, ${m.sent_at}) ---\n${subj}${m.body}`;
    })
    .join("\n\n");

  const userPrompt = `### Email-thread metrics (computed)
message_count: ${emailMetrics.message_count}
rep_message_count: ${emailMetrics.rep_message_count}
prospect_message_count: ${emailMetrics.prospect_message_count}
avg_rep_response_minutes: ${emailMetrics.avg_rep_response_minutes ?? "n/a"}
avg_prospect_response_minutes: ${emailMetrics.avg_prospect_response_minutes ?? "n/a"}
rep_avg_words: ${emailMetrics.rep_avg_words}
prospect_avg_words: ${emailMetrics.prospect_avg_words}
last_replied: ${emailMetrics.last_replied}
last_message_age_hours: ${emailMetrics.last_message_age_hours ?? "n/a"}

### Thread (oldest first)
${threadBlock}

Return the JSON object defined in the system prompt.`;

  let parsed: RawEmailLLMOutput | null = null;
  let costUsd = 0;
  try {
    const response = await callLLM({
      taskType: "complex_analysis",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.2,
      userId: args.userId,
      context: args.context ?? "lib/coach/analyzeEmailThread",
    });
    costUsd = Math.round(response.costUsd * 10000) / 10000;
    parsed = safeJsonParse<RawEmailLLMOutput>(response.text);
  } catch (err) {
    console.error("[coach/email-analyzer] LLM call failed", err);
  }

  const insights = sanitizeInsights(parsed?.insights);
  const nextActions = sanitizeNextActions(parsed?.next_actions);
  const llmScore =
    typeof parsed?.score === "number" && Number.isFinite(parsed.score)
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : null;

  // Blend: trust the LLM more when it returned a confident score; otherwise
  // anchor on the deterministic baseline.
  const overallScore = llmScore !== null
    ? Math.round(baseScore * 0.4 + llmScore * 0.6)
    : baseScore;

  return {
    metrics: sharedMetrics,
    insights,
    next_actions: nextActions,
    overall_score: overallScore,
    cost_usd: costUsd,
  };
}
