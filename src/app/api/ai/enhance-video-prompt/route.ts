import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, style } = (await req.json()) as {
    prompt?: string;
    style?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  const result = await callLLMTraced({
    surface: "video-prompt-enhance",
    taskType: "polish_copy",
    humanize: false,
    systemPrompt: `You are a professional cinematographer and AI video director. Your job is to expand a simple video prompt into a rich, cinematic description under 120 words. Add specific camera movements (pan, dolly, crane shot, etc.), lighting details, mood, atmosphere, and texture. Keep it vivid but concise. Style context: ${style ?? "cinematic"}. Return ONLY the enhanced prompt text — no preamble, no quotes, no labels.`,
    userPrompt: `Enhance this video prompt: "${prompt}"`,
    maxTokens: 300,
  });

  return NextResponse.json({ enhanced: result.text });
}
