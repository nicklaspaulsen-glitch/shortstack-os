import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI ROI Calculator — Shows prospects/clients projected return on investment
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { industry, monthly_investment, current_revenue, current_leads_per_month, services } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "You are a digital marketing ROI analyst. Calculate realistic projections based on industry benchmarks. Be specific with numbers. Return valid JSON only.",
      messages: [{ role: "user", content: `Calculate ROI projection for a ${industry} business:
Current monthly revenue: $${current_revenue || "unknown"}
Current leads/month: ${current_leads_per_month || "unknown"}
Monthly investment with ShortStack: $${monthly_investment}
Services: ${services?.join(", ") || "Full digital marketing"}

Return JSON with:
- monthly_investment: number
- projected_new_leads_per_month: number (realistic for this industry)
- projected_conversion_rate: number (percentage)
- projected_new_customers_per_month: number
- average_customer_value: number (industry benchmark)
- projected_monthly_revenue_increase: number
- projected_annual_revenue_increase: number
- roi_percentage: number (annual return / investment * 100)
- payback_period_months: number
- break_even_month: number
- year_1_projection: { revenue: number, profit: number, roi: number }
- year_2_projection: { revenue: number, profit: number, roi: number }
- year_3_projection: { revenue: number, profit: number, roi: number }
- key_assumptions: array of strings
- industry_benchmarks: { avg_cpc: number, avg_conversion_rate: number, avg_customer_lifetime_value: number }` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const roi = JSON.parse(cleaned);
    return NextResponse.json({ success: true, roi });
  } catch {
    return NextResponse.json({ success: true, roi: { raw: text } });
  }
}
