import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Product/Service Description Writer — Creates compelling descriptions for client offerings
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, products, tone, platform } = await request.json();

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
      max_tokens: 3000,
      system: `You are a conversion copywriter for ${clientName} (${industry}). Write descriptions that sell. Return valid JSON only.`,
      messages: [{ role: "user", content: `Write product/service descriptions for ${clientName}.
Products/Services: ${Array.isArray(products) ? products.join(", ") : products || "their main services"}
Tone: ${tone || "professional, benefit-focused"}
Platform: ${platform || "website"}

Return JSON array, each with:
- name: product/service name
- tagline: one-line hook (under 10 words)
- short_description: 1-2 sentences for listings/cards
- full_description: 3-4 paragraphs for detail pages (HTML formatted)
- key_benefits: array of 5 benefits
- ideal_for: who this is perfect for
- seo_meta_description: under 160 chars
- social_ad_copy: ready-to-use ad copy for this product` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, descriptions: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, descriptions: { raw: text } });
  }
}
