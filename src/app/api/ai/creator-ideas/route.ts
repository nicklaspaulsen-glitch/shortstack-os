import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { getCreatorStyle } from "@/lib/ai/creator-styles";
import type { Platform, PageContext } from "@/lib/ai/creator-styles";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    topic,
    creator_id,
    platform,
    page_context,
    count = 5,
  } = (await req.json()) as {
    topic?: string;
    creator_id?: string;
    platform?: Platform;
    page_context?: PageContext;
    count?: number;
  };

  if (!topic?.trim())
    return NextResponse.json({ error: "Topic required" }, { status: 400 });
  if (!creator_id)
    return NextResponse.json({ error: "Creator ID required" }, { status: 400 });

  const creator = getCreatorStyle(creator_id);
  if (!creator)
    return NextResponse.json({ error: "Unknown creator style" }, { status: 400 });

  const ideaCount = Math.min(Math.max(count, 1), 6);
  const hookExamples = creator.hookFormulas
    .map((f) => `- "${f.replace(/\{\{topic\}\}/g, topic)}"`)
    .join("\n");
  const contextHint = creator.promptHints[page_context ?? "ai-video"] ?? "";

  const result = await callLLMTraced({
    surface: "creator-ideas",
    taskType: "complex_analysis",
    humanize: false,
    systemPrompt: `You are a viral content strategist who deeply understands the "${creator.name}" creator archetype: ${creator.tone}.

Style DNA:
- Pacing: ${creator.pacing}
- Viral ingredients: ${creator.viralIngredients.join(", ")}
- Thumbnail DNA: ${creator.thumbnailDNA}
- CTR benchmark: ${creator.ctrRange}
- Best formats: ${creator.contentFormats.join(", ")}
${contextHint ? `\nContext-specific guidance: ${contextHint}` : ""}

Proven hook formulas already customised for this topic:
${hookExamples}

Return a JSON array (no preamble, no markdown fences) of exactly ${ideaCount} ideas.
Each idea object must contain these exact fields:
{
  "title": "<content title 8-12 words that makes people stop scrolling>",
  "hook": "<opening hook — first 1-2 sentences the creator would say/show, max 25 words, punchy>",
  "angle": "<the unique twist that separates this idea from generic content on this topic, 10-15 words>",
  "thumbnail_concept": "<describe thumbnail: composition, dominant emotion, text overlay (max 5 words), color mood>",
  "caption": "<social caption with 1-2 relevant emojis, conversational, max 40 words>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"]
}

Rules:
- Each idea must be meaningfully different from the others (different angle, not just different wording)
- Write in the authentic voice and register of "${creator.name}"
- Every hook must be platform-ready — no generic phrases like "in this video" or "today we discuss"
- Return only a valid JSON array, nothing else`,
    userPrompt: `Topic: "${topic}"
Platform: ${platform ?? "youtube"}
Page context: ${page_context ?? "ai-video"}
Generate ${ideaCount} viral ideas.`,
    maxTokens: 1600,
  });

  try {
    const cleaned = result.text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const ideas = JSON.parse(cleaned) as Array<{
      title: string;
      hook: string;
      angle: string;
      thumbnail_concept: string;
      caption: string;
      hashtags: string[];
    }>;
    return NextResponse.json({ ideas, creator });
  } catch {
    return NextResponse.json(
      { error: "Invalid model response", raw: result.text },
      { status: 502 },
    );
  }
}
