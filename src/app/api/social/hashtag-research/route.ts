import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Hashtag Research — Generates optimized hashtag sets per platform and niche
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, platform, industry, client_id } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: "You are a social media hashtag expert. Research and suggest optimized hashtags. Return valid JSON only.",
      messages: [{ role: "user", content: `Research hashtags for: "${topic}" in the ${industry || "business"} industry on ${platform || "Instagram"}.

Return JSON with:
- primary_hashtags: array of 5 high-volume hashtags (500k+ posts)
- secondary_hashtags: array of 10 medium-volume hashtags (50k-500k posts)
- niche_hashtags: array of 10 low-competition hashtags (under 50k posts)
- trending_hashtags: array of 5 currently trending related hashtags
- banned_hashtags: array of hashtags to avoid (shadowban risk)
- hashtag_sets: array of 3 ready-to-use sets of 30 hashtags each (mix of all types)
- strategy_tip: one sentence on hashtag strategy for this niche` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, hashtags: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, hashtags: { raw: text } });
  }
}
