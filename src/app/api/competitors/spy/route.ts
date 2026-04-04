import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Competitor Spy — Deep analysis of a specific competitor's online presence
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { competitor_name, competitor_website, client_name, industry } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Fetch competitor website content if URL provided
  let websiteContent = "";
  if (competitor_website) {
    try {
      const res = await fetch(competitor_website, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      // Strip HTML tags, keep text
      websiteContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 3000);
    } catch { /* ignore */ }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You are a competitive intelligence analyst. Analyze competitors thoroughly and provide actionable insights. Return valid JSON only.",
      messages: [{ role: "user", content: `Deep-dive competitor analysis for ${client_name || "our client"} (${industry || "business"}).

Competitor: ${competitor_name}
${competitor_website ? `Website: ${competitor_website}` : ""}
${websiteContent ? `Website content (scraped):\n${websiteContent}` : ""}

Return JSON with:
- competitor_overview: { name, website, tagline, positioning, estimated_size }
- services_offered: array of services they offer with pricing if visible
- online_presence: { website_quality (1-10), seo_score_estimate (1-10), social_media_active (array of platforms), content_frequency, ad_activity }
- strengths: array of specific strengths with evidence
- weaknesses: array of exploitable weaknesses
- pricing_analysis: their pricing strategy vs market
- marketing_channels: array of { channel, activity_level (high/medium/low), effectiveness_estimate }
- content_strategy: what content they produce and gaps
- customer_targeting: who they target and how
- tech_stack: any visible technologies they use
- opportunities_to_beat_them: array of specific, actionable strategies to outcompete them
- ad_copy_suggestions: 3 ad headlines that position our client against this competitor
- content_ideas_to_outrank: 5 content pieces that would outrank their content
- social_media_attack_plan: specific strategy per platform to steal their audience
- timeline: 30/60/90 day plan to overtake this competitor` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, analysis: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, analysis: { raw: text } });
  }
}
