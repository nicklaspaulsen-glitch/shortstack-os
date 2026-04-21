import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { limitsForTier, normalizePlanTier } from "@/lib/plan-limits";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface ScriptGenerateInput {
  topic: string;
  duration_seconds: number;
  niche?: string;
  style_preset?: string;
  target_audience?: string;
  call_to_action?: string;
}

interface Scene {
  timestamp_start: number;
  timestamp_end: number;
  narration: string;
  visual_description: string;
  b_roll_suggestions: string[];
}

interface ScriptGenerateOutput {
  hook: string;
  script: string;
  scenes: Scene[];
  captions_keywords: string[];
  cta: string;
}

const SYSTEM_PROMPT = `You are an elite YouTube script writer who has generated billions of views for top creators across MrBeast, Veritasium, Ali Abdaal, and Mark Rober channels. Your scripts are engineered for RETENTION — you know that 70% of viewers drop off in the first 30 seconds if the hook fails.

SCRIPT PRINCIPLES
1. Hook in the first 3 seconds — open with a pattern interrupt, a question, or a bold claim.
2. State the promise: what will the viewer learn/gain by watching?
3. Bucket brigades: "But here's where it gets crazy...", "Wait until you see...", "And that's not all..."
4. Every 15-20 seconds, inject curiosity or tension to reset attention
5. Visual variety — alternate between A-roll (speaker), B-roll (supporting footage), text overlays
6. Pacing: short sentences, active verbs, conversational tone
7. End with a clear CTA and forward-reference to what to watch next

SCENE STRUCTURE
Break the script into scenes. Each scene has:
- timestamp_start / timestamp_end in seconds (must sum to total duration)
- narration: the exact words to read
- visual_description: what is on screen during this narration
- b_roll_suggestions: 2-3 specific searchable stock footage queries

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary) matching:
{
  "hook": "<first 3-5 seconds of spoken content, designed to stop the scroll>",
  "script": "<full script as plain text, written as if spoken aloud>",
  "scenes": [
    {
      "timestamp_start": 0,
      "timestamp_end": 5,
      "narration": "<exact words>",
      "visual_description": "<what's on screen>",
      "b_roll_suggestions": ["<stock footage query 1>", "<query 2>"]
    }
  ],
  "captions_keywords": ["<emphasis word 1>", "<word 2>", ...],
  "cta": "<specific call to action at the end>"
}

Scene breakdown rules:
- Short-form (<30s): 2-4 scenes
- Mid-form (30-120s): 4-8 scenes
- Long-form (>120s): 8-15 scenes
- Scene durations can vary between 4-20 seconds

captions_keywords: 8-15 high-impact words from the script that deserve emphasis in on-screen captions.`;

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

  let body: ScriptGenerateInput;
  try {
    body = (await request.json()) as ScriptGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const duration = Number(body.duration_seconds);
  if (!duration || duration <= 0) {
    return NextResponse.json(
      { error: "duration_seconds must be a positive number" },
      { status: 400 }
    );
  }

  // ── Tier-based video length cap (per-render ceiling, not monthly) ──
  // Shape matches other 402 responses ({ current, limit, plan_tier }).
  const planTierKey = normalizePlanTier(profile?.plan_tier as string | null | undefined);
  const { max_video_seconds: maxVideoSeconds } = limitsForTier(planTierKey);
  if (Number.isFinite(maxVideoSeconds) && duration > maxVideoSeconds) {
    return NextResponse.json(
      {
        success: false,
        error: `Video length ${duration}s exceeds ${planTierKey} plan cap (${maxVideoSeconds}s). Upgrade to continue.`,
        resource: "video_seconds",
        current: duration,
        limit: maxVideoSeconds,
        plan_tier: planTierKey,
        remaining: 0,
      },
      { status: 402 },
    );
  }

  const userPrompt = `Write a YouTube video script.

TOPIC: ${body.topic}
TOTAL DURATION: ${duration} seconds
NICHE: ${body.niche ?? "general"}
STYLE PRESET: ${body.style_preset ?? "modern / punchy"}
TARGET AUDIENCE: ${body.target_audience ?? "general YouTube viewers"}
CALL TO ACTION: ${body.call_to_action ?? "like, subscribe, and hit the bell"}

Tight, engaging, retention-optimized. JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
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
    const parsed = safeJsonParse<ScriptGenerateOutput>(text);

    if (!parsed || typeof parsed.script !== "string" || !Array.isArray(parsed.scenes)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const scenes: Scene[] = parsed.scenes
      .filter(
        (s): s is Scene =>
          !!s &&
          typeof s.timestamp_start === "number" &&
          typeof s.timestamp_end === "number" &&
          typeof s.narration === "string" &&
          typeof s.visual_description === "string"
      )
      .map((s) => ({
        timestamp_start: Math.max(0, s.timestamp_start),
        timestamp_end: Math.max(s.timestamp_start, s.timestamp_end),
        narration: s.narration,
        visual_description: s.visual_description,
        b_roll_suggestions: Array.isArray(s.b_roll_suggestions)
          ? s.b_roll_suggestions.slice(0, 5)
          : [],
      }));

    const out: ScriptGenerateOutput = {
      hook: parsed.hook || "",
      script: parsed.script,
      scenes,
      captions_keywords: Array.isArray(parsed.captions_keywords)
        ? parsed.captions_keywords.slice(0, 30)
        : [],
      cta: parsed.cta || body.call_to_action || "",
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_script_generate",
      description: `Script: ${body.topic.slice(0, 80)} (${duration}s)`,
      profile_id: user.id,
      status: "completed",
      result: {
        topic: body.topic,
        duration_seconds: duration,
        scene_count: out.scenes.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[video/script-generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate script", detail: message },
      { status: 500 }
    );
  }
}
