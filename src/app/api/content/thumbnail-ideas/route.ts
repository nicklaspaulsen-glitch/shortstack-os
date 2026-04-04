import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Thumbnail Idea Generator — Creates click-worthy thumbnail concepts
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { video_title, topic, platform } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are a YouTube thumbnail designer who creates viral, high-CTR thumbnails. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate 5 thumbnail concepts for:
Video: "${video_title || topic}"
Platform: ${platform || "YouTube"}

Return JSON array of 5 thumbnails, each with:
- concept: visual description
- text_overlay: max 4 words on the thumbnail
- text_color: hex color
- background_style: description
- facial_expression: if person is in it
- color_scheme: array of 3 hex colors
- midjourney_prompt: detailed Midjourney prompt to generate this thumbnail
- estimated_ctr: "high" | "medium" based on thumbnail psychology
- why_it_works: one sentence explaining the psychology` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, thumbnails: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, thumbnails: { raw: text } });
  }
}
