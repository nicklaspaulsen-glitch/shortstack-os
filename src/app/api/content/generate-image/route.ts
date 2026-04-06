import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Image Generator — uses OpenAI DALL-E for thumbnails, ads, social graphics
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, size, style } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "OpenAI not configured. Add OPENAI_API_KEY to use AI image generation." }, { status: 500 });

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Professional marketing image: ${prompt}. Style: ${style || "modern, clean, high-quality"}. No text in the image.`,
        n: 1,
        size: size || "1024x1024",
        quality: "standard",
      }),
    });

    const data = await res.json();

    if (data.data?.[0]?.url) {
      return NextResponse.json({
        success: true,
        image_url: data.data[0].url,
        revised_prompt: data.data[0].revised_prompt,
      });
    }

    return NextResponse.json({ error: data.error?.message || "Failed to generate image" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
