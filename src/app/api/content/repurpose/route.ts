import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Content Repurposer — Takes 1 piece of content and turns it into 10+
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, content_type, client_id } = await request.json();

  let clientName = "ShortStack";
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
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are a content repurposing expert for ${clientName}. Take one piece of content and create 10+ variations for different platforms. Return valid JSON only.`,
      messages: [{ role: "user", content: `Repurpose this ${content_type || "content"} into multiple formats:

Original content:
${content}

Return JSON with:
- original_summary: 1 sentence summary of the original
- repurposed: array of objects, each with:
  - platform: target platform
  - format: "tweet" | "instagram_caption" | "linkedin_post" | "tiktok_script" | "youtube_short_script" | "blog_outline" | "email_newsletter" | "carousel_slides" | "quote_graphic_text" | "podcast_talking_points" | "infographic_outline" | "pinterest_pin"
  - content: the full repurposed content ready to use
  - hashtags: array (if applicable)
  - image_prompt: Midjourney prompt for visual (if applicable)
  - estimated_engagement: "high" | "medium" | "low"

Generate at least 12 variations across different platforms and formats.` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, repurposed: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, repurposed: { raw: text } });
  }
}
