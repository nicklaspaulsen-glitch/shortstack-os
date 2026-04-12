import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Client } from "@/lib/types";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// 1. analyzeCampaign -- AI Campaign Optimizer
// ---------------------------------------------------------------------------

export async function analyzeCampaign(
  campaign: Campaign,
  client: Pick<Client, "business_name" | "industry" | "mrr">,
  allCampaigns?: Campaign[]
): Promise<{
  suggestions: string;
  actions: Array<{
    action_type: string;
    title: string;
    description: string;
    ai_reasoning: string;
    proposed_changes: Record<string, unknown>;
    current_values: Record<string, unknown>;
    estimated_impact: string;
    priority: string;
  }>;
}> {
  const companionCampaigns = allCampaigns
    ?.filter((c) => c.id !== campaign.id && c.client_id === campaign.client_id)
    .map((c) => ({
      name: c.name,
      platform: c.platform,
      status: c.status,
      spend: c.spend,
      roas: c.roas,
      ctr: c.ctr,
      cpc: c.cpc,
      conversions: c.conversions,
      budget_daily: c.budget_daily,
    }));

  const prompt = `You are an expert digital ads strategist for an agency managing campaigns on Meta, Google, and TikTok.

Analyze this campaign and return JSON with optimization suggestions and concrete actions.

CLIENT: ${client.business_name} | Industry: ${client.industry ?? "unknown"} | MRR: $${client.mrr}

CAMPAIGN:
- Name: ${campaign.name}
- Platform: ${campaign.platform}
- Status: ${campaign.status}
- Spend: $${campaign.spend} | Daily budget: $${campaign.budget_daily ?? "N/A"} | Total budget: $${campaign.budget_total ?? "N/A"}
- Impressions: ${campaign.impressions} | Clicks: ${campaign.clicks} | Conversions: ${campaign.conversions}
- CTR: ${campaign.ctr}% | CPC: $${campaign.cpc} | ROAS: ${campaign.roas}x
- Start: ${campaign.start_date ?? "N/A"} | End: ${campaign.end_date ?? "N/A"}
${companionCampaigns?.length ? `\nOTHER CAMPAIGNS FOR THIS CLIENT:\n${JSON.stringify(companionCampaigns, null, 2)}` : ""}

BENCHMARKS:
- ROAS: <1x bad, 1-2x needs improvement, 2-4x good, 4x+ excellent
- CTR: Meta 0.9-1.5%, Google 3-5%, TikTok 1-3%
- Budget utilization: compare spend vs daily/total budget

Evaluate:
1. ROAS performance relative to benchmarks
2. CTR relative to platform benchmarks
3. CPC efficiency
4. Budget utilization (spend vs budget)
5. Conversion rate (conversions / clicks)
6. Comparison to sibling campaigns if provided

Propose concrete actions such as:
- Increase/decrease budget based on ROAS
- Pause underperforming campaigns (ROAS <0.5x sustained)
- Shift budget from low to high performers
- Targeting changes
- Creative refreshes when CTR drops

Respond ONLY with valid JSON matching this schema:
{
  "suggestions": "<paragraph of analysis and recommendations>",
  "actions": [
    {
      "action_type": "budget_increase | budget_decrease | pause_campaign | activate_campaign | adjust_targeting | update_ad_copy | other",
      "title": "<short title>",
      "description": "<what to do>",
      "ai_reasoning": "<why>",
      "proposed_changes": { "<key>": "<value>" },
      "current_values": { "<key>": "<value>" },
      "estimated_impact": "<expected improvement>",
      "priority": "low | medium | high | critical"
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    return {
      suggestions: parsed.suggestions ?? "",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return {
      suggestions:
        `Auto-analysis unavailable. Quick overview: ROAS is ${campaign.roas}x ` +
        `(${campaign.roas >= 4 ? "excellent" : campaign.roas >= 2 ? "good" : campaign.roas >= 1 ? "needs improvement" : "underperforming"}), ` +
        `CTR is ${campaign.ctr}%, CPC is $${campaign.cpc}. ` +
        `${campaign.roas < 1 ? "Consider pausing or restructuring this campaign." : "Monitor and optimize."}`,
      actions: [],
    };
  }
}

// ---------------------------------------------------------------------------
// 2. generateAdCopy -- AI Copy Generator
// ---------------------------------------------------------------------------

export async function generateAdCopy(config: {
  platform: string;
  clientName?: string;
  industry?: string;
  objective: string;
  targetAudience: string;
  offer: string;
  tone: string;
}): Promise<{
  variations: Array<{
    headline: string;
    primary_text: string;
    description: string;
    cta: string;
    hook_type: string;
    estimated_performance: string;
  }>;
  image_suggestions: Array<{ concept: string; style: string }>;
  a_b_test_plan: string;
  platform_tips: string;
}> {
  const platformLimits: Record<string, string> = {
    meta_ads:
      "Primary text: max 125 chars. Headline: max 40 chars. Keep punchy and benefit-driven.",
    google_ads:
      "Headlines: max 30 chars each. Descriptions: max 90 chars each. Use keywords naturally.",
    tiktok_ads:
      "Short punchy hooks under 10 words. Trend-aware language. Conversational and authentic tone.",
  };

  const prompt = `You are an elite performance marketing copywriter specializing in paid ads.

Generate 5 ad copy variations for the following brief, each with a different hook type.

BRIEF:
- Platform: ${config.platform}
- Client: ${config.clientName ?? "N/A"} | Industry: ${config.industry ?? "N/A"}
- Objective: ${config.objective}
- Target audience: ${config.targetAudience}
- Offer: ${config.offer}
- Tone: ${config.tone}

PLATFORM CONSTRAINTS:
${platformLimits[config.platform] ?? "Follow standard ad copy best practices."}

HOOK TYPES (one per variation):
1. Question -- open with a compelling question
2. Statistic -- lead with a number or data point
3. Fear/Urgency -- create urgency or highlight a pain point
4. Benefit -- lead with the primary benefit
5. Social proof -- reference results, reviews, or popularity

Also provide image/creative suggestions and an A/B test plan.

Respond ONLY with valid JSON matching this schema:
{
  "variations": [
    {
      "headline": "<headline text>",
      "primary_text": "<primary ad text>",
      "description": "<description line>",
      "cta": "<call to action>",
      "hook_type": "question | statistic | fear_urgency | benefit | social_proof",
      "estimated_performance": "<high | medium | low with brief reason>"
    }
  ],
  "image_suggestions": [
    { "concept": "<visual concept>", "style": "<photography | illustration | ugc | motion>" }
  ],
  "a_b_test_plan": "<how to test these variations>",
  "platform_tips": "<platform-specific optimization tips>"
}`;

  const fallbackResult = {
    variations: [
      {
        headline: `${config.offer} -- ${config.industry ?? "Your Business"}`,
        primary_text: `Discover how ${config.targetAudience} are achieving results with ${config.offer}. Get started today.`,
        description: `${config.objective} for ${config.targetAudience}.`,
        cta: "Learn More",
        hook_type: "benefit",
        estimated_performance: "medium -- generic fallback copy",
      },
    ],
    image_suggestions: [
      {
        concept: "Product/service hero shot with benefit overlay",
        style: "photography",
      },
    ],
    a_b_test_plan:
      "AI generation unavailable. Create manual variations testing different hooks and CTAs.",
    platform_tips:
      "Follow platform character limits and test creative formats native to the platform.",
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    return {
      variations: Array.isArray(parsed.variations)
        ? parsed.variations
        : fallbackResult.variations,
      image_suggestions: Array.isArray(parsed.image_suggestions)
        ? parsed.image_suggestions
        : fallbackResult.image_suggestions,
      a_b_test_plan:
        parsed.a_b_test_plan ?? fallbackResult.a_b_test_plan,
      platform_tips:
        parsed.platform_tips ?? fallbackResult.platform_tips,
    };
  } catch {
    return fallbackResult;
  }
}

// ---------------------------------------------------------------------------
// 3. generateBulkInsights -- Portfolio-level analysis
// ---------------------------------------------------------------------------

export async function generateBulkInsights(
  campaigns: Campaign[],
  clients: Array<{ id: string; business_name: string }>
): Promise<{
  summary: string;
  top_performers: string[];
  underperformers: string[];
  budget_recommendations: string;
  total_actions: number;
}> {
  const clientMap = new Map(clients.map((c) => [c.id, c.business_name]));

  const portfolioData = campaigns.map((c) => ({
    name: c.name,
    client: clientMap.get(c.client_id) ?? "Unknown",
    platform: c.platform,
    status: c.status,
    spend: c.spend,
    roas: c.roas,
    ctr: c.ctr,
    cpc: c.cpc,
    conversions: c.conversions,
    budget_daily: c.budget_daily,
  }));

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgRoas =
    campaigns.length > 0
      ? campaigns.reduce((s, c) => s + c.roas, 0) / campaigns.length
      : 0;

  const prompt = `You are a senior media buyer analyzing an agency's full ad portfolio.

PORTFOLIO SUMMARY:
- Total campaigns: ${campaigns.length}
- Total spend: $${totalSpend.toFixed(2)}
- Total conversions: ${totalConversions}
- Average ROAS: ${avgRoas.toFixed(2)}x
- Clients: ${clients.length}

CAMPAIGN DATA:
${JSON.stringify(portfolioData, null, 2)}

Analyze the entire portfolio and identify:
1. Top performing campaigns (ROAS >2x, strong CTR)
2. Underperformers that need attention (ROAS <1x, low CTR)
3. Budget reallocation opportunities (shift from low to high performers)
4. Cross-client patterns and trends
5. Total number of recommended actions

Respond ONLY with valid JSON matching this schema:
{
  "summary": "<2-3 sentence portfolio overview>",
  "top_performers": ["<campaign name -- client name: brief reason>"],
  "underperformers": ["<campaign name -- client name: brief reason>"],
  "budget_recommendations": "<specific reallocation advice>",
  "total_actions": <number of recommended actions>
}`;

  const fallback = {
    summary:
      `Portfolio: ${campaigns.length} campaigns across ${clients.length} clients. ` +
      `Total spend: $${totalSpend.toFixed(2)}, avg ROAS: ${avgRoas.toFixed(2)}x. ` +
      `${avgRoas < 1 ? "Portfolio is underperforming overall." : "Portfolio performance is acceptable."}`,
    top_performers: campaigns
      .filter((c) => c.roas >= 2)
      .slice(0, 5)
      .map((c) => `${c.name} (${c.roas}x ROAS)`),
    underperformers: campaigns
      .filter((c) => c.roas < 1 && c.status === "active")
      .slice(0, 5)
      .map((c) => `${c.name} (${c.roas}x ROAS)`),
    budget_recommendations:
      "AI analysis unavailable. Review campaigns with ROAS below 1x and consider reallocating budget to top performers.",
    total_actions: campaigns.filter((c) => c.roas < 1 && c.status === "active")
      .length,
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    return {
      summary: parsed.summary ?? fallback.summary,
      top_performers: Array.isArray(parsed.top_performers)
        ? parsed.top_performers
        : fallback.top_performers,
      underperformers: Array.isArray(parsed.underperformers)
        ? parsed.underperformers
        : fallback.underperformers,
      budget_recommendations:
        parsed.budget_recommendations ?? fallback.budget_recommendations,
      total_actions:
        typeof parsed.total_actions === "number"
          ? parsed.total_actions
          : fallback.total_actions,
    };
  } catch {
    return fallback;
  }
}
