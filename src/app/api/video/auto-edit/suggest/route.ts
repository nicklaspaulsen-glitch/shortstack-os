import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  coerceSuggestionType,
  isValidScene,
  type Scene,
  type Suggestion,
} from "@/lib/auto-edit-types";
import {
  SFX_LIBRARY,
  TRANSITIONS_LIBRARY,
  EFFECTS_LIBRARY,
  getCreatorPackById,
} from "@/lib/video-presets";
import {
  formatAsFewShot,
  getRecentPreferences,
} from "@/lib/ai-edit-preferences";

/**
 * POST /api/video/auto-edit/suggest
 *
 * Given a Scene[] (usually from detect-scenes), generate a timed list of edit
 * Suggestions. Runs Claude Haiku (cheap) with:
 *   - a curated subset of valid preset IDs (SFX / transitions / effects)
 *   - the user's creator_pack_id signature (when provided)
 *   - the user's recent accept/reject history as a few-shot example block
 *
 * Suggestions respect scene boundaries and are rate-limited to roughly one
 * suggestion per 1.5 seconds so the timeline doesn't turn into confetti.
 *
 * Token cost: 1 token (Haiku, scene-count-bounded).
 */

export const maxDuration = 60;

interface SuggestInput {
  video_url?: string;
  scenes?: unknown;
  client_id?: string;
  creator_pack_id?: string;
}

// A compact preset menu we feed to Claude — too many IDs bloat the prompt.
// We include category headers and the 8 most-useful IDs per category. The
// suggest pipeline is free to reuse other library IDs too (the output IDs
// are validated against the full library on the way back), but the prompt
// gets a curated shortlist.
const TOP_SFX_IDS = [
  "sfx_whoosh_short_01",
  "sfx_whoosh_long_01",
  "sfx_whoosh_swipe_01",
  "sfx_whoosh_cinematic",
  "sfx_impact_boom",
  "sfx_impact_cinematic_hit",
  "sfx_impact_punch",
  "sfx_ui_click_01",
  "sfx_ui_swipe",
  "sfx_comedy_boing",
  "sfx_comedy_airhorn",
  "sfx_riser_8s",
  "sfx_riser_synth",
  "sfx_meme_vine_boom",
  "sfx_meme_record_scratch",
];

const TOP_TRANSITION_IDS = [
  "tr_cut_hard",
  "tr_cut_flash",
  "tr_fade_cross",
  "tr_fade_dip_black",
  "tr_zoom_punch",
  "tr_zoom_punch_out",
  "tr_zoom_blur",
  "tr_whip_left",
  "tr_whip_right",
  "tr_glitch_basic",
  "tr_slide_left",
  "tr_rotate_cw",
];

const TOP_EFFECT_IDS = [
  "fx_color_teal_orange",
  "fx_color_hdr_pop",
  "fx_color_bleach_bypass",
  "fx_color_vintage",
  "fx_color_cinematic_flat",
  "fx_filter_grain_heavy",
  "fx_filter_grain_subtle",
  "fx_filter_vhs",
];

const CAPTION_STYLES = [
  "hormozi-bounce",
  "mrbeast-pop",
  "clean-sans",
  "kinetic-colour",
  "subtle-lower-third",
  "vlog-handwritten",
];

function validSfxIds(): Set<string> {
  return new Set(SFX_LIBRARY.map((s) => s.id));
}

function validTransitionIds(): Set<string> {
  return new Set(TRANSITIONS_LIBRARY.map((t) => t.id));
}

function validEffectIds(): Set<string> {
  return new Set(EFFECTS_LIBRARY.map((e) => e.id));
}

function buildSystemPrompt(
  creatorPackId: string | undefined,
  fewShot: string,
): string {
  const pack = creatorPackId ? getCreatorPackById(creatorPackId) : null;
  const packSummary = pack
    ? `CREATOR PACK: ${pack.name} (${pack.creatorName}) — pacing ${pack.signature.pacing}, cuts ${pack.signature.cutFrequency}, zoom ${pack.signature.zoomStyle}, caption style "${pack.signature.captionStyle}", music moods [${pack.signature.musicMood.join(", ")}], preferred SFX categories [${pack.signature.sfxCategories.join(", ")}], colour grade ${pack.signature.colorGrade}.`
    : "CREATOR PACK: none — use balanced defaults.";

  return `You are an expert short-form video editor generating timed edit SUGGESTIONS. Given a list of detected scenes and the creator's signature pack, you propose SFX cues, caption on/off moments, transitions, colour grades, B-roll insertions, zooms, and music cues — each bound to a timestamp.

${packSummary}

AVAILABLE SUGGESTION TYPES
- "sfx"         → { sfx_id, category }                        — trigger a sound effect
- "caption"     → { style_id, duration_sec }                  — turn on captions in a named style
- "transition"  → { transition_id }                           — cut/fade/whip/zoom between clips
- "color_grade" → { effect_id }                               — apply a colour LUT
- "broll_insert"→ { query, duration_sec }                     — insert stock B-roll (concrete search query)
- "zoom"        → { style: "punch-in"|"smooth"|"jerky", amount }  — camera zoom
- "music_cue"   → { mood, energy: "low"|"medium"|"high" }     — beat/mood change

VALID SFX IDS (you may also use any id beginning with "sfx_" from the library): ${TOP_SFX_IDS.join(", ")}
VALID TRANSITION IDS (or any id beginning with "tr_"): ${TOP_TRANSITION_IDS.join(", ")}
VALID EFFECT IDS (or any id beginning with "fx_"): ${TOP_EFFECT_IDS.join(", ")}
VALID CAPTION STYLES: ${CAPTION_STYLES.join(", ")}

RULES
- Suggestions must sit INSIDE scene boundaries (timestamp between start_sec and end_sec of the scene).
- Do NOT spam. Average at most 1 suggestion per 1.5 seconds of clip.
- Prefer suggestions that match the creator pack's signature when one is provided.
- Every suggestion needs a short "reasoning" string explaining WHY this fits this scene, visible to the user.
- confidence is 0..1 — lower it when the scene is ambiguous.
- Reuse existing preset IDs. Do NOT invent new SFX or transition IDs.
- scene_index (int) points to the scene this suggestion belongs to — 0-based.

OUTPUT FORMAT
Respond with ONLY raw JSON:
{
  "suggestions": [
    {
      "timestamp_sec": 1.2,
      "scene_index": 0,
      "type": "sfx",
      "payload": { "sfx_id": "sfx_whoosh_short_01", "category": "whoosh" },
      "confidence": 0.8,
      "reasoning": "Fast pan at the start of a talking-head scene benefits from a quick whoosh."
    }
  ]
}

No markdown fences. No commentary.${fewShot ? `\n\n${fewShot}` : ""}`;
}

function validatePayload(
  type: Suggestion["type"],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  // Validate preset IDs against the real libraries and drop anything unknown.
  const out: Record<string, unknown> = { ...payload };
  if (type === "sfx") {
    const id = typeof out.sfx_id === "string" ? out.sfx_id : "";
    if (id && !validSfxIds().has(id)) {
      // Drop unknown id so the client doesn't try to play a missing file.
      delete out.sfx_id;
    }
  }
  if (type === "transition") {
    const id = typeof out.transition_id === "string" ? out.transition_id : "";
    if (id && !validTransitionIds().has(id)) delete out.transition_id;
  }
  if (type === "color_grade") {
    const id = typeof out.effect_id === "string" ? out.effect_id : "";
    if (id && !validEffectIds().has(id)) delete out.effect_id;
  }
  return out;
}

function capDensity(
  suggestions: Suggestion[],
  totalDuration: number,
): Suggestion[] {
  if (totalDuration <= 0 || suggestions.length === 0) return suggestions;
  const maxAllowed = Math.max(1, Math.floor(totalDuration / 1.5));
  if (suggestions.length <= maxAllowed) return suggestions;

  // Keep the highest-confidence suggestions up to the cap.
  const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence);
  return sorted
    .slice(0, maxAllowed)
    .sort((a, b) => a.timestamp_sec - b.timestamp_sec);
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

  const limit = await checkLimit(ownerId, "tokens", 1);
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

  let body: SuggestInput;
  try {
    body = (await request.json()) as SuggestInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
  const scenes: Scene[] = rawScenes.filter(isValidScene);
  if (scenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "scenes[] is required — call /api/video/auto-edit/detect-scenes first." },
      { status: 400 },
    );
  }

  const creatorPackId =
    typeof body.creator_pack_id === "string" && body.creator_pack_id.trim()
      ? body.creator_pack_id.trim()
      : undefined;

  // Load few-shot examples to personalise suggestions.
  const examples = await getRecentPreferences({ user_id: user.id, limit: 20 });
  const fewShot = formatAsFewShot(examples);

  const totalDuration = scenes[scenes.length - 1].end_sec;

  const systemPrompt = buildSystemPrompt(creatorPackId, fewShot);
  const userPrompt = `SCENES (${scenes.length}):\n${JSON.stringify(scenes, null, 2)}\n\nTOTAL DURATION: ${totalDuration.toFixed(2)}s\n\nGenerate timed suggestions. JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 3000,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<{ suggestions?: unknown }>(text);
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Claude returned an invalid response",
          raw: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const rawSuggestions = parsed.suggestions as unknown[];
    const normalised: Suggestion[] = [];
    for (const r of rawSuggestions) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const type = coerceSuggestionType(rec.type);
      if (!type) continue;
      const ts = typeof rec.timestamp_sec === "number" ? rec.timestamp_sec : NaN;
      if (!Number.isFinite(ts)) continue;
      const conf =
        typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
          ? Math.max(0, Math.min(1, rec.confidence))
          : 0.5;
      const reasoning =
        typeof rec.reasoning === "string" && rec.reasoning.trim()
          ? rec.reasoning.trim()
          : "Suggested by AI based on scene context.";
      const payload =
        rec.payload && typeof rec.payload === "object"
          ? (rec.payload as Record<string, unknown>)
          : {};
      const sceneIndex =
        typeof rec.scene_index === "number" && Number.isFinite(rec.scene_index)
          ? Math.max(0, Math.min(scenes.length - 1, Math.floor(rec.scene_index)))
          : undefined;

      // Clamp timestamp into total duration bounds and into a scene if possible.
      let clampedTs = Math.max(0, Math.min(totalDuration, ts));
      if (sceneIndex !== undefined) {
        const sc = scenes[sceneIndex];
        clampedTs = Math.max(sc.start_sec, Math.min(sc.end_sec, clampedTs));
      }

      normalised.push({
        id: randomUUID(),
        timestamp_sec: Math.round(clampedTs * 100) / 100,
        type,
        payload: validatePayload(type, payload),
        confidence: conf,
        reasoning,
        scene_index: sceneIndex,
      });
    }

    // Keep suggestions sorted by timestamp, then cap density.
    normalised.sort((a, b) => a.timestamp_sec - b.timestamp_sec);
    const capped = capDensity(normalised, totalDuration);

    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    void recordUsage(ownerId, "tokens", tokensUsed || 1200, {
      source: "auto_edit_suggest",
      suggestion_count: capped.length,
      creator_pack_id: creatorPackId,
    });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_auto_edit_suggest",
      description: `Generated ${capped.length} auto-edit suggestions across ${scenes.length} scenes`,
      profile_id: user.id,
      status: "completed",
      result: {
        suggestion_count: capped.length,
        scene_count: scenes.length,
        creator_pack_id: creatorPackId,
        preference_examples: examples.length,
      },
    });

    return NextResponse.json({
      ok: true,
      suggestions: capped,
      total: capped.length,
      personalised_from: examples.length,
      model: MODEL_HAIKU,
    });
  } catch (err) {
    console.error("[video/auto-edit/suggest] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { ok: false, error: "Failed to generate suggestions", detail: message },
      { status: 500 },
    );
  }
}
