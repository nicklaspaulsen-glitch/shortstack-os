import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Review Response Generator — Generates professional replies to Google/Yelp reviews
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviews, client_id, tone } = await request.json();

  let clientName = "the business";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are the owner of ${clientName}. Write review responses that are ${tone || "warm, professional, and grateful"}. For negative reviews: acknowledge, empathize, offer resolution. For positive: thank and encourage return. Return valid JSON only.`,
      messages: [{ role: "user", content: `Generate responses for these reviews:

${Array.isArray(reviews) ? reviews.map((r: { rating: number; text: string }, i: number) => `${i + 1}. ${r.rating} stars: "${r.text}"`).join("\n") : `1. "${reviews}"`}

Return JSON array, each with:
- original_review: the review text
- rating: star rating
- response: professional response (2-4 sentences)
- sentiment: "positive" | "neutral" | "negative"
- follow_up_action: any internal action to take (e.g., "investigate complaint about wait time")` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, responses: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, responses: { raw: text } });
  }
}
