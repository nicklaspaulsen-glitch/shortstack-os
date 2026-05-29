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
import { resolveAndCheckUrl } from "@/lib/security/ssrf";
import {
  isValidScene,
  type Scene,
  type DirectorIntelligence,
} from "@/lib/auto-edit-types";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/video/auto-edit/analyze
 *
 * Second-pass "Smart Director" analysis. Takes scenes (from detect-scenes)
 * and optional frame_samples, then runs Claude Sonnet Vision to produce
 * nuanced DirectorIntelligence for each scene:
 *
 *  - Comedy detection (joke beats, punchlines, visual gags, callbacks)
 *  - Face detection + zoom recommendations (punch-in, smooth, jerky)
 *  - Speech emphasis classification (shouting, whispering, emphatic)
 *  - Emotional beats (build, peak, release, tension, surprise)
 *  - Energy shift tracking (rising, falling, spike, drop)
 *  - Key moment flagging (hero quotes, dramatic shots)
 *  - No-cut zone identification (let the moment breathe)
 *  - Dead air detection (natural pause = good cut opportunity)
 *  - Subtitle recommendation (when captions add the most value)
 *
 * This is fundamentally different from the existing /director route, which
 * operates on CLIP-level timeline review. This route operates on SCENE-level
 * deep analysis and enriches each scene with a `director` field.
 *
 * Token cost: 2 tokens (Sonnet Vision, frame-count-bounded).
 */

export const maxDuration = 90;

interface AnalyzeInput {
  scenes: unknown;
  /** Pre-extracted frame stills with timestamps. At least one per scene
   *  gives the best results; the route works without them (text-only
   *  analysis) but quality drops significantly. */
  frame_samples?: Array<{ url: string; at_sec: number }>;
  client_id?: string;
  total_duration_sec?: number;
}

// ── Director system prompt ──────────────────────────────────────────

const DIRECTOR_SYSTEM_PROMPT = `You are a world-class video director and comedy writer analyzing individual scenes from a short-form video. You have already received a basic scene classification (scene_type, motion_level, energy). Your job is the SECOND PASS — detecting nuance that a basic classifier misses.

For EACH scene you must produce a DirectorIntelligence analysis:

FIELDS (all required unless marked optional):
- has_face (bool): Is a human face prominently visible? Not just background faces — the subject's face must be a focal point.
- face_zoom_recommended (bool): Should the editor zoom into the face during this scene? True when: the speaker is making an important point, showing strong emotion, or delivering a punchline. False when: wide shot establishes context, hands/product are the focus, or the face isn't adding information.
- face_zoom_style (optional): "punch-in" (quick snap zoom, 2-4 frames), "smooth" (slow push over 0.5-1s), "jerky" (handheld shake feel). Only include when face_zoom_recommended is true.
- suggested_zoom_target (optional): Where to aim: "face", "hands", "product", "text", "wide". Default to "face" when face_zoom_recommended, but override when hands are doing something interesting or a product is being showcased.
- speech_emphasis: "normal" | "shouting" | "whispering" | "emphatic" | "monotone". Listen to visual cues — wide mouth = shouting, leaning in = whispering, animated gestures = emphatic, still body = monotone.
- is_joke_beat (bool): Is this a comedy moment? Look for: exaggerated expressions, comedic timing pauses, absurd juxtaposition, reaction faces, callback setups.
- joke_type (optional): "punchline" (the laugh moment), "setup" (building to the joke), "callback" (referencing earlier joke), "visual_gag" (physical comedy), "reaction" (face reacting to something funny). Only include when is_joke_beat is true.
- comedy_timing_sec (optional): The EXACT timestamp within the scene where the punchline/beat lands. Critical for SFX timing. Only include when is_joke_beat is true.
- subtitle_recommended (bool): Would subtitles ADD VALUE here? True when: speech is fast, accent is thick, multiple speakers overlap, key quote worth emphasizing, comedy timing depends on word precision. False when: visuals tell the story, music moment, no speech, or subtitles would clutter an emotional visual.
- subtitle_reason (optional): Brief explanation when subtitle_recommended is true.
- emotional_beat: "build" (tension/anticipation growing), "peak" (climax/payoff), "release" (relief/resolution after peak), "neutral" (steady state), "tension" (suspense/conflict), "surprise" (unexpected twist).
- energy_shift: Compared to the PREVIOUS scene — "rising" (energy going up), "falling" (energy dropping), "steady" (same level), "spike" (sudden jump), "drop" (sudden fall). First scene defaults to "steady".
- key_moment (bool): Is this a "hero moment" worth featuring? Key quote, dramatic reveal, best visual, emotional climax. A 60s clip should have 1-3 key moments max.
- key_moment_reason (optional): Why this is worth featuring.
- no_cut_zone (bool): Should the editor NOT cut during this scene? True when: speaker is mid-sentence on an important point, emotional build needs to breathe, joke setup isn't done yet, visual payoff is mid-delivery. Cutting here would kill the moment.
- dead_air_detected (bool): Is there a natural pause, silence, or "um" gap? These are GOOD — they signal natural cut points between thoughts.
- dead_air_at_sec (optional): Timestamp within the scene where the dead air starts.

CRITICAL RULES:
- Be SELECTIVE with key_moment and face_zoom — if everything is special, nothing is. Max 40% of scenes should have face_zoom_recommended=true. Max 20% should be key_moment=true.
- Comedy detection must be PRECISE. Don't flag normal speech as jokes. Look for deliberate comedic intent — timing pauses, exaggerated delivery, absurd statements, reaction cuts.
- no_cut_zone and dead_air_detected are NEVER both true for the same scene.
- energy_shift is RELATIVE to the previous scene. The first scene in the array is always "steady".
- When a face is visible but the person is reading, demonstrating, or their hands are the focus, set has_face=true but face_zoom_recommended=false and suggested_zoom_target="hands" or "product".

OUTPUT — respond with ONLY raw JSON:
{
  "director_analyses": [
    {
      "scene_index": 0,
      "has_face": true,
      "face_zoom_recommended": false,
      "speech_emphasis": "normal",
      "is_joke_beat": false,
      "subtitle_recommended": true,
      "subtitle_reason": "Fast speech with key terminology",
      "emotional_beat": "build",
      "energy_shift": "steady",
      "key_moment": false,
      "no_cut_zone": false,
      "dead_air_detected": false
    }
  ]
}

No markdown fences. No commentary.`;

// ── Helpers ─────────────────────────────────────────────────────────

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
      "video/* MIME received — pass image stills in frame_samples[], not raw video URLs.",
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: contentType };
}

/** Pick the best frame for each scene — the one closest to scene midpoint. */
function assignFramesToScenes(
  scenes: Scene[],
  frameSamples: Array<{ url: string; at_sec: number }>,
): Map<number, { url: string; at_sec: number }> {
  const assigned = new Map<number, { url: string; at_sec: number }>();
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const mid = (scene.start_sec + scene.end_sec) / 2;
    let best: { url: string; at_sec: number } | null = null;
    let bestDist = Infinity;
    for (const f of frameSamples) {
      if (f.at_sec >= scene.start_sec && f.at_sec <= scene.end_sec) {
        const dist = Math.abs(f.at_sec - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = f;
        }
      }
    }
    // Fallback: nearest frame even if outside scene bounds
    if (!best) {
      for (const f of frameSamples) {
        const dist = Math.min(
          Math.abs(f.at_sec - scene.start_sec),
          Math.abs(f.at_sec - scene.end_sec),
        );
        if (dist < bestDist) {
          bestDist = dist;
          best = f;
        }
      }
    }
    if (best) assigned.set(i, best);
  }
  return assigned;
}

function coerceDirectorIntelligence(
  raw: Record<string, unknown>,
): DirectorIntelligence {
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === "boolean" ? v : fallback;

  const str = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
    if (typeof v === "string") {
      const lower = v.trim().toLowerCase() as T;
      if ((allowed as readonly string[]).includes(lower)) return lower;
    }
    return fallback;
  };

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const optStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  return {
    has_face: bool(raw.has_face, false),
    face_zoom_recommended: bool(raw.face_zoom_recommended, false),
    face_zoom_style: str(
      raw.face_zoom_style,
      ["punch-in", "smooth", "jerky"] as const,
      "punch-in",
    ) as DirectorIntelligence["face_zoom_style"],
    suggested_zoom_target: raw.suggested_zoom_target
      ? str(
          raw.suggested_zoom_target,
          ["face", "hands", "product", "text", "wide"] as const,
          "wide",
        ) as DirectorIntelligence["suggested_zoom_target"]
      : undefined,
    speech_emphasis: str(
      raw.speech_emphasis,
      ["normal", "shouting", "whispering", "emphatic", "monotone"] as const,
      "normal",
    ),
    is_joke_beat: bool(raw.is_joke_beat, false),
    joke_type: raw.is_joke_beat
      ? str(
          raw.joke_type,
          ["punchline", "setup", "callback", "visual_gag", "reaction"] as const,
          "punchline",
        ) as DirectorIntelligence["joke_type"]
      : undefined,
    comedy_timing_sec: raw.is_joke_beat ? num(raw.comedy_timing_sec) : undefined,
    subtitle_recommended: bool(raw.subtitle_recommended, false),
    subtitle_reason: optStr(raw.subtitle_reason),
    emotional_beat: str(
      raw.emotional_beat,
      ["build", "peak", "release", "neutral", "tension", "surprise"] as const,
      "neutral",
    ),
    energy_shift: str(
      raw.energy_shift,
      ["rising", "falling", "steady", "spike", "drop"] as const,
      "steady",
    ),
    key_moment: bool(raw.key_moment, false),
    key_moment_reason: optStr(raw.key_moment_reason),
    no_cut_zone: bool(raw.no_cut_zone, false),
    dead_air_detected: bool(raw.dead_air_detected, false),
    dead_air_at_sec: num(raw.dead_air_at_sec),
  };
}

// ── Route handler ───────────────────────────────────────────────────

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

  let body: AnalyzeInput;
  try {
    body = (await request.json()) as AnalyzeInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // Parse and validate scenes
  const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
  const scenes: Scene[] = rawScenes.filter(isValidScene);
  if (scenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "scenes[] is required — call /api/video/auto-edit/detect-scenes first." },
      { status: 400 },
    );
  }

  // SSRF-check frame URLs (resolveAndCheckUrl returns error string or null for safe)
  const frameSamples: Array<{ url: string; at_sec: number }> = [];
  if (Array.isArray(body.frame_samples)) {
    for (const f of body.frame_samples) {
      if (
        f &&
        typeof f === "object" &&
        typeof (f as Record<string, unknown>).url === "string" &&
        typeof (f as Record<string, unknown>).at_sec === "number"
      ) {
        const ssrfError = await resolveAndCheckUrl((f as { url: string }).url);
        if (ssrfError === null) {
          frameSamples.push({
            url: (f as { url: string }).url,
            at_sec: (f as { at_sec: number }).at_sec,
          });
        }
      }
    }
  }

  const hasFrames = frameSamples.length > 0;
  const frameMap = hasFrames ? assignFramesToScenes(scenes, frameSamples) : new Map();

  // Build the user message with scene data + optional frames
  const scenesSummary = scenes.map((s, i) => ({
    index: i,
    start_sec: s.start_sec,
    end_sec: s.end_sec,
    duration: +(s.end_sec - s.start_sec).toFixed(2),
    scene_type: s.scene_type,
    motion_level: s.motion_level,
    energy: s.energy,
    has_frame: frameMap.has(i),
  }));

  const totalDuration =
    typeof body.total_duration_sec === "number" && body.total_duration_sec > 0
      ? body.total_duration_sec
      : scenes[scenes.length - 1].end_sec;

  // Process in batches of 4 scenes to stay within token limits
  const BATCH_SIZE = 4;
  const allAnalyses: Array<{ scene_index: number; intelligence: DirectorIntelligence }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, scenes.length);
    const batchScenes = scenesSummary.slice(batchStart, batchEnd);
    const batchIndices = batchScenes.map((s) => s.index);

    // Build content blocks: text + any frames for this batch
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    // Add frame images for scenes in this batch
    for (const idx of batchIndices) {
      const frame = frameMap.get(idx);
      if (frame) {
        try {
          const { data, mediaType } = await downloadAsBase64(frame.url);
          contentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: normalizeMediaType(mediaType),
              data,
            },
          });
          contentBlocks.push({
            type: "text",
            text: `[Frame for scene ${idx} at ${frame.at_sec.toFixed(2)}s]`,
          });
        } catch (err) {
          console.warn(`[video/auto-edit/analyze] Failed to download frame for scene ${idx}:`, err);
        }
      }
    }

    // Add scene data as final text block
    contentBlocks.push({
      type: "text",
      text: `Analyze these ${batchScenes.length} scenes (indices ${batchIndices.join(", ")}) from a ${totalDuration.toFixed(1)}s clip with ${scenes.length} total scenes.${batchStart > 0 ? ` Previous scenes had energy shifting ${batchStart > 0 ? "as described in prior context" : "from neutral"}.` : ""}

SCENES:
${JSON.stringify(batchScenes, null, 2)}

Return DirectorIntelligence for each scene. JSON only.`,
    });

    try {
      const resp = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2000,
        system: [
          {
            type: "text",
            text: DIRECTOR_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: contentBlocks }],
      });

      totalInputTokens += resp.usage?.input_tokens || 0;
      totalOutputTokens += resp.usage?.output_tokens || 0;

      const text = getResponseText(resp);
      const parsed = safeJsonParse<{ director_analyses?: unknown[] }>(text);

      if (parsed && Array.isArray(parsed.director_analyses)) {
        for (const analysis of parsed.director_analyses) {
          if (!analysis || typeof analysis !== "object") continue;
          const rec = analysis as Record<string, unknown>;
          const sceneIndex =
            typeof rec.scene_index === "number" && Number.isFinite(rec.scene_index)
              ? Math.floor(rec.scene_index)
              : -1;
          if (sceneIndex < 0 || sceneIndex >= scenes.length) continue;

          allAnalyses.push({
            scene_index: sceneIndex,
            intelligence: coerceDirectorIntelligence(rec),
          });
        }
      }
    } catch (err) {
      console.error(`[video/auto-edit/analyze] Batch ${batchStart}-${batchEnd} failed:`, err);
      // Continue with remaining batches — partial results are better than none
    }
  }

  // Enforce selectivity constraints: max 40% face_zoom, max 20% key_moment
  const faceZoomCount = allAnalyses.filter((a) => a.intelligence.face_zoom_recommended).length;
  const maxFaceZoom = Math.max(1, Math.ceil(scenes.length * 0.4));
  if (faceZoomCount > maxFaceZoom) {
    // Keep only the ones in talking_head or action scenes, drop the rest
    let kept = 0;
    for (const a of allAnalyses) {
      if (a.intelligence.face_zoom_recommended) {
        const scene = scenes[a.scene_index];
        if (kept >= maxFaceZoom || (scene.scene_type !== "talking_head" && scene.scene_type !== "action")) {
          a.intelligence.face_zoom_recommended = false;
        } else {
          kept++;
        }
      }
    }
  }

  const keyMomentCount = allAnalyses.filter((a) => a.intelligence.key_moment).length;
  const maxKeyMoments = Math.max(1, Math.ceil(scenes.length * 0.2));
  if (keyMomentCount > maxKeyMoments) {
    // Keep the highest-energy scenes as key moments
    const keyMomentAnalyses = allAnalyses
      .filter((a) => a.intelligence.key_moment)
      .sort((a, b) => (scenes[b.scene_index]?.energy || 0) - (scenes[a.scene_index]?.energy || 0));
    for (let i = maxKeyMoments; i < keyMomentAnalyses.length; i++) {
      keyMomentAnalyses[i].intelligence.key_moment = false;
      keyMomentAnalyses[i].intelligence.key_moment_reason = undefined;
    }
  }

  // Enforce no_cut_zone + dead_air mutual exclusivity
  for (const a of allAnalyses) {
    if (a.intelligence.no_cut_zone && a.intelligence.dead_air_detected) {
      a.intelligence.dead_air_detected = false;
      a.intelligence.dead_air_at_sec = undefined;
    }
  }

  // Merge intelligence back into scenes
  const enrichedScenes: Scene[] = scenes.map((scene, i) => {
    const analysis = allAnalyses.find((a) => a.scene_index === i);
    return analysis
      ? { ...scene, director: analysis.intelligence }
      : scene;
  });

  // Record usage
  const tokensUsed = totalInputTokens + totalOutputTokens;
  void recordUsage(ownerId, "tokens", tokensUsed || 2000, {
    source: "auto_edit_analyze",
    scene_count: scenes.length,
    frame_count: frameSamples.length,
    analyses_produced: allAnalyses.length,
  });

  const serviceSupabase = createServiceClient();
  void serviceSupabase.from("trinity_log").insert({
    action_type: "ai_auto_edit_analyze",
    description: `Director analysis: ${allAnalyses.length} scenes analyzed, ${allAnalyses.filter((a) => a.intelligence.is_joke_beat).length} comedy beats, ${allAnalyses.filter((a) => a.intelligence.key_moment).length} key moments`,
    profile_id: user.id,
    status: "completed",
    result: {
      scene_count: scenes.length,
      analyses_produced: allAnalyses.length,
      comedy_beats: allAnalyses.filter((a) => a.intelligence.is_joke_beat).length,
      key_moments: allAnalyses.filter((a) => a.intelligence.key_moment).length,
      face_zooms: allAnalyses.filter((a) => a.intelligence.face_zoom_recommended).length,
      no_cut_zones: allAnalyses.filter((a) => a.intelligence.no_cut_zone).length,
      had_frames: hasFrames,
    },
  });

  return NextResponse.json({
    ok: true,
    scenes: enrichedScenes,
    analysis_summary: {
      total_scenes: scenes.length,
      analyzed: allAnalyses.length,
      comedy_beats: allAnalyses.filter((a) => a.intelligence.is_joke_beat).length,
      key_moments: allAnalyses.filter((a) => a.intelligence.key_moment).length,
      face_zoom_scenes: allAnalyses.filter((a) => a.intelligence.face_zoom_recommended).length,
      subtitle_recommended_scenes: allAnalyses.filter((a) => a.intelligence.subtitle_recommended).length,
      no_cut_zones: allAnalyses.filter((a) => a.intelligence.no_cut_zone).length,
      dead_air_scenes: allAnalyses.filter((a) => a.intelligence.dead_air_detected).length,
    },
    model: MODEL_SONNET,
    tokens_used: tokensUsed,
  });
}
