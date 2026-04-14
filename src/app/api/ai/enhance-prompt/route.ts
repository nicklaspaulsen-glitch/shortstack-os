import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPTS: Record<string, string> = {
  thumbnail: `You are a world-class thumbnail designer. Take the user's rough description and transform it into a vivid, specific visual prompt optimized for AI image generation. Include:
- Exact composition (close-up, split-screen, etc.)
- Lighting (dramatic rim light, neon glow, etc.)
- Color scheme and mood
- Text placement and style
- Facial expressions if relevant
- Background details
Keep it under 200 words. Be specific and visual.`,

  design: `You are a professional graphic designer. Take the user's rough description and create a polished design brief. Include:
- Visual style (minimalist, bold, luxury, etc.)
- Color palette suggestions
- Typography recommendations
- Layout structure
- Brand-appropriate elements
Keep it under 200 words. Be specific and actionable.`,

  video: `You are a video production expert. Take the user's rough description and create a detailed video prompt. Include:
- Camera movements (zoom, pan, tracking)
- Transitions and effects
- Pacing and timing
- Color grading style
- Audio/music mood
- Key visual moments
Keep it under 200 words. Be cinematic and specific.`,

  content: `You are a top-tier copywriter. Take the user's rough text and improve it with:
- Stronger hooks and opening lines
- Better structure and flow
- Clear calls-to-action
- Emotional triggers and power words
- Platform-appropriate tone
Keep the same intent but make it 10x more compelling.`,

  general: `You are an AI prompt engineer. Take the user's rough description and enhance it to be more detailed, specific, and effective for AI processing. Keep the original intent but add precision, context, and clarity.`,
};

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text, type = "general" } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Enhance this description:\n\n"${text}"\n\nReturn a JSON object with:\n- "enhanced": the improved version (string)\n- "suggestions": array of 3 alternative variations (strings)\n\nReturn ONLY valid JSON, no markdown.`,
        },
      ],
    });

    const content = res.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    // Parse JSON from response — handle potential markdown wrapping
    let parsed;
    try {
      const cleaned = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: use the raw text as enhanced
      parsed = { enhanced: content.text.trim(), suggestions: [] };
    }

    return NextResponse.json({
      enhanced: parsed.enhanced || content.text.trim(),
      suggestions: parsed.suggestions || [],
    });
  } catch (err) {
    console.error("[enhance-prompt] Error:", err);
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
