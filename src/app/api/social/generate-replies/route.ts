import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Social Media Reply Assistant — Generates replies for comments/DMs
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { comments, client_id, platform, tone } = await request.json();

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
      system: `You are the social media manager for ${clientName} (${industry}). Generate authentic, engaging replies to social media comments and DMs. Tone: ${tone || "friendly and professional"}. Return valid JSON only.`,
      messages: [{ role: "user", content: `Generate replies for these ${platform || "social media"} comments/messages:

${Array.isArray(comments) ? comments.map((c: string, i: number) => `${i + 1}. "${c}"`).join("\n") : `1. "${comments}"`}

Return JSON array, each with:
- original: the comment
- reply: suggested reply (natural, not robotic)
- reply_alt: an alternative reply option
- emoji_suggestion: optional emoji to add
- should_like: boolean (should we like this comment too)
- priority: "urgent" | "normal" | "optional"
- sentiment: "positive" | "neutral" | "negative" | "question"` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, replies: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, replies: [{ original: comments, reply: text }] });
  }
}
