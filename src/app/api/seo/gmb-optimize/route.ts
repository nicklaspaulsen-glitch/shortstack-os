import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Google Business Profile Optimizer — AI generates optimization recommendations
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, business_name, address, category } = await request.json();

  let clientData = { name: business_name, industry: category };
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, phone, website").eq("id", client_id).single();
    if (client) clientData = { name: client.business_name, industry: client.industry || "business" };
  }

  // Search Google Places for current listing data
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  let placesData: Record<string, unknown> = {};

  if (placesKey && clientData.name) {
    try {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(clientData.name + " " + (address || ""))}&key=${placesKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (searchData.results?.[0]) {
        const placeId = searchData.results[0].place_id;
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_phone_number,formatted_address,website,opening_hours,reviews,types,url&key=${placesKey}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        placesData = detailData.result || {};
      }
    } catch { /* ignore */ }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are a local SEO expert specializing in Google Business Profile optimization. Return valid JSON only.",
      messages: [{ role: "user", content: `Optimize Google Business Profile for:
Business: ${clientData.name}
Industry: ${clientData.industry}
Current data from Google: ${JSON.stringify(placesData).substring(0, 2000)}

Return JSON with:
- current_score: number (1-100 based on profile completeness)
- missing_elements: array of things not set up
- optimization_tips: array of { area, current, recommendation, impact (high/medium/low) }
- review_strategy: { current_reviews, target, response_template, review_request_ideas: array }
- post_ideas: array of 5 Google Business posts to publish
- q_and_a: array of 10 questions to pre-populate with answers
- photo_recommendations: array of photo types to add
- category_suggestions: array of categories to add
- keywords_for_description: array of keywords to include in business description
- optimized_description: the ideal business description (750 chars max)` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, optimization: JSON.parse(cleaned), placesData });
  } catch {
    return NextResponse.json({ success: true, optimization: { raw: text } });
  }
}
