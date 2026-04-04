import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI SEO Audit Tool — Analyzes a website and gives actionable SEO recommendations
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { website_url, client_id } = await request.json();
  if (!website_url) return NextResponse.json({ error: "Website URL required" }, { status: 400 });

  // Scrape the website
  let pageContent = "";
  let pageTitle = "";
  let metaDescription = "";
  let h1Tags: string[] = [];
  let imageCount = 0;
  let hasSSL = website_url.startsWith("https");

  try {
    const res = await fetch(website_url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackSEOBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // Extract SEO elements
    pageTitle = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "";
    metaDescription = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)?.[1] || "";
    h1Tags = (html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []).map(h => h.replace(/<[^>]+>/g, "").trim());
    imageCount = (html.match(/<img /gi) || []).length;
    const imagesWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;

    pageContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 3000);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: "You are an expert SEO auditor. Analyze websites and give specific, actionable recommendations. Score each area 1-10. Return valid JSON only.",
        messages: [{ role: "user", content: `SEO audit for: ${website_url}

Page title: "${pageTitle}"
Meta description: "${metaDescription}"
H1 tags: ${h1Tags.join(", ") || "none found"}
Images: ${imageCount} total
SSL: ${hasSSL ? "yes" : "NO - critical issue"}
Page content preview: ${pageContent.substring(0, 1500)}

Return JSON with:
- overall_score: number (1-100)
- grades: { technical_seo, on_page_seo, content_quality, mobile_friendliness, page_speed_estimate, local_seo }
- critical_issues: array of { issue, impact (high/medium/low), fix }
- improvements: array of { area, current_state, recommendation, priority (1-5), estimated_impact }
- keyword_opportunities: array of { keyword, monthly_volume_estimate, difficulty, recommendation }
- content_recommendations: array of { type, topic, reason }
- local_seo_tips: array of strings (if applicable)
- competitor_keywords_to_target: array of strings
- quick_wins: array of 5 things to fix immediately
- estimated_traffic_increase: string (if all recommendations implemented)` }],
      }),
    });

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const audit = JSON.parse(cleaned);

    // Log
    if (client_id) {
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `SEO audit completed: ${website_url} (Score: ${audit.overall_score}/100)`,
        client_id,
        status: "completed",
        result: { url: website_url, score: audit.overall_score },
        completed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, audit, raw_data: { pageTitle, metaDescription, h1Tags, imageCount, hasSSL } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
