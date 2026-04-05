import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Pricing Strategy Advisor — Helps clients optimize their pricing
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, current_pricing, services_offered, target_market, competitors } = await request.json();

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
      system: "You are a pricing strategy consultant. Analyze and recommend optimal pricing strategies. Return valid JSON only.",
      messages: [{ role: "user", content: `Pricing strategy analysis for ${clientName} (${industry}).
Current pricing: ${current_pricing || "unknown"}
Services: ${services_offered || "various"}
Target market: ${target_market || "local customers"}
Competitors: ${competitors || "unknown"}

Return JSON with:
- current_assessment: analysis of current pricing
- recommended_strategy: "value-based" | "competitive" | "premium" | "penetration"
- pricing_tiers: array of 3 tiers { name, price_range, includes: array, best_for, margin_estimate }
- psychological_pricing_tips: array of 5 pricing psychology tactics to implement
- upsell_opportunities: array of services to bundle or upsell
- seasonal_adjustments: any seasonal pricing recommendations
- revenue_projection: estimated revenue increase from new pricing` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, pricing: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, pricing: { raw: text } });
  }
}
