/**
 * AI Sales Coach — call analyzer.
 *
 * Combines deterministic metrics (`./metrics.ts`) with qualitative LLM
 * insights routed through the shared cost-aware router (`callLLM`).
 *
 * The metrics half never throws and always returns a stable shape — even if
 * the LLM step fails the caller still gets numbers and a baseline score.
 *
 * The LLM half asks for:
 *   - objections raised by the prospect
 *   - questions the rep should have asked but didn't
 *   - positive moments (rapport, qualification, framing)
 *   - concrete next-best-action follow-up steps
 *
 * Output is a single JSON object — see `CoachAnalysis` below.
 */

import { callLLM } from "@/lib/ai/llm-router";
import {
  computeCallMetrics,
  scoreMetrics,
  type CallMetrics,
  type TranscriptSegment,
} from "@/lib/coach/metrics";
import { safeJsonParse } from "@/lib/ai/claude-helpers";

export type CoachInsightCategory =
  | "objection"
  | "missed_question"
  | "positive_moment"
  | "risk"
  | "tone";

export interface CoachInsight {
  category: CoachInsightCategory;
  text: string;
  /** Seconds from the start of the call when this happened (when known). */
  timestamp_secs?: number | null;
  /** Optional severity 1..5 used by the UI for badge color. */
  severity?: number | null;
}

export interface CoachNextAction {
  text: string;
  /** Suggested due date in ISO YYYY-MM-DD when the LLM can infer one. */
  due?: string | null;
}

export interface CoachAnalysis {
  metrics: CallMetrics;
  insights: CoachInsight[];
  next_actions: CoachNextAction[];
  overall_score: number;
  /** Estimated USD cost of the analysis (LLM only — DB writes are free). */
  cost_usd: number;
}

export interface AnalyzeCallArgs {
  transcript: string;
  duration_seconds: number;
  segments?: TranscriptSegment[];
  /** Optional participant labels — fed to the LLM for richer prompting. */
  participants?: string[];
  /** Owner profile id, used by the router for usage tracking. */
  userId?: string;
  /** Optional source label for the usage tracking row. */
  context?: string;
}

const SYSTEM_PROMPT = `You are an elite sales coach analysing a sales call transcript. Your job is to surface concrete, decision-useful coaching feedback for the rep — NOT a generic conversation summary.

The downstream UI renders three sections:
  1. Insights — short labeled cards. Each has a category, text, and (when possible) a timestamp the user can click to jump to.
  2. Next actions — a 1-5 item checklist of concrete follow-ups the rep should take after this call.
  3. An overall qualitative impression that the system blends with deterministic metrics into a 0..100 score.

### Output contract — STRICT JSON, no prose, no code fences.

{
  "insights": [
    {
      "category": "objection" | "missed_question" | "positive_moment" | "risk" | "tone",
      "text": string,                  // 1-2 sentence specific observation
      "timestamp_secs": number | null, // seconds into the call, when discernible from context
      "severity": 1 | 2 | 3 | 4 | 5    // 1=minor, 5=critical
    }
  ],
  "next_actions": [
    {
      "text": string,        // imperative one-liner: "Send the pricing one-pager and a Calendly link by EOD."
      "due": string | null   // ISO date if a deadline is implied
    }
  ],
  "qualitative_score_adjustment": number  // -15..+10, blended into the deterministic score
}

### Quality rules

- Insights must be SPECIFIC. "Rep sounded nervous" is bad. "When the prospect asked about pricing at 02:14, the rep hedged with 'maybe around' instead of stating the published list price" is good.
- Use the right category:
  - objection: prospect raised a concern (price, timing, authority, fit).
  - missed_question: rep should have asked but didn't (decision criteria, timeline, budget owner).
  - positive_moment: strong qualification, rapport, framing, or close.
  - risk: deal-killer signal (no decision-maker on the call, vague timeline, etc).
  - tone: pacing, energy, filler-word patterns the rep should fix.
- Aim for 3-7 insights. Skip filler-word commentary unless it's egregious — the deterministic layer already counts those.
- Next actions are commitments the rep can act on TODAY. "Schedule a follow-up call" only counts if you can specify what gets covered.
- qualitative_score_adjustment: positive when the rep clearly did the right things; negative for serious issues (talked over the prospect, missed a buying signal, mishandled an objection).

### Hard rules

- Output ONLY the JSON object. No markdown. No code fences. No commentary.
- Every field in the contract is required. Use empty arrays where there is genuinely nothing to say.
- Do not fabricate quotes. If you reference what the prospect said, it must appear in the transcript.
- Timestamps must be plausible — never invent a number when the transcript has no timing data.`;

/**
 * Pull rough cost estimate from the router response. We round up because the
 * router's per-call cost includes real provider pricing, but writes to
 * `coach_analyses` should never overstate revenue impact.
 */
function clampCost(cost: number): number {
  if (!Number.isFinite(cost) || cost < 0) return 0;
  return Math.round(cost * 10000) / 10000; // 4 decimal places
}

interface RawLLMOutput {
  insights?: Array<Partial<CoachInsight>>;
  next_actions?: Array<Partial<CoachNextAction>>;
  qualitative_score_adjustment?: number;
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
        timestamp_secs:
          typeof item.timestamp_secs === "number" && Number.isFinite(item.timestamp_secs)
            ? Math.max(0, Math.round(item.timestamp_secs))
            : null,
        severity:
          typeof item.severity === "number"
            ? Math.max(1, Math.min(5, Math.round(item.severity)))
            : null,
      };
    })
    .filter((x): x is CoachInsight => x !== null)
    .slice(0, 12);
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
    .slice(0, 8);
}

/**
 * Build the user-message body for the LLM. We keep it compact and shape-stable
 * so prompt caching kicks in across consecutive analyses.
 */
function buildUserMessage(args: AnalyzeCallArgs, metrics: CallMetrics): string {
  const segmentBlock = args.segments && args.segments.length > 0
    ? "\n\n### Diarized segments\n" +
      args.segments
        .map((s) => `[${Math.round(s.start)}s] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`)
        .join("\n")
    : "";

  return `### Call metadata
duration_seconds: ${args.duration_seconds}
participants: ${args.participants && args.participants.length > 0 ? args.participants.join(", ") : "rep + prospect (unlabeled)"}

### Deterministic metrics (already computed — do not duplicate, but factor into your analysis)
talk_ratio: ${metrics.talk_ratio}
words_per_minute: ${metrics.words_per_minute}
filler_words_count: ${metrics.filler_words_count}
longest_monologue_secs: ${metrics.longest_monologue_secs}
rep_word_count: ${metrics.rep_word_count}
prospect_word_count: ${metrics.prospect_word_count}

### Raw transcript
${args.transcript}${segmentBlock}

Return the JSON object defined in the system prompt.`;
}

/**
 * Main entrypoint — analyze a call transcript and return structured coaching
 * feedback alongside deterministic metrics.
 *
 * Always resolves with a usable analysis. If the LLM step fails the caller
 * still receives metrics + score, with empty insights and next_actions.
 */
export async function analyzeCall(args: AnalyzeCallArgs): Promise<CoachAnalysis> {
  const metrics = computeCallMetrics(args.transcript, args.duration_seconds, args.segments);
  const baseScore = scoreMetrics(metrics);

  // Empty / extremely short transcripts skip the LLM entirely — no coaching
  // signal to extract and we shouldn't burn tokens.
  if (!args.transcript || args.transcript.trim().length < 40) {
    return {
      metrics,
      insights: [],
      next_actions: [],
      overall_score: baseScore,
      cost_usd: 0,
    };
  }

  const userPrompt = buildUserMessage(args, metrics);

  let parsed: RawLLMOutput | null = null;
  let costUsd = 0;
  try {
    const response = await callLLM({
      taskType: "complex_analysis",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2000,
      temperature: 0.2,
      userId: args.userId,
      context: args.context ?? "lib/coach/analyzeCall",
    });
    costUsd = clampCost(response.costUsd);
    parsed = safeJsonParse<RawLLMOutput>(response.text);
  } catch (err) {
    console.error("[coach/analyzer] LLM call failed", err);
  }

  const insights = sanitizeInsights(parsed?.insights);
  const nextActions = sanitizeNextActions(parsed?.next_actions);

  const adjustment =
    typeof parsed?.qualitative_score_adjustment === "number"
      ? Math.max(-15, Math.min(10, Math.round(parsed.qualitative_score_adjustment)))
      : 0;

  const overallScore = Math.max(0, Math.min(100, baseScore + adjustment));

  return {
    metrics,
    insights,
    next_actions: nextActions,
    overall_score: overallScore,
    cost_usd: costUsd,
  };
}
