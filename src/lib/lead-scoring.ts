import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { sendCached, submitBatch } from "@/lib/ai/claude-client";

export interface Lead {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  google_rating: number | null;
  review_count: number | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
}

export interface ScoreBreakdown {
  fit: number;        // 0-25: industry fit and business size
  intent: number;     // 0-25: signals they need marketing help
  urgency: number;    // 0-25: how ready they are to buy now
  data_quality: number; // 0-25: completeness of contact info
}

export type RecommendedAction = "call_now" | "email_first" | "nurture" | "skip";

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  reasoning: string;
  recommended_action: RecommendedAction;
}

const SYSTEM_PROMPT = `You are a lead scoring expert for a digital marketing agency that helps small-to-medium local businesses grow online.

Score each lead on a 0-100 scale across four dimensions (each 0-25):
- fit: How well does this business fit our ideal client profile? (local SMBs in high-value industries like dental, law, med spa, real estate, HVAC, roofing, fitness, restaurant, salon score higher)
- intent: How likely do they need marketing help? (low review counts, poor ratings, missing website/social presence = high intent)
- urgency: How ready are they to buy now? (has phone = can call, has email = can reach, referral source = warmer)
- data_quality: How complete is their contact info? (phone, email, website, social links all add up)

Total score = sum of the four dimensions (0-100).

Determine recommended_action:
- call_now: score >= 70 AND has phone
- email_first: score >= 50 AND has email (but no phone, or score 50-69)
- nurture: score 30-49
- skip: score < 30

Return ONLY valid JSON. No markdown, no explanation outside the JSON:
{
  "score": <0-100>,
  "breakdown": {
    "fit": <0-25>,
    "intent": <0-25>,
    "urgency": <0-25>,
    "data_quality": <0-25>
  },
  "reasoning": "<1-2 sentences explaining the score>",
  "recommended_action": "<call_now|email_first|nurture|skip>"
}`;

function heuristicScore(lead: Lead): ScoreResult {
  const hasSocial = !!(lead.instagram_url || lead.facebook_url || lead.linkedin_url);

  // data_quality: up to 25
  let data_quality = 0;
  if (lead.phone) data_quality += 10;
  if (lead.email) data_quality += 10;
  if (lead.website) data_quality += 3;
  if (hasSocial) data_quality += 2;
  data_quality = Math.min(25, data_quality);

  // fit: up to 25 — industry match
  let fit = 8; // base
  const industry = (lead.industry || "").toLowerCase();
  const highValue = ["dental", "dentist", "lawyer", "law", "med spa", "real estate", "chiropractor", "accountant", "hvac", "roofing"];
  const medValue = ["gym", "fitness", "restaurant", "salon", "photographer", "therapist", "plumbing", "auto"];
  if (highValue.some(i => industry.includes(i))) fit = 22;
  else if (medValue.some(i => industry.includes(i))) fit = 15;
  fit = Math.min(25, fit);

  // intent: up to 25 — how much they need help
  let intent = 5;
  const reviews = lead.review_count ?? 0;
  if (reviews >= 5 && reviews <= 50) intent += 12;
  else if (reviews >= 51 && reviews <= 150) intent += 8;
  else if (reviews > 150) intent += 3;
  if (lead.google_rating && lead.google_rating < 4.0) intent += 8;
  else if (!lead.google_rating) intent += 5;
  if (!lead.website) intent += 3;
  intent = Math.min(25, intent);

  // urgency: up to 25
  let urgency = 0;
  if (lead.phone) urgency += 15;
  if (lead.email) urgency += 8;
  if ((lead.source || "").toLowerCase().includes("referral")) urgency += 5;
  urgency = Math.min(25, urgency);

  const score = Math.min(100, fit + intent + urgency + data_quality);

  let recommended_action: RecommendedAction = "skip";
  if (score >= 70 && lead.phone) recommended_action = "call_now";
  else if (score >= 50 && lead.email) recommended_action = "email_first";
  else if (score >= 30) recommended_action = "nurture";

  return {
    score,
    breakdown: { fit, intent, urgency, data_quality },
    reasoning: "Heuristic scoring based on contact completeness, industry fit, and review signals.",
    recommended_action,
  };
}

function leadToInfo(lead: Lead): Record<string, unknown> {
  const hasSocial = !!(lead.instagram_url || lead.facebook_url || lead.linkedin_url);
  return {
    business_name: lead.business_name,
    industry: lead.industry || "unknown",
    city: lead.city,
    state: lead.state,
    has_phone: !!lead.phone,
    has_email: !!lead.email,
    has_website: !!lead.website,
    has_social_media: hasSocial,
    google_rating: lead.google_rating,
    review_count: lead.review_count,
    source: lead.source,
  };
}

function sanitizeResult(parsed: unknown, lead: Lead): ScoreResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<ScoreResult>;
  if (typeof p.score !== "number") return null;

  const breakdown: ScoreBreakdown = {
    fit: Math.min(25, Math.max(0, p.breakdown?.fit ?? 0)),
    intent: Math.min(25, Math.max(0, p.breakdown?.intent ?? 0)),
    urgency: Math.min(25, Math.max(0, p.breakdown?.urgency ?? 0)),
    data_quality: Math.min(25, Math.max(0, p.breakdown?.data_quality ?? 0)),
  };
  const score = Math.min(100, Math.max(0, p.score));

  const validActions: RecommendedAction[] = ["call_now", "email_first", "nurture", "skip"];
  const recommended_action: RecommendedAction = validActions.includes(p.recommended_action as RecommendedAction)
    ? (p.recommended_action as RecommendedAction)
    : score >= 70 && lead.phone
      ? "call_now"
      : score >= 50 && lead.email
        ? "email_first"
        : score >= 30
          ? "nurture"
          : "skip";

  return {
    score,
    breakdown,
    reasoning: p.reasoning || "AI-scored.",
    recommended_action,
  };
}

/**
 * Score a single lead synchronously (on-demand).
 * Uses prompt caching — the SYSTEM_PROMPT is stable across every call.
 */
export async function scoreLead(lead: Lead): Promise<ScoreResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return heuristicScore(lead);
  }

  try {
    // Prefer the cached path for automatic cost savings + usage logging.
    const result = await sendCached({
      model: MODEL_HAIKU,
      maxTokens: 400,
      system: SYSTEM_PROMPT,
      userMessage: `Score this lead:\n${JSON.stringify(leadToInfo(lead), null, 2)}`,
      endpoint: "lead-scoring/synchronous",
    });
    const parsed = safeJsonParse<ScoreResult>(result.text);
    const scored = sanitizeResult(parsed, lead);
    return scored || heuristicScore(lead);
  } catch {
    // Last-resort: uncached raw SDK call (matches legacy behavior).
    try {
      const response = await anthropic.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Score this lead:\n${JSON.stringify(leadToInfo(lead), null, 2)}`,
          },
        ],
      });
      const text = getResponseText(response);
      const parsed = safeJsonParse<ScoreResult>(text);
      return sanitizeResult(parsed, lead) || heuristicScore(lead);
    } catch {
      return heuristicScore(lead);
    }
  }
}

/**
 * Submit a batch of leads for scoring in one Message Batches API call.
 * Used by /api/cron/score-leads for the nightly sweep (50% discount).
 */
export async function submitLeadScoringBatch(
  leads: Lead[],
): Promise<{
  batch_id: string;
  item_count: number;
  fallback_synchronous: boolean;
  inline_results?: Array<{ lead_id: string; score: ScoreResult }>;
}> {
  if (leads.length === 0) {
    return { batch_id: "", item_count: 0, fallback_synchronous: true };
  }

  const items = leads.map((lead) => ({
    custom_id: `lead:${lead.id}`,
    system: SYSTEM_PROMPT,
    userMessage: `Score this lead:\n${JSON.stringify(leadToInfo(lead), null, 2)}`,
    maxTokens: 400,
  }));

  const result = await submitBatch({
    model: MODEL_HAIKU,
    endpoint: "lead-scoring/batch",
    items,
  });

  // If kill-switch is on, submitBatch already ran each lead synchronously.
  if (result.fallback_synchronous && result.synchronous_results) {
    const inline = result.synchronous_results
      .map((r) => {
        const leadId = r.custom_id.replace(/^lead:/, "");
        const lead = leads.find((l) => l.id === leadId);
        if (!lead) return null;
        const parsed = safeJsonParse<ScoreResult>(r.text);
        const score = sanitizeResult(parsed, lead) || heuristicScore(lead);
        return { lead_id: leadId, score };
      })
      .filter((x): x is { lead_id: string; score: ScoreResult } => x !== null);
    return {
      batch_id: "",
      item_count: leads.length,
      fallback_synchronous: true,
      inline_results: inline,
    };
  }

  return { batch_id: result.batch_id, item_count: result.item_count, fallback_synchronous: false };
}

/**
 * Given { custom_id, text } tuples from a completed lead-scoring batch,
 * parse each into a ScoreResult and return the list for caller to persist.
 */
export function parseLeadScoringResults(
  results: Array<{ custom_id: string; text: string | null }>,
  leadsIndex: Record<string, Lead>,
): Array<{ lead_id: string; score: ScoreResult }> {
  const out: Array<{ lead_id: string; score: ScoreResult }> = [];
  for (const r of results) {
    const leadId = r.custom_id.replace(/^lead:/, "");
    const lead = leadsIndex[leadId];
    if (!lead) continue;
    if (!r.text) {
      out.push({ lead_id: leadId, score: heuristicScore(lead) });
      continue;
    }
    const parsed = safeJsonParse<ScoreResult>(r.text);
    const score = sanitizeResult(parsed, lead) || heuristicScore(lead);
    out.push({ lead_id: leadId, score });
  }
  return out;
}
