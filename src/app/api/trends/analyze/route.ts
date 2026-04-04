import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Trend Analyzer — Finds trending topics per industry for content opportunities
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { industry, client_id, platform } = await request.json();

  let clientIndustry = industry || "digital marketing";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("industry").eq("id", client_id).single();
    if (client?.industry) clientIndustry = client.industry;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: `You are a trend analyst and content strategist. Identify current trending topics, viral formats, and content opportunities for the ${clientIndustry} industry. Use your knowledge up to your training date. Return valid JSON only.`,
      messages: [{ role: "user", content: `Find trending topics and content opportunities for the ${clientIndustry} industry${platform ? ` on ${platform}` : " across all platforms"}.

Return JSON with:
- trending_topics: array of 10 { topic, why_trending, content_angle, urgency (high/medium/low), platforms_best_for: array }
- viral_formats: array of 5 { format_name, description, example_hook, platforms, difficulty }
- seasonal_opportunities: array of 3 upcoming seasonal/holiday content ideas
- competitor_content_gaps: array of 5 topics competitors aren't covering
- hook_templates: array of 10 proven hook formulas adapted for ${clientIndustry}
- content_calendar_suggestions: 7-day content plan with { day, platform, content_type, topic, hook, best_time }
- hashtag_trends: array of 10 trending hashtags in this niche right now
- audio_trends: array of 5 trending sounds/audio for Reels/TikTok (describe the trend)` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, trends: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, trends: { raw: text } });
  }
}
