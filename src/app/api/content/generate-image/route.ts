import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// Midjourney Prompt Generator — creates optimized prompts for Midjourney
// Users copy the prompt and paste into Discord
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { description, type, aspect_ratio, style } = await request.json();
  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const typeMap: Record<string, string> = {
    thumbnail: "YouTube/social media thumbnail, bold, eye-catching, high contrast",
    ad: "paid advertisement, professional, conversion-focused, clean layout",
    social_post: "social media graphic, trendy, engaging, modern design",
    logo: "brand logo, minimal, scalable, professional",
    banner: "website banner, wide format, hero image, premium feel",
    product: "product photography, studio lighting, clean background",
  };

  const arMap: Record<string, string> = {
    "1:1": "--ar 1:1",
    "16:9": "--ar 16:9",
    "9:16": "--ar 9:16",
    "4:5": "--ar 4:5",
    "3:2": "--ar 3:2",
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Generate 3 Midjourney prompts for: "${description}"
Type: ${typeMap[type] || type || "professional marketing image"}
Style: ${style || "modern, clean, high-quality"}

Return JSON: {"prompts": [{"prompt": "/imagine prompt: [detailed MJ prompt] ${arMap[aspect_ratio] || "--ar 1:1"} --v 6 --style raw", "description": "what this will generate"}]}

Make prompts detailed with: subject, lighting, composition, mood, colors. Use Midjourney-specific terms.`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
