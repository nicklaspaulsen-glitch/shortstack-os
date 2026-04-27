/**
 * AI Lead Scoring — hybrid rule-based + Claude Haiku engine.
 *
 * Produces a 0-100 score split across:
 *   - base score (0-50): deterministic rules over engagement signals
 *   - AI bonus  (0-50): Claude Haiku read of recent interactions + profile
 *
 * Total = clamp(base + ai_bonus, 0, 100).
 *
 * Grade buckets:
 *   0-30  cold
 *   31-60 warm
 *   61-85 hot
 *   86-100 customer (already converted)
 *
 * The engine is pure-ish: it accepts a fully-loaded `LeadSignals` snapshot and
 * returns a structured `ScoreComputation`. Pulling the signals from the DB and
 * persisting the result lives in `score-recompute.ts`.
 */
import { callLLM } from "@/lib/ai/llm-router";

// -------------------- Types --------------------

export type ScoreGrade = "cold" | "warm" | "hot" | "customer";

export interface LeadProfile {
  id: string;
  user_id: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  google_rating: number | null;
  review_count: number | null;
  status: string | null;
  source: string | null;
}

/** A single timestamped engagement event used for both rule scoring and AI context. */
export interface SignalEvent {
  type:
    | "email_open"
    | "email_click"
    | "form_submit"
    | "call_answered"
    | "sms_reply"
    | "page_view"
    | "pricing_view"
    | "demo_booked"
    | "social_comment"
    | "outreach_sent"
    | "outreach_replied";
  occurred_at: string; // ISO8601
  metadata?: Record<string, unknown>;
}

export interface LeadSignals {
  profile: LeadProfile;
  events: SignalEvent[];
  /** Last 5 outreach touches with reply text — used to ground the AI prompt. */
  recentInteractions: Array<{
    direction: "outbound" | "inbound";
    channel: string;
    text: string | null;
    occurred_at: string;
  }>;
  /** Whether the lead is already a paying customer (forces grade=customer). */
  isCustomer: boolean;
}

export interface SignalBreakdown {
  email_opens: number;
  email_clicks: number;
  form_submits: number;
  calls_answered: number;
  sms_replies: number;
  page_views: number;
  pricing_views: number;
  demo_booked: number;
  social_engagement: number;
  recency_multiplier: number;
}

export interface ScoreComputation {
  score: number;
  grade: ScoreGrade;
  base_score: number;
  ai_bonus: number;
  ai_reasoning: string;
  signal_breakdown: SignalBreakdown;
  /** Snapshot the algorithm version so future recomputes can detect drift. */
  algo_version: number;
}

// -------------------- Tunable weights (v1) --------------------

export const SCORING_CONFIG = {
  weights: {
    email_open: 5,
    email_click: 10,
    form_submit: 20,
    call_answered: 15,
    sms_reply: 15,
    page_view: 2,
    pricing_view: 10,
    demo_booked: 25,
    social_engagement: 5,
  },
  caps: {
    email_opens: 15,
    email_clicks: 20,
    page_views: 10,
    social_engagement: 15,
  },
  /** Lookback windows in days. */
  windows: {
    fast_signals_days: 7,
    full_history_days: 90,
  },
  /** Recency decay: every 7 days of inactivity multiplies by this factor. */
  recency: {
    decay_per_week: 0.95,
    min_multiplier: 0.4,
  },
  thresholds: {
    cold_max: 30,
    warm_max: 60,
    hot_max: 85,
  },
  algo_version: 1,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;

// -------------------- Pure helpers --------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - t) / MS_PER_DAY);
}

function isWithin(iso: string, days: number, now: Date = new Date()): boolean {
  return daysAgo(iso, now) <= days;
}

export function gradeFromScore(score: number, isCustomer: boolean): ScoreGrade {
  if (isCustomer) return "customer";
  const t = SCORING_CONFIG.thresholds;
  if (score <= t.cold_max) return "cold";
  if (score <= t.warm_max) return "warm";
  if (score <= t.hot_max) return "hot";
  return "customer";
}

/**
 * Compute the deterministic base score (0-50) plus the per-signal breakdown.
 * The total of capped per-signal contributions can exceed 50; we clamp at the
 * end so a very-engaged lead still tops out at 50 from rules alone.
 */
export function computeBaseScore(signals: LeadSignals): {
  base: number;
  breakdown: SignalBreakdown;
} {
  const w = SCORING_CONFIG.weights;
  const caps = SCORING_CONFIG.caps;
  const fastWindow = SCORING_CONFIG.windows.fast_signals_days;

  let emailOpens = 0;
  let emailClicks = 0;
  let formSubmits = 0;
  let callsAnswered = 0;
  let smsReplies = 0;
  let pageViews = 0;
  let pricingViews = 0;
  let demoBooked = 0;
  let socialEngagement = 0;

  let mostRecentEventDays = Number.POSITIVE_INFINITY;

  for (const ev of signals.events) {
    const inFastWindow = isWithin(ev.occurred_at, fastWindow);
    const ageDays = daysAgo(ev.occurred_at);
    if (ageDays < mostRecentEventDays) mostRecentEventDays = ageDays;

    switch (ev.type) {
      case "email_open":
        if (inFastWindow) emailOpens += w.email_open;
        break;
      case "email_click":
        emailClicks += w.email_click;
        break;
      case "form_submit":
        formSubmits += w.form_submit;
        break;
      case "call_answered":
        callsAnswered += w.call_answered;
        break;
      case "sms_reply":
      case "outreach_replied":
        smsReplies += w.sms_reply;
        break;
      case "page_view":
        pageViews += w.page_view;
        break;
      case "pricing_view":
        pricingViews += w.pricing_view;
        break;
      case "demo_booked":
        demoBooked += w.demo_booked;
        break;
      case "social_comment":
        socialEngagement += w.social_engagement;
        break;
      case "outreach_sent":
        // outbound activity alone doesn't bump the lead's score
        break;
    }
  }

  // Apply caps
  emailOpens = Math.min(emailOpens, caps.email_opens);
  emailClicks = Math.min(emailClicks, caps.email_clicks);
  pageViews = Math.min(pageViews, caps.page_views);
  socialEngagement = Math.min(socialEngagement, caps.social_engagement);

  // Recency decay: 0.95 per week of inactivity, floor at min_multiplier
  const weeksOfInactivity = Number.isFinite(mostRecentEventDays)
    ? Math.floor(mostRecentEventDays / 7)
    : 12; // no events at all → ~3 months of decay
  const rawMultiplier = Math.pow(
    SCORING_CONFIG.recency.decay_per_week,
    weeksOfInactivity,
  );
  const recencyMultiplier = Math.max(
    SCORING_CONFIG.recency.min_multiplier,
    rawMultiplier,
  );

  const subtotal =
    emailOpens +
    emailClicks +
    formSubmits +
    callsAnswered +
    smsReplies +
    pageViews +
    pricingViews +
    demoBooked +
    socialEngagement;

  const decayed = subtotal * recencyMultiplier;
  const base = Math.max(0, Math.min(50, Math.round(decayed)));

  return {
    base,
    breakdown: {
      email_opens: emailOpens,
      email_clicks: emailClicks,
      form_submits: formSubmits,
      calls_answered: callsAnswered,
      sms_replies: smsReplies,
      page_views: pageViews,
      pricing_views: pricingViews,
      demo_booked: demoBooked,
      social_engagement: socialEngagement,
      recency_multiplier: Number(recencyMultiplier.toFixed(3)),
    },
  };
}

/**
 * Build a compact JSON brief for the AI bonus score. Trimmed to keep token
 * spend low — Haiku is already the cheap path, but we still cap interactions.
 */
function buildAIPrompt(signals: LeadSignals): {
  systemPrompt: string;
  userPrompt: string;
} {
  const profile = {
    business_name: signals.profile.business_name,
    industry: signals.profile.industry,
    location: [signals.profile.city, signals.profile.state]
      .filter(Boolean)
      .join(", "),
    has_phone: !!signals.profile.phone,
    has_email: !!signals.profile.email,
    has_website: !!signals.profile.website,
    google_rating: signals.profile.google_rating,
    review_count: signals.profile.review_count,
    status: signals.profile.status,
    source: signals.profile.source,
  };

  const interactions = signals.recentInteractions
    .slice(0, 5)
    .map((i) => ({
      dir: i.direction,
      ch: i.channel,
      when: i.occurred_at,
      // Trim long replies to avoid blowing context.
      text: (i.text ?? "").slice(0, 280),
    }));

  const eventCounts: Record<string, number> = {};
  for (const ev of signals.events) {
    eventCounts[ev.type] = (eventCounts[ev.type] ?? 0) + 1;
  }

  const systemPrompt = `You score lead buying-intent for a digital marketing agency.
Read the lead profile and last 5 interactions, then rate them on a 0-50 scale.

Higher scores = stronger buying signal. Consider:
- Replies / questions / objections vs total silence
- Pricing or demo interest
- Sentiment of inbound text
- Industry/location fit for a marketing agency
- Whether they appear to be an active business with budget

Return STRICT JSON only:
{ "score": <integer 0-50>, "reasoning": "<one short sentence>" }
No markdown. No prose outside the JSON.`;

  const userPrompt = `Profile:
${JSON.stringify(profile)}

Event counts (last 90d):
${JSON.stringify(eventCounts)}

Recent interactions (oldest -> newest):
${JSON.stringify(interactions)}`;

  return { systemPrompt, userPrompt };
}

interface AIBonusResult {
  score: number;
  reasoning: string;
}

function parseAIBonus(text: string): AIBonusResult | null {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  // Pull out the first {...} block defensively.
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "score" in parsed &&
      typeof (parsed as { score: unknown }).score === "number"
    ) {
      const score = Math.max(
        0,
        Math.min(50, Math.round((parsed as { score: number }).score)),
      );
      const reasoning =
        "reasoning" in parsed &&
        typeof (parsed as { reasoning: unknown }).reasoning === "string"
          ? ((parsed as { reasoning: string }).reasoning as string)
          : "AI scored.";
      return { score, reasoning };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Run the AI bonus pass via the cheap-routing LLM. On any failure we fall
 * back to a small deterministic bonus so leads still get a sensible total.
 */
async function computeAIBonus(
  signals: LeadSignals,
  context: string,
): Promise<AIBonusResult> {
  // No engagement data at all -> there's nothing for the AI to reason on.
  if (signals.events.length === 0 && signals.recentInteractions.length === 0) {
    return {
      score: 0,
      reasoning:
        "No engagement events on file — AI bonus skipped. Score from profile/rules only.",
    };
  }

  const { systemPrompt, userPrompt } = buildAIPrompt(signals);

  try {
    const res = await callLLM({
      taskType: "simple_classification",
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0,
      userId: signals.profile.user_id,
      context,
    });
    const parsed = parseAIBonus(res.text);
    if (parsed) return parsed;
    return {
      score: 0,
      reasoning: "AI returned unparseable response — defaulted to 0.",
    };
  } catch (err) {
    console.error("[lead-scoring] AI bonus failed", err);
    return {
      score: 0,
      reasoning: "AI bonus skipped (provider error).",
    };
  }
}

/**
 * Top-level entrypoint: turn a `LeadSignals` snapshot into a full score.
 * Side-effect free.
 */
export async function computeScore(
  signals: LeadSignals,
  opts: { context?: string } = {},
): Promise<ScoreComputation> {
  const { base, breakdown } = computeBaseScore(signals);
  const aiResult = await computeAIBonus(
    signals,
    opts.context ?? "/lead-scoring/compute",
  );

  const total = Math.max(0, Math.min(100, base + aiResult.score));
  const grade = gradeFromScore(total, signals.isCustomer);

  // If we KNOW they're a paying customer, force the score to at least 86.
  const finalScore = grade === "customer" && total < 86 ? 86 : total;

  return {
    score: finalScore,
    grade,
    base_score: base,
    ai_bonus: aiResult.score,
    ai_reasoning: aiResult.reasoning,
    signal_breakdown: breakdown,
    algo_version: SCORING_CONFIG.algo_version,
  };
}

// -------------------- Self-test fixtures (used by route + tests) --------------------

export const SELF_TEST_FIXTURES: Array<{
  name: string;
  signals: LeadSignals;
  expectedGrade: ScoreGrade;
}> = [
  {
    name: "cold lead — no engagement",
    expectedGrade: "cold",
    signals: {
      profile: {
        id: "fixture-cold",
        user_id: "fixture-user",
        business_name: "Cold Co",
        email: "cold@example.com",
        phone: null,
        website: null,
        industry: "Other",
        city: null,
        state: null,
        google_rating: null,
        review_count: null,
        status: "new",
        source: "Manual",
      },
      events: [],
      recentInteractions: [],
      isCustomer: false,
    },
  },
  {
    name: "hot lead — pricing + demo + replies",
    expectedGrade: "hot",
    signals: {
      profile: {
        id: "fixture-hot",
        user_id: "fixture-user",
        business_name: "Hot Med Spa",
        email: "owner@hotmedspa.com",
        phone: "+15551112222",
        website: "https://hotmedspa.com",
        industry: "Med Spa",
        city: "Miami",
        state: "FL",
        google_rating: 4.6,
        review_count: 42,
        status: "qualified",
        source: "Referral",
      },
      events: [
        {
          type: "pricing_view",
          occurred_at: new Date(Date.now() - 1 * MS_PER_DAY).toISOString(),
        },
        {
          type: "demo_booked",
          occurred_at: new Date(Date.now() - 1 * MS_PER_DAY).toISOString(),
        },
        {
          type: "email_click",
          occurred_at: new Date(Date.now() - 2 * MS_PER_DAY).toISOString(),
        },
        {
          type: "outreach_replied",
          occurred_at: new Date(Date.now() - 1 * MS_PER_DAY).toISOString(),
        },
      ],
      recentInteractions: [
        {
          direction: "inbound",
          channel: "email",
          text: "Yes, let's book a demo Friday.",
          occurred_at: new Date(Date.now() - 1 * MS_PER_DAY).toISOString(),
        },
      ],
      isCustomer: false,
    },
  },
  {
    name: "customer — already converted",
    expectedGrade: "customer",
    signals: {
      profile: {
        id: "fixture-customer",
        user_id: "fixture-user",
        business_name: "Paying Co",
        email: "client@payingco.com",
        phone: "+15553334444",
        website: "https://payingco.com",
        industry: "Dental",
        city: "Austin",
        state: "TX",
        google_rating: 4.9,
        review_count: 220,
        status: "converted",
        source: "Referral",
      },
      events: [],
      recentInteractions: [],
      isCustomer: true,
    },
  },
];
