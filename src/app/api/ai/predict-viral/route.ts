import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, style, aspect_ratio, face_swap } = (await req.json()) as {
    prompt?: string;
    style?: string;
    aspect_ratio?: string;
    face_swap?: boolean;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  const result = await callLLMTraced({
    surface: "viral-prediction",
    taskType: "complex_analysis",
    humanize: false,
    systemPrompt: `You are a viral content strategist specializing in short-form video CTR optimization.
Analyze the given video prompt and return a JSON object (no preamble, no markdown fences) with these exact fields:
{
  "viral_score": <integer 0-100>,
  "ctr_estimate": "<string like '4.2%'>",
  "strengths": ["<short phrase>", "<short phrase>", "<short phrase>"],
  "suggestions": ["<actionable improvement>", "<actionable improvement>", "<actionable improvement>"]
}

Scoring criteria:
- Emotional hook in first 3 seconds: +20 pts
- Faces or human subjects visible: +15 pts
- Face-swap / personalisation: +10 pts
- Vertical 9:16 format (TikTok/Reels): +8 pts
- High-contrast visuals implied: +7 pts
- Trending style (anime, dreamy): +5 pts
- Clear action or motion: +5 pts
- Unique/unexpected concept: +10 pts
- Generic/vague prompt: -15 pts
Max score = 100. Return only valid JSON.`,
    userPrompt: `Video prompt: "${prompt}"
Style: ${style ?? "cinematic"}
Aspect ratio: ${aspect_ratio ?? "9:16"}
Face-swap mode: ${face_swap ? "yes" : "no"}`,
    maxTokens: 400,
  });

  try {
    // Strip any accidental markdown fences the model may have added
    const cleaned = result.text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      viral_score: number;
      ctr_estimate: string;
      strengths: string[];
      suggestions: string[];
    };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Invalid model response", raw: result.text },
      { status: 502 },
    );
  }
}
