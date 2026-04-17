import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface CaptionsGenerateInput {
  text: string;
  max_words_per_caption: number;
  duration_seconds: number;
  emphasize_keywords: boolean;
}

interface Caption {
  start: number;
  end: number;
  text: string;
  emphasized_word_indices: number[];
}

interface CaptionsGenerateOutput {
  captions: Caption[];
  total_duration: number;
}

const SYSTEM_PROMPT = `You are a caption timing expert optimized for short-form video (TikTok, Reels, Shorts, YouTube). You break narration text into punchy caption chunks, time them for comfortable reading, and mark the most emphasis-worthy words in each chunk.

TIMING PRINCIPLES
- Average reading speed: ~3 words per second for captions (slightly faster for short words)
- Each chunk should stay on screen AT LEAST 0.8 seconds and AT MOST 4 seconds
- Chunks should break at natural linguistic boundaries (clauses, phrases) — never mid-phrase
- Respect the max_words_per_caption hard cap
- The LAST caption's end time must equal the total duration_seconds
- Timings must be strictly monotonically increasing (no overlapping, no gaps greater than 0.1s)

EMPHASIS RULES (when emphasize_keywords is true)
- Mark 0-2 emphasized word INDICES per caption (0-based indexing within the caption's words)
- Emphasis targets: nouns that name the subject, numbers, superlatives, power words, surprising terms
- Never emphasize stop-words ("the", "and", "of", "a", "to")

OUTPUT FORMAT
Respond with ONLY raw JSON matching:
{
  "captions": [
    { "start": 0.0, "end": 1.5, "text": "...", "emphasized_word_indices": [0, 2] }
  ],
  "total_duration": <same as input duration_seconds>
}

No markdown fences. No commentary. Just JSON.`;

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

  let body: CaptionsGenerateInput;
  try {
    body = (await request.json()) as CaptionsGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const duration = Number(body.duration_seconds);
  if (!duration || duration <= 0) {
    return NextResponse.json(
      { error: "duration_seconds must be positive" },
      { status: 400 }
    );
  }
  const maxWords = Math.max(1, Math.min(12, Number(body.max_words_per_caption) || 4));

  const userPrompt = `Generate timed captions for this narration.

NARRATION:
"""
${body.text}
"""

TOTAL DURATION: ${duration} seconds
MAX WORDS PER CAPTION: ${maxWords}
EMPHASIZE KEYWORDS: ${body.emphasize_keywords ? "yes" : "no"}

JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 4096,
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
    const parsed = safeJsonParse<CaptionsGenerateOutput>(text);

    if (!parsed || !Array.isArray(parsed.captions)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const captions: Caption[] = parsed.captions
      .filter(
        (c): c is Caption =>
          !!c &&
          typeof c.start === "number" &&
          typeof c.end === "number" &&
          typeof c.text === "string"
      )
      .map((c) => ({
        start: Math.max(0, c.start),
        end: Math.max(c.start, c.end),
        text: c.text.trim(),
        emphasized_word_indices: Array.isArray(c.emphasized_word_indices)
          ? c.emphasized_word_indices
              .filter((i): i is number => typeof i === "number")
              .map((i) => Math.floor(i))
          : [],
      }));

    const out: CaptionsGenerateOutput = {
      captions,
      total_duration:
        typeof parsed.total_duration === "number" ? parsed.total_duration : duration,
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_captions_generate",
      description: `Generated ${captions.length} captions (${duration}s)`,
      profile_id: user.id,
      status: "completed",
      result: {
        caption_count: captions.length,
        duration_seconds: duration,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[video/captions-generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate captions", detail: message },
      { status: 500 }
    );
  }
}
