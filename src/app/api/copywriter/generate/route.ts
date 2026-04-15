import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

// Content type definitions for system prompts
const CONTENT_TYPE_CONFIG: Record<
  string,
  { label: string; systemPrompt: string; outputFormat: string }
> = {
  blog: {
    label: "Blog Post",
    systemPrompt:
      "You are an expert blog writer for digital marketing agencies. You write SEO-optimized, engaging blog posts that drive organic traffic and establish thought leadership. Structure your posts with clear headings (H2, H3), an engaging intro, scannable sections, and a strong conclusion with a call-to-action.",
    outputFormat:
      "Return the blog post in markdown format with proper heading hierarchy, bullet points, and formatting.",
  },
  landing: {
    label: "Landing Page Copy",
    systemPrompt:
      "You are a conversion-focused landing page copywriter who has generated millions in revenue. You craft headlines that stop the scroll, benefit-driven body copy, social proof sections, and irresistible CTAs. Structure: Hero headline + subheadline, Problem/Agitation, Solution, Features/Benefits, Social Proof, CTA.",
    outputFormat:
      "Return the landing page copy with clear section labels (HERO, PROBLEM, SOLUTION, FEATURES, SOCIAL PROOF, CTA). Use markdown formatting.",
  },
  email: {
    label: "Email Campaign",
    systemPrompt:
      "You are an email marketing specialist who consistently achieves above-average open and click rates. You write compelling subject lines, preview text, and email body copy that drives action. Structure: Subject line options, Preview text, Email body with a clear flow from hook to CTA.",
    outputFormat:
      "Return 3 subject line options, preview text, and the full email body in markdown. Label each section clearly.",
  },
  social: {
    label: "Social Media Captions",
    systemPrompt:
      "You are a social media content strategist for agencies managing multiple brand accounts. You write platform-native captions that drive engagement, follows, and conversions. Include relevant hashtag suggestions and emoji usage appropriate to the brand tone.",
    outputFormat:
      "Return 5 caption variations, each with the caption text, suggested hashtags, and a note about which platform it works best for. Use markdown formatting.",
  },
  product: {
    label: "Product Description",
    systemPrompt:
      "You are an e-commerce copywriter specializing in product descriptions that convert browsers into buyers. You highlight benefits over features, use sensory language, address objections, and create urgency. Structure: Headline, Short description, Feature bullets, Long description, SEO meta description.",
    outputFormat:
      "Return the product description with labeled sections: HEADLINE, SHORT DESCRIPTION, FEATURE BULLETS, LONG DESCRIPTION, META DESCRIPTION. Use markdown formatting.",
  },
  ad: {
    label: "Ad Headlines & Copy",
    systemPrompt:
      "You are a performance marketing copywriter who has managed $50M+ in ad spend. You write conversion-focused ad copy that stops the scroll, hooks the reader, and drives action. Generate variations for multiple angles: benefit-led, urgency, social proof, question, and story-based.",
    outputFormat:
      "Return 5 ad variations, each with: headline, primary text, description, and CTA. Label the angle/approach for each. Use markdown formatting.",
  },
};

export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  try {
    const { type, topic, tone, audience, keywords, wordCount } =
      await request.json();

    if (!type || !topic) {
      return NextResponse.json(
        { error: "type and topic are required" },
        { status: 400 }
      );
    }

    const config = CONTENT_TYPE_CONFIG[type];
    if (!config) {
      return NextResponse.json(
        { error: `Invalid content type: ${type}` },
        { status: 400 }
      );
    }

    const systemPrompt = `${config.systemPrompt}

CRITICAL: Return well-formatted markdown content only. No code fences wrapping the entire output.`;

    const prompt = `Generate ${config.label} content based on the following brief:

=== BRIEF ===
Topic/Subject: ${topic}
Tone: ${tone || "professional"}
Target Audience: ${audience || "general business audience"}
Keywords to include: ${keywords || "none specified"}
Approximate word count: ${wordCount || 500} words

=== OUTPUT REQUIREMENTS ===
${config.outputFormat}

Write the content now. Make it compelling, polished, and ready for use.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      success: true,
      content: text,
      type,
      wordCount: text.split(/\s+/).length,
    });
  } catch (error) {
    console.error("[copywriter/generate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
