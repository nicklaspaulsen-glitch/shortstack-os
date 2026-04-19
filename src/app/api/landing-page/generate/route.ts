import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";

// POST /api/landing-page/generate
// Accepts business info + template choice and returns structured landing page content
export async function POST(request: NextRequest) {
  // Auth — this endpoint proxies to Anthropic; without auth anyone on the
  // internet can burn our API credits by pointing traffic at us.
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { business_name, industry, description, template, sections } = body;

    if (!business_name || !industry) {
      return NextResponse.json(
        { error: "business_name and industry are required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI not configured — ANTHROPIC_API_KEY missing" },
        { status: 500 },
      );
    }

    const client = new Anthropic({ apiKey });

    const requestedSections = (sections && sections.length > 0)
      ? sections.join(", ")
      : "hero, features, testimonials, pricing, faq, contact, footer";

    const prompt = `Generate landing page content for:
Business: ${business_name}
Industry: ${industry}
Description: ${description || "Not provided"}
Template style: ${template || "SaaS Landing"}
Sections needed: ${requestedSections}

Return ONLY valid JSON with this structure:
{
  "hero": {
    "headline": "string",
    "subheadline": "string",
    "cta_text": "string",
    "cta_url": "#"
  },
  "features": [
    { "icon": "lucide-icon-name", "title": "string", "description": "string" }
  ],
  "testimonials": [
    { "name": "string", "company": "string", "quote": "string", "role": "string" }
  ],
  "pricing": [
    { "name": "string", "price": "string", "period": "string", "features": ["string"], "highlighted": false }
  ],
  "faq": [
    { "question": "string", "answer": "string" }
  ],
  "contact": {
    "heading": "string",
    "subheading": "string",
    "email": "string",
    "phone": "string"
  },
  "footer": {
    "copyright": "string",
    "links": [{ "label": "string", "url": "#" }],
    "social": [{ "platform": "string", "url": "#" }]
  }
}

Generate 3-4 features, 3 testimonials, 3 pricing tiers (mark middle as highlighted), 5 FAQs. Make content realistic, professional, and specific to the business. Use real-sounding names for testimonials.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system:
        "You are a landing page copywriter. Return ONLY valid JSON, no markdown fences, no explanation.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: cleaned },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      business_name,
      template: template || "SaaS Landing",
      content: parsed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[landing-page/generate] Error:", message);
    return NextResponse.json(
      { error: "Failed to generate landing page", details: message },
      { status: 500 },
    );
  }
}
