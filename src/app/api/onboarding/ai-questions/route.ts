import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 30;

type Stage = "pain_points" | "goals" | "audience";

interface RequestBody {
  user_type?: string;
  business_info?: Record<string, unknown>;
  stage?: Stage;
}

interface AIQuestion {
  id: string;
  label: string;
  placeholder: string;
  kind: "short_text" | "long_text" | "chips";
  options?: string[];
}

const SYSTEM_PROMPT = `You are an onboarding expert. Given a user's business type and info, generate 4-6 specific questions to understand their goals, pain points, and target audience.

Questions must be:
- Specific to the user's business type (not generic)
- Actionable — answers should help us personalize their marketing tools
- Short (the question label under 90 characters)
- Mix of short text, long text, and chip-style multi-select questions

Return ONLY raw JSON (no markdown), shaped as:
{
  "questions": [
    {
      "id": "stable_snake_case_id",
      "label": "The question shown to the user",
      "placeholder": "Example answer format",
      "kind": "short_text" | "long_text" | "chips",
      "options": ["chip option 1", "chip option 2"]   // only when kind = "chips"
    }
  ]
}

Rules:
- 4-6 questions, no more.
- Use "chips" kind when there's a natural multi-choice set (platforms, channels, markets, etc).
- Use "long_text" for open-ended "describe..." style prompts; "short_text" for name/URL/number-ish answers.
- "options" must be present and non-empty when kind = "chips" (4-8 options).
- IDs must be unique, stable, and snake_case.`;

const STAGE_GUIDE: Record<Stage, string> = {
  pain_points: "Focus on what's NOT working in their current marketing/operations. What frustrations do they have? What's eating their time? Where are they losing money?",
  goals: "Focus on outcomes. What do they want to achieve in the next 3-6 months? Revenue targets, audience growth, operational wins. Be concrete, not generic.",
  audience: "Focus on WHO they're trying to reach. Demographics, platforms, buying habits, and what their ideal customer looks like.",
};

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userType = typeof body.user_type === "string" ? body.user_type : "other";
  const stage: Stage = body.stage === "goals" || body.stage === "audience" ? body.stage : "pain_points";
  const businessInfo = body.business_info && typeof body.business_info === "object" ? body.business_info : {};

  const userText = `USER TYPE: ${userType}
STAGE: ${stage}
STAGE GOAL: ${STAGE_GUIDE[stage]}

BUSINESS INFO:
${formatBusinessInfo(businessInfo)}

Generate 4-6 questions tailored to this user's ${userType.replace(/_/g, " ")} business at the "${stage}" stage. Return JSON only.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
    });

    const raw = getResponseText(resp);
    const parsed = safeJsonParse<{ questions?: unknown }>(raw);

    const questions = Array.isArray(parsed?.questions)
      ? (parsed!.questions as unknown[])
          .map(normalizeQuestion)
          .filter((q): q is AIQuestion => q !== null)
          .slice(0, 6)
      : [];

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions(userType, stage),
        fallback: true,
      });
    }

    return NextResponse.json({ success: true, questions, stage, user_type: userType });
  } catch (err) {
    console.error("[onboarding/ai-questions] failed:", err);
    return NextResponse.json({
      success: true,
      questions: fallbackQuestions(userType, stage),
      fallback: true,
    });
  }
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatBusinessInfo(info: Record<string, unknown>): string {
  const entries = Object.entries(info).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "(no details provided)";
  return entries
    .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
}

function normalizeQuestion(raw: unknown): AIQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : "";
  const placeholder = typeof r.placeholder === "string" ? r.placeholder : "";
  const kindRaw = typeof r.kind === "string" ? r.kind : "short_text";
  const kind: AIQuestion["kind"] =
    kindRaw === "long_text" || kindRaw === "chips" ? kindRaw : "short_text";
  const options = Array.isArray(r.options)
    ? r.options.filter((o): o is string => typeof o === "string").slice(0, 8)
    : undefined;

  if (!id || !label) return null;
  if (kind === "chips" && (!options || options.length === 0)) return null;

  return { id, label, placeholder, kind, options };
}

/* ─── Fallback question banks (by type + stage) ────────────────────── */

function fallbackQuestions(userType: string, stage: Stage): AIQuestion[] {
  const key = `${userType}:${stage}` as const;
  if (FALLBACKS[key]) return FALLBACKS[key];
  if (FALLBACKS[`other:${stage}`]) return FALLBACKS[`other:${stage}`];
  return FALLBACKS["other:pain_points"];
}

const FALLBACKS: Record<string, AIQuestion[]> = {
  // ── Content creator ──
  "content_creator:pain_points": [
    { id: "platforms", label: "Which platforms do you post on?", placeholder: "Pick all that apply", kind: "chips", options: ["YouTube", "TikTok", "Instagram", "X/Twitter", "LinkedIn", "Threads", "Twitch", "Podcast"] },
    { id: "content_niche", label: "What's your content niche?", placeholder: "e.g. tech reviews, cooking, fitness", kind: "short_text" },
    { id: "frequency", label: "How often do you post right now?", placeholder: "e.g. 3x/week on TikTok, weekly on YouTube", kind: "short_text" },
    { id: "biggest_blocker", label: "What's the biggest thing slowing you down?", placeholder: "e.g. editing takes forever, I run out of ideas", kind: "long_text" },
  ],
  "content_creator:goals": [
    { id: "follower_goal", label: "What's your follower goal in the next 6 months?", placeholder: "e.g. 50k on TikTok", kind: "short_text" },
    { id: "monetization", label: "How do you want to monetize?", placeholder: "Pick all that apply", kind: "chips", options: ["Brand deals", "Ad revenue", "Merch", "Digital products", "Course", "Coaching", "Memberships"] },
    { id: "north_star", label: "What would make the next 90 days a win?", placeholder: "e.g. first viral video, first brand deal", kind: "long_text" },
  ],
  "content_creator:audience": [
    { id: "audience_description", label: "Describe your ideal viewer in one sentence.", placeholder: "e.g. men 25-40 into home workouts", kind: "long_text" },
    { id: "age_range", label: "Primary age range?", placeholder: "", kind: "chips", options: ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"] },
    { id: "intent", label: "What do they come to you for?", placeholder: "e.g. entertainment, how-to, inspiration", kind: "short_text" },
  ],

  // ── Real estate ──
  "real_estate:pain_points": [
    { id: "markets", label: "What markets do you work?", placeholder: "e.g. Miami-Dade, South Beach", kind: "short_text" },
    { id: "focus", label: "Buyers, sellers, or both?", placeholder: "", kind: "chips", options: ["Buyers", "Sellers", "Both", "Luxury", "First-time", "Investors", "Rentals"] },
    { id: "lead_gap", label: "Where do your leads come from today?", placeholder: "e.g. Zillow, referrals, cold calls", kind: "short_text" },
    { id: "biggest_pain", label: "What's the #1 pain in your business right now?", placeholder: "", kind: "long_text" },
  ],
  "real_estate:goals": [
    { id: "volume_goal", label: "How many transactions do you want to close this year?", placeholder: "e.g. 24 deals", kind: "short_text" },
    { id: "gci_goal", label: "GCI goal?", placeholder: "e.g. $500k", kind: "short_text" },
    { id: "focus_shift", label: "Any new focus areas (luxury, investors, relocation)?", placeholder: "", kind: "long_text" },
  ],
  "real_estate:audience": [
    { id: "ideal_client", label: "Describe your ideal client in one sentence.", placeholder: "e.g. 35-55 professionals relocating to Miami", kind: "long_text" },
    { id: "price_range", label: "Typical price range?", placeholder: "e.g. $500k-$2M", kind: "short_text" },
    { id: "channels", label: "Where do they spend time online?", placeholder: "", kind: "chips", options: ["Instagram", "Facebook", "LinkedIn", "Zillow", "YouTube", "Local news", "Google search"] },
  ],

  // ── Coach ──
  "coach:pain_points": [
    { id: "service_model", label: "What do you coach on?", placeholder: "e.g. career transitions, fitness", kind: "short_text" },
    { id: "delivery", label: "How do you deliver — 1:1, group, course?", placeholder: "", kind: "chips", options: ["1:1 sessions", "Group coaching", "Self-paced course", "Hybrid", "Retreats"] },
    { id: "bottleneck", label: "What's the biggest bottleneck in your business?", placeholder: "", kind: "long_text" },
  ],
  "coach:goals": [
    { id: "revenue_goal", label: "Revenue target over the next 90 days?", placeholder: "e.g. $30k/mo", kind: "short_text" },
    { id: "client_count", label: "How many clients do you want to serve?", placeholder: "e.g. 15 1:1 + 50 group", kind: "short_text" },
    { id: "product_launch", label: "Any offer or launch coming up?", placeholder: "", kind: "long_text" },
  ],
  "coach:audience": [
    { id: "ideal_client", label: "Describe your ideal client.", placeholder: "e.g. mid-career women 30-45 stuck in corporate", kind: "long_text" },
    { id: "awareness", label: "How aware are they of their problem?", placeholder: "", kind: "chips", options: ["Unaware", "Problem-aware", "Solution-aware", "Product-aware"] },
  ],

  // ── E-commerce ──
  "ecommerce:pain_points": [
    { id: "products", label: "What do you sell?", placeholder: "e.g. skincare, apparel, supplements", kind: "short_text" },
    { id: "platform", label: "What platform are you on?", placeholder: "", kind: "chips", options: ["Shopify", "WooCommerce", "Amazon", "Etsy", "TikTok Shop", "Custom"] },
    { id: "aov", label: "What's your average order value?", placeholder: "e.g. $65", kind: "short_text" },
    { id: "biggest_leak", label: "Where are you losing money or conversions?", placeholder: "", kind: "long_text" },
  ],
  "ecommerce:goals": [
    { id: "revenue_goal", label: "Monthly revenue target?", placeholder: "e.g. $100k/mo", kind: "short_text" },
    { id: "priority_channel", label: "Top channel to grow?", placeholder: "", kind: "chips", options: ["Meta ads", "Google ads", "TikTok", "Email", "SMS", "Influencers", "SEO"] },
    { id: "launch_window", label: "Any product launch or promo coming up?", placeholder: "", kind: "long_text" },
  ],
  "ecommerce:audience": [
    { id: "ideal_customer", label: "Who's your ideal customer?", placeholder: "e.g. women 25-40 into clean beauty", kind: "long_text" },
    { id: "price_sensitivity", label: "Price tier?", placeholder: "", kind: "chips", options: ["Budget", "Mid-market", "Premium", "Luxury"] },
  ],

  // ── SaaS ──
  "saas:pain_points": [
    { id: "what_it_does", label: "What does your SaaS do in one sentence?", placeholder: "", kind: "short_text" },
    { id: "stage", label: "What stage are you at?", placeholder: "", kind: "chips", options: ["Pre-launch", "MVP", "First paying customers", "Scaling", "Profitable"] },
    { id: "icp", label: "Who is the ICP?", placeholder: "e.g. HR leaders at 50-500 person companies", kind: "short_text" },
    { id: "main_blocker", label: "What's blocking growth right now?", placeholder: "", kind: "long_text" },
  ],
  "saas:goals": [
    { id: "mrr_goal", label: "MRR target in 6 months?", placeholder: "e.g. $50k", kind: "short_text" },
    { id: "activation_focus", label: "Focus area?", placeholder: "", kind: "chips", options: ["Signups", "Activation", "Retention", "Expansion", "Churn reduction"] },
  ],
  "saas:audience": [
    { id: "buyer_persona", label: "Who actually signs the contract / pays?", placeholder: "", kind: "long_text" },
    { id: "channels", label: "Where do they hang out?", placeholder: "", kind: "chips", options: ["LinkedIn", "Twitter/X", "Reddit", "YouTube", "Slack groups", "Industry events", "Newsletters"] },
  ],

  // ── Service provider ──
  "service_provider:pain_points": [
    { id: "service", label: "What service do you offer?", placeholder: "e.g. web design, bookkeeping", kind: "short_text" },
    { id: "pricing_model", label: "How do you charge?", placeholder: "", kind: "chips", options: ["Hourly", "Project fixed", "Monthly retainer", "Value-based", "Productized"] },
    { id: "lead_source", label: "Where do clients come from today?", placeholder: "", kind: "short_text" },
    { id: "ceiling", label: "What's capping your income right now?", placeholder: "", kind: "long_text" },
  ],
  "service_provider:goals": [
    { id: "income_goal", label: "Monthly income target?", placeholder: "e.g. $20k/mo", kind: "short_text" },
    { id: "time_back", label: "How many hours/week do you want to reclaim?", placeholder: "", kind: "short_text" },
  ],
  "service_provider:audience": [
    { id: "ideal_client", label: "Who's your dream client?", placeholder: "", kind: "long_text" },
    { id: "client_size", label: "Client size sweet spot?", placeholder: "", kind: "chips", options: ["Solo", "2-10 people", "10-50", "50-200", "Enterprise"] },
  ],

  // ── Agency ──
  "agency:pain_points": [
    { id: "service_mix", label: "What services do you sell?", placeholder: "", kind: "chips", options: ["SEO", "Paid ads", "Content", "Web design", "Social media", "Email", "Branding", "Full-stack"] },
    { id: "client_count", label: "How many active clients?", placeholder: "", kind: "short_text" },
    { id: "avg_retainer", label: "Average retainer size?", placeholder: "e.g. $3k/mo", kind: "short_text" },
    { id: "biggest_pain", label: "What slows delivery or growth the most?", placeholder: "", kind: "long_text" },
  ],
  "agency:goals": [
    { id: "mrr_goal", label: "MRR goal in 6 months?", placeholder: "e.g. $50k", kind: "short_text" },
    { id: "client_goal", label: "Target client count?", placeholder: "e.g. 20", kind: "short_text" },
    { id: "growth_lever", label: "Main growth lever?", placeholder: "", kind: "chips", options: ["Outbound", "Referrals", "Content", "Partnerships", "Paid ads", "Events"] },
  ],
  "agency:audience": [
    { id: "ideal_client", label: "Describe your ideal agency client.", placeholder: "", kind: "long_text" },
    { id: "niche", label: "Primary niche?", placeholder: "e.g. dentists, DTC beauty, SaaS", kind: "short_text" },
  ],

  // ── Other (generic fallback) ──
  "other:pain_points": [
    { id: "description", label: "Describe your business in one sentence.", placeholder: "", kind: "short_text" },
    { id: "what_you_sell", label: "What do you sell / offer?", placeholder: "", kind: "short_text" },
    { id: "biggest_pain", label: "What's the biggest problem you want us to help with?", placeholder: "", kind: "long_text" },
  ],
  "other:goals": [
    { id: "top_goal", label: "What's the #1 goal for the next 90 days?", placeholder: "", kind: "long_text" },
    { id: "success_metric", label: "How will you know it worked?", placeholder: "e.g. $10k in new sales", kind: "short_text" },
  ],
  "other:audience": [
    { id: "target", label: "Who buys from you today?", placeholder: "", kind: "long_text" },
    { id: "where_they_are", label: "Where do they spend time?", placeholder: "", kind: "chips", options: ["Instagram", "TikTok", "LinkedIn", "Google", "YouTube", "Email", "Events", "Referrals"] },
  ],
};
