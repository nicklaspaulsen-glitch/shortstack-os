import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 90;

type TemplateStyle =
  | "saas"
  | "ecommerce"
  | "agency"
  | "coach"
  | "course"
  | "webinar"
  | "app_download";

type SectionType =
  | "features"
  | "benefits"
  | "testimonials"
  | "faq"
  | "pricing"
  | "about"
  | "stats"
  | "process";

interface LandingGenerateInput {
  business_type: string;
  product_or_service: string;
  target_audience: string;
  value_proposition?: string;
  template_style?: TemplateStyle;
  include_sections?: SectionType[];
  /**
   * Optional: regenerate copy for a single section only.
   * When provided, the output `sections` array will contain just the one section.
   */
  regenerate_section?: SectionType;
}

interface LandingSection {
  type: SectionType;
  heading: string;
  content: unknown;
}

interface LandingGenerateOutput {
  headline: string;
  subheadline: string;
  hero_cta: string;
  sections: LandingSection[];
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
}

const SYSTEM_PROMPT = `You are a conversion-focused landing page copywriter who has written pages generating over $100M in revenue across SaaS, e-commerce, agencies, and digital products. You write cohesive, conversion-focused copy.

COPY PRINCIPLES
1. Headline: specific, benefit-led, under 12 words. No clever taglines that obscure the offer.
2. Subheadline: 15-30 words. Clarifies who it's for and what they get.
3. Hero CTA: 2-4 words, action verb, mirrors the visitor's mental state ("Start Free Trial", "Get the Playbook")
4. Every section heading advances the argument. No "Our Services" — write what the service does.
5. Testimonials use concrete outcomes (numbers, timeframes, specific wins).
6. FAQ answers the objection, doesn't just describe the feature.
7. Meta description: under 160 chars, includes the primary value prop.

SECTION CONTENT SHAPES
- features: content = [{ name: string, description: string, icon?: string }]
- benefits: content = [{ headline: string, description: string }]
- testimonials: content = [{ name: string, role: string, company: string, quote: string, result?: string }]
- faq: content = [{ question: string, answer: string }]
- pricing: content = { tiers: [{ name: string, price: string, period: string, features: string[], highlighted: boolean, cta: string }] }
- about: content = { paragraphs: string[] }
- stats: content = [{ value: string, label: string }]
- process: content = [{ step: number, title: string, description: string }]

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary) matching:
{
  "headline": "<headline>",
  "subheadline": "<subheadline>",
  "hero_cta": "<CTA text>",
  "sections": [
    { "type": "features", "heading": "<section heading>", "content": [...] }
  ],
  "meta": {
    "title": "<SEO title under 60 chars>",
    "description": "<meta description under 160 chars>",
    "keywords": ["keyword1", "keyword2", ...]
  }
}`;

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: LandingGenerateInput;
  try {
    body = (await request.json()) as LandingGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.business_type?.trim()) {
    return NextResponse.json({ error: "business_type is required" }, { status: 400 });
  }
  if (!body.product_or_service?.trim()) {
    return NextResponse.json({ error: "product_or_service is required" }, { status: 400 });
  }
  if (!body.target_audience?.trim()) {
    return NextResponse.json({ error: "target_audience is required" }, { status: 400 });
  }

  const templateStyle = body.template_style ?? "saas";
  const allSections: SectionType[] = [
    "features", "benefits", "testimonials", "faq", "pricing", "about", "stats", "process",
  ];
  let sectionsToUse = body.include_sections?.filter((s) => allSections.includes(s)) ?? [];
  if (sectionsToUse.length === 0) {
    sectionsToUse = ["features", "benefits", "testimonials", "faq"];
  }

  const regenerating = body.regenerate_section && allSections.includes(body.regenerate_section);
  if (regenerating) {
    sectionsToUse = [body.regenerate_section!];
  }

  const userPrompt = regenerating
    ? `Regenerate ONLY the "${body.regenerate_section}" section for this landing page.

BUSINESS TYPE: ${body.business_type}
PRODUCT OR SERVICE: ${body.product_or_service}
TARGET AUDIENCE: ${body.target_audience}
VALUE PROPOSITION: ${body.value_proposition ?? "Not specified — infer from product/service"}
TEMPLATE STYLE: ${templateStyle}

Return JSON with only this section filled in. Keep headline/subheadline/hero_cta as empty strings, and meta fields as empty/empty arrays. Put the regenerated section in the sections array. JSON only.`
    : `Generate complete landing page copy.

BUSINESS TYPE: ${body.business_type}
PRODUCT OR SERVICE: ${body.product_or_service}
TARGET AUDIENCE: ${body.target_audience}
VALUE PROPOSITION: ${body.value_proposition ?? "Not specified — infer from product/service"}
TEMPLATE STYLE: ${templateStyle}
SECTIONS TO INCLUDE: ${sectionsToUse.join(", ")}

Write cohesive, conversion-focused copy that ties every section back to the core promise. JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 5000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<LandingGenerateOutput>(text);

    if (!parsed || !Array.isArray(parsed.sections)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const sections: LandingSection[] = parsed.sections
      .filter(
        (s): s is LandingSection =>
          !!s &&
          typeof s.type === "string" &&
          typeof s.heading === "string"
      )
      .map((s) => ({
        type: s.type,
        heading: s.heading.trim(),
        content: s.content ?? [],
      }));

    const out: LandingGenerateOutput = {
      headline: parsed.headline?.trim() || "",
      subheadline: parsed.subheadline?.trim() || "",
      hero_cta: parsed.hero_cta?.trim() || "Get Started",
      sections,
      meta: {
        title: parsed.meta?.title?.trim() || "",
        description: parsed.meta?.description?.trim() || "",
        keywords: Array.isArray(parsed.meta?.keywords)
          ? parsed.meta!.keywords.slice(0, 20).map((k) => String(k).trim()).filter(Boolean)
          : [],
      },
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: regenerating ? "ai_landing_page_regenerate_section" : "ai_landing_page_generate",
      description: regenerating
        ? `Landing section regenerated: ${body.regenerate_section}`
        : `Landing page generated: ${out.headline.slice(0, 80)}`,
      profile_id: user.id,
      status: "completed",
      result: {
        business_type: body.business_type,
        template_style: templateStyle,
        section_count: out.sections.length,
        regenerated_section: body.regenerate_section ?? null,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[landing-pages/generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate landing page", detail: message },
      { status: 500 }
    );
  }
}
