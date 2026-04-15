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
// 2. generateAdCopy -- AI Copy Generator (5 variations via Anthropic API)
// ---------------------------------------------------------------------------

const AD_ANGLES = ["BENEFIT", "URGENCY", "SOCIAL_PROOF", "QUESTION", "STORY"] as const;
type AdAngle = (typeof AD_ANGLES)[number];

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
    image_concept: string;
  }>;
  image_suggestions: Array<{ concept: string; style: string }>;
  a_b_test_plan: string;
  platform_tips: string;
}> {
  const platformLimits: Record<string, string> = {
    meta_ads:
      "Primary text: max 125 chars. Headline: max 40 chars. Description: max 30 chars. Keep punchy and benefit-driven. Use emojis sparingly for scroll-stopping power.",
    google_ads:
      "Headlines: max 30 chars each. Descriptions: max 90 chars each. Use keywords naturally. No excessive punctuation or ALL CAPS.",
    tiktok_ads:
      "Short punchy hooks under 10 words. Trend-aware language. Conversational and authentic tone. Gen-Z friendly but match target demo.",
  };

  const platformName =
    config.platform === "meta_ads"
      ? "Meta (Facebook/Instagram)"
      : config.platform === "google_ads"
        ? "Google Ads (Search/Display)"
        : config.platform === "tiktok_ads"
          ? "TikTok Ads"
          : config.platform;

  const systemPrompt = `You are an elite performance marketing copywriter who has managed $50M+ in ad spend across Meta, Google, and TikTok. You write conversion-focused ad copy that stops the scroll, hooks the reader, and drives action. Every variation you produce is ready to deploy.

CRITICAL: Return ONLY raw JSON. No markdown, no code fences, no explanation outside the JSON.`;

  const prompt = `Generate 5 high-converting ad copy variations for ${platformName}. Each variation MUST use a different angle/style as specified below.

=== CREATIVE BRIEF ===
Platform: ${platformName}
Client: ${config.clientName ?? "General business"}
Industry: ${config.industry ?? "General"}
Campaign objective: ${config.objective}
Target audience: ${config.targetAudience}
Offer / hook: ${config.offer}
Desired tone: ${config.tone}

=== PLATFORM CONSTRAINTS ===
${platformLimits[config.platform] ?? "Follow standard ad copy best practices."}

=== REQUIRED ANGLES (one per variation, in this order) ===
1. BENEFIT — Lead with the #1 outcome the audience wants. Focus on transformation and results.
2. URGENCY — Create time pressure or scarcity. Use deadlines, limited availability, or fear of missing out.
3. SOCIAL_PROOF — Reference real-world results, testimonials, popularity, or "join X others who..." framing.
4. QUESTION — Open with a provocative or relatable question that the audience can't ignore.
5. STORY — Use a mini-narrative or "before/after" arc. Paint a vivid picture in 2-3 sentences.

=== REQUIREMENTS FOR EACH VARIATION ===
- headline: Scroll-stopping headline tailored to the platform
- primary_text: The main ad body copy (compelling, concise, drives action)
- description: Supporting description / link description
- cta: Specific call-to-action button text (e.g. "Get My Free Quote", "Start Now", "Book Today")
- hook_type: The angle used (BENEFIT, URGENCY, SOCIAL_PROOF, QUESTION, or STORY)
- estimated_performance: Rate as "high", "medium", or "low" with a brief reason why
- image_concept: A specific visual concept suggestion that pairs with this copy variation

=== A/B TEST PLAN ===
Based on the 5 variations, provide a detailed A/B testing recommendation:
- Which 2 variations to test first and why
- What metric to optimize for given the "${config.objective}" objective
- Recommended budget split and test duration
- What to test next based on the winner

=== IMAGE SUGGESTIONS ===
Provide 3 image/creative concepts that work across the variations, each with a visual concept and style (photography, illustration, ugc, or motion).

=== PLATFORM TIPS ===
Provide 3-5 actionable platform-specific optimization tips for ${platformName} relevant to ${config.objective} campaigns.

Respond with valid JSON matching this exact schema:
{
  "variations": [
    {
      "headline": "string",
      "primary_text": "string",
      "description": "string",
      "cta": "string",
      "hook_type": "BENEFIT | URGENCY | SOCIAL_PROOF | QUESTION | STORY",
      "estimated_performance": "string",
      "image_concept": "string"
    }
  ],
  "image_suggestions": [
    { "concept": "string", "style": "photography | illustration | ugc | motion" }
  ],
  "a_b_test_plan": "string",
  "platform_tips": "string"
}`;

  const fallbackVariations: Array<{
    headline: string;
    primary_text: string;
    description: string;
    cta: string;
    hook_type: string;
    estimated_performance: string;
    image_concept: string;
  }> = AD_ANGLES.map((angle: AdAngle) => {
    const templates: Record<AdAngle, { headline: string; primary_text: string; cta: string }> = {
      BENEFIT: {
        headline: `Transform Your Results with ${config.offer}`,
        primary_text: `${config.targetAudience} are discovering how ${config.offer} can change everything. The results speak for themselves.`,
        cta: "Get Started Today",
      },
      URGENCY: {
        headline: `Limited Time: ${config.offer}`,
        primary_text: `Don't miss out — ${config.offer} won't last forever. ${config.targetAudience}, now is the time to act.`,
        cta: "Claim Now",
      },
      SOCIAL_PROOF: {
        headline: `Join Thousands Who Chose ${config.offer}`,
        primary_text: `${config.targetAudience} just like you have already made the switch. See why ${config.offer} is the top choice.`,
        cta: "See Results",
      },
      QUESTION: {
        headline: `Still Struggling Without ${config.offer}?`,
        primary_text: `What if there was a better way? ${config.targetAudience} are asking the same question — and finding answers with ${config.offer}.`,
        cta: "Find Out How",
      },
      STORY: {
        headline: `From Frustrated to Thriving with ${config.offer}`,
        primary_text: `They were stuck. Then they discovered ${config.offer}. Now ${config.targetAudience} everywhere are seeing the same transformation.`,
        cta: "Start Your Story",
      },
    };
    const t = templates[angle];
    return {
      headline: t.headline,
      primary_text: t.primary_text,
      description: `${config.objective} for ${config.targetAudience}.`,
      cta: t.cta,
      hook_type: angle,
      estimated_performance: "medium — template fallback, customize for better results",
      image_concept: "Hero image featuring the target audience experiencing the core benefit",
    };
  });

  const fallbackResult = {
    variations: fallbackVariations,
    image_suggestions: [
      { concept: "Hero shot of target audience experiencing the core benefit", style: "photography" as const },
      { concept: "Before/after split showing transformation", style: "illustration" as const },
      { concept: "Authentic UGC-style testimonial visual", style: "ugc" as const },
    ],
    a_b_test_plan:
      "AI generation unavailable. Recommended manual test: Run BENEFIT vs URGENCY variations first with a 50/50 budget split for 7 days, then test the winner against SOCIAL_PROOF.",
    platform_tips:
      "Follow platform character limits and test creative formats native to the platform. Start with a small daily budget and scale winners.",
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code fences if the model wraps the response
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate we got 5 variations
    const variations = Array.isArray(parsed.variations) ? parsed.variations : [];
    if (variations.length < 5) {
      console.warn(`[generateAdCopy] Expected 5 variations, got ${variations.length}`);
    }

    return {
      variations: variations.length > 0 ? variations : fallbackResult.variations,
      image_suggestions: Array.isArray(parsed.image_suggestions)
        ? parsed.image_suggestions
        : fallbackResult.image_suggestions,
      a_b_test_plan:
        parsed.a_b_test_plan ?? fallbackResult.a_b_test_plan,
      platform_tips:
        parsed.platform_tips ?? fallbackResult.platform_tips,
    };
  } catch (err) {
    console.error("[generateAdCopy] Anthropic API error, using fallback:", err);
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
