import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Ad Copy Generator — Creates high-converting ad copy for all platforms
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, platform, objective, target_audience, offer, tone } = await request.json();

  let clientName = "the business";
  let industry = "business";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "You are a direct-response copywriter specializing in paid social ads. Write copy that converts. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate ad copy variations for ${clientName} (${industry}).
Platform: ${platform || "Meta Ads"}
Objective: ${objective || "Lead generation"}
Target audience: ${target_audience || "Local customers"}
Offer: ${offer || "Free consultation"}
Tone: ${tone || "professional, urgent, benefit-focused"}

Return JSON with:
- variations: array of 5 ad copy variations, each with:
  - headline: (under 40 chars)
  - primary_text: full ad body copy
  - description: (under 30 chars for link description)
  - cta: call to action button text
  - hook_type: what psychological trigger it uses (urgency, social proof, curiosity, etc)
  - estimated_performance: "high" | "medium" (based on copy principles)
- image_suggestions: array of 3 image concepts with Midjourney prompts
- a_b_test_plan: which 2 variations to test first and why
- platform_tips: specific tips for ${platform || "Meta"} ads` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, adCopy: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, adCopy: { raw: text } });
  }
}
