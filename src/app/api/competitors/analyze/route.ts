import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Competitor Analysis — Analyzes a client's competitors and suggests strategy
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, competitor_names, industry, location } = await request.json();

  let clientName = "the client";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: "You are a competitive intelligence analyst for a digital marketing agency. Provide actionable competitor analysis. Return valid JSON.",
      messages: [{ role: "user", content: `Analyze the competitive landscape for ${clientName} in the ${industry} industry${location ? ` in ${location}` : ""}.
${competitor_names ? `Known competitors: ${competitor_names.join(", ")}` : ""}

Return JSON with:
- market_overview: brief market analysis
- competitors: array of {name, strengths, weaknesses, online_presence_score (1-10), threat_level (low/medium/high)}
- opportunities: array of specific opportunities for the client
- recommended_strategy: detailed strategy to outperform competitors
- content_gaps: what content competitors aren't creating that we should
- ad_strategy: paid advertising recommendations
- quick_wins: 5 things we can do immediately` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const analysis = JSON.parse(cleaned);
    return NextResponse.json({ success: true, analysis });
  } catch {
    return NextResponse.json({ success: true, analysis: { raw: text } });
  }
}
