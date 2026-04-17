import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface OptimizeTitleInput {
  title: string;
  niche?: string;
  context?: string;
}

interface TitleVariant {
  text: string;
  score: number;
  reason: string;
}

interface OptimizeTitleOutput {
  variants: TitleVariant[];
}

const SYSTEM_PROMPT = `You are an elite YouTube title optimization specialist who has studied millions of thumbnails and titles from top creators (MrBeast, MKBHD, Veritasium, Ali Abdaal). Your job is to rewrite raw titles into 5 clickthrough-optimized variants, ranked by predicted CTR.

CORE GUIDELINES
- Use curiosity gap ("The X that changes everything", "Nobody told me...", "I tried X and...")
- Use specific numbers when possible ("7 ways", "in 24 hours", "$100,000")
- Apply emotional triggers: surprise, fear, aspiration, urgency, pride, FOMO
- DO NOT overpromise or clickbait — the title must deliver what the video delivers
- Keep EVERY variant under 70 characters (YouTube truncates beyond this)
- Use power words: "secret", "truth", "nobody", "finally", "actually", "real"
- Prefer strong specific nouns over adjectives
- Use title case unless all caps adds punch
- One variant should be a question, one should use a number, one should invoke curiosity, one should be emotional, one should be clean/benefit-led

OUTPUT FORMAT
Respond with ONLY raw JSON — no markdown fences, no commentary — matching:
{
  "variants": [
    {
      "text": "<rewritten title under 70 chars>",
      "score": <integer 1-100, predicted CTR relative score>,
      "reason": "<one sentence: which psychological lever this pulls>"
    }
  ]
}

Return exactly 5 variants ordered by score descending.`;

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: OptimizeTitleInput;
  try {
    body = (await request.json()) as OptimizeTitleInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  const userPrompt = `Optimize this YouTube title into 5 high-CTR variants.

RAW TITLE: ${body.title}
NICHE: ${body.niche ?? "general"}
CONTEXT: ${body.context ?? "none provided"}

Return JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<OptimizeTitleOutput>(text);

    if (!parsed || !Array.isArray(parsed.variants)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const variants: TitleVariant[] = parsed.variants
      .filter(
        (v): v is TitleVariant =>
          !!v &&
          typeof v.text === "string" &&
          typeof v.score === "number" &&
          typeof v.reason === "string"
      )
      .map((v) => ({
        text: v.text.slice(0, 80),
        score: Math.max(1, Math.min(100, Math.round(v.score))),
        reason: v.reason,
      }));

    // Fire-and-forget usage log
    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_thumbnail_optimize_title",
      description: `Optimized title: ${body.title.slice(0, 80)}`,
      profile_id: user.id,
      status: "completed",
      result: {
        input_title: body.title,
        variant_count: variants.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[thumbnail/optimize-title] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to optimize title", detail: message },
      { status: 500 }
    );
  }
}
