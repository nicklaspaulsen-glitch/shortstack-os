import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import crypto from "crypto";
import {
  anthropic,
  MODEL_SONNET,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface GenerateProjectInput {
  topic: string;
  duration_seconds: number;
  style_preset?: string;
  niche?: string;
}

interface Scene {
  timestamp_start: number;
  timestamp_end: number;
  narration: string;
  visual_description: string;
  b_roll_suggestions: string[];
}

interface ScriptOutput {
  hook: string;
  script: string;
  scenes: Scene[];
  captions_keywords: string[];
  cta: string;
}

interface Caption {
  start: number;
  end: number;
  text: string;
  emphasized_word_indices: number[];
}

interface CaptionsOutput {
  captions: Caption[];
  total_duration: number;
}

type ShotType = "a_roll" | "b_roll" | "text_overlay" | "transition";

interface Shot {
  shot_number: number;
  description: string;
  type: ShotType;
  duration: number;
  search_query: string;
}

interface ShotListOutput {
  shots: Shot[];
}

interface EditorSettings {
  captions: {
    enabled: boolean;
    preset: string;
    maxWordsPerLine: number;
    emphasizeKeywords: boolean;
  };
  aspect: { preset: string };
  color: { enabled: boolean; lut: string };
  audio: { enabled: boolean; bgGenre: string };
  motion: { enabled: boolean; preset: string };
}

interface GenerateProjectOutput {
  project_id: string;
  script: ScriptOutput;
  captions: CaptionsOutput;
  shotlist: ShotListOutput;
  editor_settings: EditorSettings;
  estimated_render_cost: number;
}

/* ──────────────────── System prompts ──────────────────── */

const SCRIPT_SYSTEM_PROMPT = `You are an elite YouTube script writer engineered for RETENTION. Output scripts with scene breakdown, hooks, and CTAs.

Return ONLY raw JSON matching:
{
  "hook": "<3-5s pattern interrupt>",
  "script": "<full spoken script>",
  "scenes": [{ "timestamp_start": 0, "timestamp_end": 5, "narration": "...", "visual_description": "...", "b_roll_suggestions": ["..."] }],
  "captions_keywords": ["word1","word2"],
  "cta": "<final CTA>"
}
Scene durations must sum to the total duration. No markdown. JSON only.`;

const CAPTIONS_SYSTEM_PROMPT = `You are a caption timing expert. Break narration into punchy chunks (3-4 words each), time them for comfortable reading (~3 wps), mark emphasis word indices.

Return ONLY raw JSON:
{
  "captions": [{ "start": 0.0, "end": 1.2, "text": "...", "emphasized_word_indices": [0] }],
  "total_duration": <seconds>
}
Last caption end must equal duration. No markdown. JSON only.`;

const SHOTLIST_SYSTEM_PROMPT = `You are a senior video editor storyboarding production-ready shot lists. Shot types: a_roll | b_roll | text_overlay | transition.

Return ONLY raw JSON:
{
  "shots": [{ "shot_number": 1, "description": "...", "type": "a_roll", "duration": 3.5, "search_query": "..." }]
}
Durations sum to total duration. No markdown. JSON only.`;

/* ──────────────────── Helpers ──────────────────── */

async function generateScript(input: GenerateProjectInput): Promise<ScriptOutput> {
  const userPrompt = `Write a YouTube script.
TOPIC: ${input.topic}
DURATION: ${input.duration_seconds}s
NICHE: ${input.niche ?? "general"}
STYLE: ${input.style_preset ?? "modern punchy"}
JSON only.`;

  const response = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4096,
    system: [
      { type: "text", text: SCRIPT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsed = safeJsonParse<ScriptOutput>(getResponseText(response));
  if (!parsed || typeof parsed.script !== "string" || !Array.isArray(parsed.scenes)) {
    throw new Error("Script generation failed — invalid Claude response");
  }
  return {
    hook: parsed.hook || "",
    script: parsed.script,
    scenes: parsed.scenes,
    captions_keywords: Array.isArray(parsed.captions_keywords)
      ? parsed.captions_keywords.slice(0, 30)
      : [],
    cta: parsed.cta || "",
  };
}

async function generateCaptions(script: string, duration: number): Promise<CaptionsOutput> {
  const userPrompt = `Generate timed captions.
NARRATION:
"""
${script}
"""
TOTAL DURATION: ${duration}s
MAX WORDS: 4
EMPHASIZE: yes
JSON only.`;

  const response = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 4096,
    system: [
      { type: "text", text: CAPTIONS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsed = safeJsonParse<CaptionsOutput>(getResponseText(response));
  if (!parsed || !Array.isArray(parsed.captions)) {
    throw new Error("Captions generation failed — invalid Claude response");
  }
  return {
    captions: parsed.captions,
    total_duration:
      typeof parsed.total_duration === "number" ? parsed.total_duration : duration,
  };
}

async function generateShotList(
  script: string,
  duration: number,
  stylePreset: string | undefined
): Promise<ShotListOutput> {
  const userPrompt = `Storyboard this script.
SCRIPT:
"""
${script}
"""
TOTAL DURATION: ${duration}s
STYLE: ${stylePreset ?? "modern fast-paced"}
JSON only.`;

  const response = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4096,
    system: [
      { type: "text", text: SHOTLIST_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsed = safeJsonParse<ShotListOutput>(getResponseText(response));
  if (!parsed || !Array.isArray(parsed.shots)) {
    throw new Error("Shot list generation failed — invalid Claude response");
  }
  return { shots: parsed.shots };
}

function deriveEditorSettings(
  script: ScriptOutput,
  duration: number,
  stylePreset: string | undefined
): EditorSettings {
  const aspect = duration <= 60 ? "9:16" : "16:9";
  return {
    captions: {
      enabled: true,
      preset: "tiktok_bold",
      maxWordsPerLine: 4,
      emphasizeKeywords: script.captions_keywords.length > 0,
    },
    aspect: { preset: aspect },
    color: {
      enabled: true,
      lut: stylePreset?.toLowerCase().includes("cinematic") ? "cinematic" : "vibrant",
    },
    audio: { enabled: true, bgGenre: duration <= 60 ? "upbeat" : "cinematic" },
    motion: { enabled: true, preset: "slow_zoom_in" },
  };
}

function estimateRenderCost(
  script: ScriptOutput,
  shots: Shot[],
  duration: number
): number {
  // Rough heuristic in USD:
  //   $0.01 per second base render + $0.005 per b_roll shot (stock footage license est) + $0.002 per scene (compute overhead)
  const brollShots = shots.filter((s) => s.type === "b_roll").length;
  const cost = duration * 0.01 + brollShots * 0.005 + script.scenes.length * 0.002;
  return Math.round(cost * 100) / 100;
}

/* ──────────────────── Route handler ──────────────────── */

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

  let body: GenerateProjectInput;
  try {
    body = (await request.json()) as GenerateProjectInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  const duration = Number(body.duration_seconds);
  if (!duration || duration <= 0) {
    return NextResponse.json(
      { error: "duration_seconds must be positive" },
      { status: 400 }
    );
  }

  const projectId = crypto.randomUUID();

  try {
    // 1. Script
    const script = await generateScript({ ...body, duration_seconds: duration });

    // 2. Captions + 3. Shot list can run in parallel — both depend only on the script text
    const [captions, shotlist] = await Promise.all([
      generateCaptions(script.script, duration),
      generateShotList(script.script, duration, body.style_preset),
    ]);

    const editor_settings = deriveEditorSettings(script, duration, body.style_preset);
    const estimated_render_cost = estimateRenderCost(script, shotlist.shots, duration);

    // 4. Save project row (table creation handled by user migration)
    const service = createServiceClient();
    const { error: insertErr } = await service.from("video_projects").insert({
      id: projectId,
      profile_id: user.id,
      topic: body.topic,
      duration,
      script,
      captions,
      shotlist,
      editor_settings,
      status: "draft",
    });
    if (insertErr) {
      // Non-fatal: user may not have the table yet. Log + continue returning the payload.
      console.warn(
        "[video/generate-project] video_projects insert failed (missing table?)",
        insertErr.message
      );
    }

    void service.from("trinity_log").insert({
      action_type: "ai_video_generate_project",
      description: `Project: ${body.topic.slice(0, 80)} (${duration}s)`,
      profile_id: user.id,
      status: "completed",
      result: {
        project_id: projectId,
        scene_count: script.scenes.length,
        shot_count: shotlist.shots.length,
        caption_count: captions.captions.length,
        estimated_render_cost,
        generated_at: new Date().toISOString(),
      },
    });

    const out: GenerateProjectOutput = {
      project_id: projectId,
      script,
      captions,
      shotlist,
      editor_settings,
      estimated_render_cost,
    };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[video/generate-project] error", err);
    const message = err instanceof Error ? err.message : "Unknown orchestration error";
    return NextResponse.json(
      { error: "Failed to generate project", detail: message, project_id: projectId },
      { status: 500 }
    );
  }
}
