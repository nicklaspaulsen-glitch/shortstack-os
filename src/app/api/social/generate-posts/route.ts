import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Social Media Post Batch Generator — Creates a week's worth of posts for a client
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, num_posts, platforms, topics, tone } = await request.json();

  let clientName = "ShortStack";
  let industry = "marketing";
  let services: string[] = [];
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, services").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; services = client.services || []; }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are a social media strategist for ${clientName} (${industry}). Create engaging, platform-optimized posts. Return valid JSON only.`,
      messages: [{ role: "user", content: `Generate ${num_posts || 7} social media posts for ${clientName}.
Platforms: ${(platforms || ["instagram", "facebook", "tiktok"]).join(", ")}
Industry: ${industry}
Services: ${services.join(", ")}
Tone: ${tone || "professional yet approachable"}
${topics ? `Topics to cover: ${topics}` : "Mix of educational, promotional, and engaging content"}

Return JSON array of posts, each with:
- platform: target platform
- type: "image_post" | "carousel" | "reel_idea" | "story" | "text_post"
- caption: full caption text with emojis and line breaks
- hashtags: array of 15-20 relevant hashtags
- image_prompt: Midjourney prompt for the visual (if applicable)
- best_time: suggested posting time (e.g., "Tuesday 10am")
- cta: call to action
- engagement_hook: question or hook to boost comments` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const posts = JSON.parse(cleaned);

    // Save each post as a content script
    for (const post of (Array.isArray(posts) ? posts : [])) {
      await supabase.from("content_scripts").insert({
        client_id: client_id || null,
        title: `${post.platform} ${post.type}: ${post.caption?.substring(0, 50)}...`,
        script_type: "short_form",
        script_body: post.caption,
        hashtags: post.hashtags,
        target_platform: post.platform === "instagram" ? "instagram_reels" : post.platform === "facebook" ? "facebook_reels" : post.platform,
        thumbnail_idea: post.image_prompt,
        status: "scripted",
      });
    }

    return NextResponse.json({ success: true, posts: Array.isArray(posts) ? posts : [], count: Array.isArray(posts) ? posts.length : 0 });
  } catch {
    return NextResponse.json({ success: true, posts: [], raw: text });
  }
}
