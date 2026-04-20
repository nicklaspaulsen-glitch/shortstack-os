import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  coerceMotionLevel,
  coerceSceneType,
  type Scene,
  type SceneType,
} from "@/lib/auto-edit-types";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/video/auto-edit/detect-scenes
 *
 * Detects scenes in an uploaded clip by running Claude Sonnet Vision on
 * frame samples taken at regular intervals. For each sample we classify
 * scene type + motion level + energy + dominant colors, then collapse
 * consecutive identical classifications into contiguous scenes.
 *
 * Token cost: 2 tokens (Sonnet Vision — scene detection is more expensive
 * than the single-frame classify-footage call because it samples several
 * frames per clip).
 *
 * Caveat on frame extraction (same as classify-footage): Claude Vision
 * accepts IMAGE inputs only. The caller should pass a `video_url` that
 * points to a frame still — or, when the URL is an MP4, pass a pre-
 * extracted thumbnail. The route accepts a single frame URL today and
 * returns a minimal one-scene result. `min_scene_duration_sec` is honoured
 * when the caller later passes multiple pre-extracted frames (the route
 * supports `frame_urls[]` for forward-compat).
 */

export const maxDuration = 60;

interface DetectScenesInput {
  video_url?: string;
  /** Optional pre-extracted frame URLs (with approximate timestamps) for
   *  callers that have already run ffmpeg client-side. Each frame is
   *  evaluated by Claude Vision and the results are merged into scenes. */
  frame_samples?: Array<{ url: string; at_sec: number }>;
  client_id?: string;
  min_scene_duration_sec?: number;
  /** Total clip duration. Required when passing `frame_samples` so we can
   *  compute scene end_sec values. Ignored otherwise. */
  total_duration_sec?: number;
}

interface FrameClassification {
  at_sec: number;
  scene_type: SceneType;
  motion_level: Scene["motion_level"];
  energy: number;
  dominant_colors: string[];
  suggested_sfx_category?: string;
  suggested_transition?: string;
}

const SYSTEM_PROMPT = `You are a professional video editor scoring individual frames sampled from a short-form clip. For EACH frame, you must return a strict JSON classification that downstream tooling uses to decide which scene-level SFX, transitions, and effects to apply.

FIELDS
- scene_type: one of "talking_head" | "action" | "b_roll" | "product" | "text_slide" | "transition"
- motion_level: "low" | "medium" | "high"
- energy: integer 0..100 — how visually kinetic the frame feels (fast camera, many cuts, loud colours, lots of action)
- dominant_colors: 2-3 CSS hex strings (e.g. "#1a2b3c")
- suggested_sfx_category: optional — one of "impact" | "whoosh" | "pop" | "swoosh" | "hit" | "ui" | "ambient" | "comedy" | "cinematic" | "meme" | "riser"
- suggested_transition: optional — transition ID like "tr_cut_flash", "tr_zoom_punch", "tr_fade_cross", "tr_whip_left", "tr_glitch_basic"

OUTPUT — respond with ONLY raw JSON:
{"scene_type":"...","motion_level":"...","energy":0,"dominant_colors":["#...","#..."],"suggested_sfx_category":"...","suggested_transition":"..."}

No markdown fences. No commentary.`;

function normalizeMediaType(
  mt: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mt.includes("png")) return "image/png";
  if (mt.includes("gif")) return "image/gif";
  if (mt.includes("webp")) return "image/webp";
  return "image/jpeg";
}

async function downloadAsBase64(
  url: string,
): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch frame (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (contentType.startsWith("video/")) {
    throw new Error(
      "video/* MIME received — Claude Vision needs image stills; extract frames client-side or pass thumbnail URLs in frame_samples[].",
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: contentType };
}

function coerceHexArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => /^#[0-9a-f]{3,8}$/i.test(v))
    .slice(0, 4);
}

async function classifyFrame(
  frameUrl: string,
  atSec: number,
): Promise<{ classification: FrameClassification; usage: { input: number; output: number } }> {
  const { data, mediaType } = await downloadAsBase64(frameUrl);
  const imageSource: Anthropic.ImageBlockParam["source"] = {
    type: "base64",
    media_type: normalizeMediaType(mediaType),
    data,
  };

  const resp = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: imageSource },
          {
            type: "text",
            text: `Frame timestamp: ${atSec.toFixed(2)}s. Classify this frame. JSON only.`,
          },
        ],
      },
    ],
  });

  const parsed = safeJsonParse<Partial<FrameClassification>>(getResponseText(resp));
  const classification: FrameClassification = {
    at_sec: atSec,
    scene_type: coerceSceneType(parsed?.scene_type),
    motion_level: coerceMotionLevel(parsed?.motion_level),
    energy:
      typeof parsed?.energy === "number" && Number.isFinite(parsed.energy)
        ? Math.max(0, Math.min(100, Math.round(parsed.energy)))
        : 50,
    dominant_colors: coerceHexArray(parsed?.dominant_colors),
    suggested_sfx_category:
      typeof parsed?.suggested_sfx_category === "string"
        ? parsed.suggested_sfx_category.trim()
        : undefined,
    suggested_transition:
      typeof parsed?.suggested_transition === "string"
        ? parsed.suggested_transition.trim()
        : undefined,
  };

  return {
    classification,
    usage: {
      input: resp.usage?.input_tokens || 0,
      output: resp.usage?.output_tokens || 0,
    },
  };
}

/**
 * Collapse per-frame classifications into scene ranges. Frames with the same
 * scene_type that happen back-to-back are merged into a single scene. Any
 * scene shorter than `minDur` is merged into the neighbour that matches most
 * closely (or the previous scene when neither side matches).
 */
function framesToScenes(
  frames: FrameClassification[],
  totalDuration: number,
  minDur: number,
): Scene[] {
  if (frames.length === 0) {
    return [
      {
        start_sec: 0,
        end_sec: totalDuration,
        scene_type: "b_roll",
        motion_level: "medium",
        energy: 50,
        dominant_colors: [],
      },
    ];
  }

  // sort by timestamp
  const sorted = [...frames].sort((a, b) => a.at_sec - b.at_sec);

  // Group contiguous same-type frames into scenes.
  const raw: Scene[] = [];
  let cursorStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const endSec = next ? next.at_sec : totalDuration;
    if (raw.length > 0 && raw[raw.length - 1].scene_type === cur.scene_type) {
      // Extend the previous scene, averaging energy & merging colors.
      const prev = raw[raw.length - 1];
      prev.end_sec = endSec;
      prev.energy = Math.round((prev.energy + cur.energy) / 2);
      prev.motion_level =
        cur.motion_level === "high" || prev.motion_level === "high"
          ? "high"
          : cur.motion_level === "medium" || prev.motion_level === "medium"
            ? "medium"
            : "low";
      const merged = new Set([...prev.dominant_colors, ...cur.dominant_colors]);
      prev.dominant_colors = Array.from(merged).slice(0, 4);
      if (cur.suggested_sfx_category && !prev.suggested_sfx_category) {
        prev.suggested_sfx_category = cur.suggested_sfx_category;
      }
      if (cur.suggested_transition && !prev.suggested_transition) {
        prev.suggested_transition = cur.suggested_transition;
      }
    } else {
      raw.push({
        start_sec: cursorStart,
        end_sec: endSec,
        scene_type: cur.scene_type,
        motion_level: cur.motion_level,
        energy: cur.energy,
        dominant_colors: cur.dominant_colors,
        suggested_sfx_category: cur.suggested_sfx_category,
        suggested_transition: cur.suggested_transition,
      });
      cursorStart = endSec;
    }
  }

  // Merge too-short scenes into their neighbours.
  if (minDur <= 0) return raw;
  const merged: Scene[] = [];
  for (const s of raw) {
    const dur = s.end_sec - s.start_sec;
    if (dur < minDur && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.end_sec = s.end_sec;
      prev.energy = Math.round((prev.energy + s.energy) / 2);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 },
    );
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  const limit = await checkLimit(ownerId, "tokens", 2);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
        current: limit.current,
        limit: limit.limit,
      },
      { status: 429 },
    );
  }

  let body: DetectScenesInput;
  try {
    body = (await request.json()) as DetectScenesInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : "";
  const frameSamples = Array.isArray(body.frame_samples) ? body.frame_samples : [];
  if (!videoUrl && frameSamples.length === 0) {
    return NextResponse.json(
      { ok: false, error: "video_url or frame_samples[] is required." },
      { status: 400 },
    );
  }

  const minDur =
    typeof body.min_scene_duration_sec === "number" && body.min_scene_duration_sec > 0
      ? Math.min(30, body.min_scene_duration_sec)
      : 0.8;

  // Build the list of frames to classify. Single-URL callers get one frame at t=0;
  // frame_samples callers get whatever they passed (clamped to 6 to keep cost sane).
  const framesInput: Array<{ url: string; at_sec: number }> =
    frameSamples.length > 0
      ? frameSamples
          .filter((f): f is { url: string; at_sec: number } =>
            !!f && typeof f.url === "string" && typeof f.at_sec === "number",
          )
          .slice(0, 6)
      : [{ url: videoUrl, at_sec: 0 }];

  if (framesInput.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid frame_samples provided." },
      { status: 400 },
    );
  }

  const totalDuration =
    typeof body.total_duration_sec === "number" && body.total_duration_sec > 0
      ? body.total_duration_sec
      : Math.max(...framesInput.map((f) => f.at_sec), 0) + 5; // pad 5s when unknown

  try {
    const classifications: FrameClassification[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Run classifications in parallel but cap concurrency by chunking to 3.
    for (let i = 0; i < framesInput.length; i += 3) {
      const batch = framesInput.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((f) =>
          classifyFrame(f.url, f.at_sec).catch((err) => {
            console.error("[detect-scenes] frame failed", err);
            return null;
          }),
        ),
      );
      for (const r of results) {
        if (!r) continue;
        classifications.push(r.classification);
        totalInputTokens += r.usage.input;
        totalOutputTokens += r.usage.output;
      }
    }

    if (classifications.length === 0) {
      return NextResponse.json(
        { ok: false, error: "All frame classifications failed. Ensure the URLs return images." },
        { status: 502 },
      );
    }

    const scenes = framesToScenes(classifications, totalDuration, minDur);
    const avg =
      scenes.reduce((s, sc) => s + (sc.end_sec - sc.start_sec), 0) /
      Math.max(1, scenes.length);

    const tokensUsed = totalInputTokens + totalOutputTokens;
    void recordUsage(ownerId, "tokens", tokensUsed || 2500, {
      source: "auto_edit_detect_scenes",
      frame_count: classifications.length,
      scene_count: scenes.length,
    });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_auto_edit_detect_scenes",
      description: `Detected ${scenes.length} scenes from ${classifications.length} frames`,
      profile_id: user.id,
      status: "completed",
      result: {
        scene_count: scenes.length,
        avg_scene_length_sec: avg,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      scenes,
      total_scenes: scenes.length,
      avg_scene_length_sec: Math.round(avg * 100) / 100,
      model: MODEL_SONNET,
    });
  } catch (err) {
    console.error("[video/auto-edit/detect-scenes] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "Failed to detect scenes", detail: message },
      { status: 500 },
    );
  }
}
