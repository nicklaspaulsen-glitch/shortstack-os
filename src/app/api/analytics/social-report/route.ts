import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Social Media Analytics Report — Analyzes performance and gives strategy adjustments
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, metrics } = await request.json();

  let clientName = "the client";
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
      system: `You are a social media analytics expert for ${clientName} (${industry}). Analyze performance data and give specific strategy adjustments. Return valid JSON only.`,
      messages: [{ role: "user", content: `Analyze social media performance and give recommendations:

${metrics ? `Current metrics: ${JSON.stringify(metrics)}` : `No specific metrics provided — give general ${industry} benchmarks and optimization strategy.`}

Return JSON with:
- performance_summary: 2 sentences on overall performance
- platform_breakdown: array of { platform, health (good/needs_work/critical), top_performing_content_type, recommendation }
- content_strategy_adjustments: array of 5 specific changes to make
- best_posting_times: array of { platform, day, time, reason }
- engagement_boosters: array of 5 tactics to increase engagement immediately
- growth_hacks: array of 3 unconventional strategies for rapid growth
- competitor_moves: what competitors in ${industry} are doing that works
- next_30_day_focus: top 3 priorities for the next month` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, report: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, report: { raw: text } });
  }
}
