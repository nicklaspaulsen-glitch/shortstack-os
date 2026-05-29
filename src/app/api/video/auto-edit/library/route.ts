import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  isValidScene,
  type Scene,
  type Suggestion,
  type EditCategory,
  type EditDecision,
  type EditDecisionAlternative,
  type EditLibrary,
  EDIT_CATEGORIES,
  SUGGESTION_TO_CATEGORY,
  emptyEditLibrary,
} from "@/lib/auto-edit-types";
import {
  SFX_LIBRARY,
  TRANSITIONS_LIBRARY,
  EFFECTS_LIBRARY,
  MUSIC_LIBRARY,
} from "@/lib/video-presets";

/**
 * POST /api/video/auto-edit/library
 *
 * Organizes suggestions + director intelligence into a selectable
 * EditLibrary. The UI shows decisions grouped by category with:
 *  - toggle on/off per decision
 *  - swap alternatives from the preset libraries
 *  - bulk enable/disable per category
 *  - director notes explaining each choice
 *
 * This route does NOT call Claude — it's pure TypeScript logic that
 * reshapes suggestions into the library format and enriches them with
 * alternatives from the preset libraries.
 *
 * Input: scenes (with optional director intelligence), suggestions,
 *        and optional user preferences.
 * Output: EditLibrary with categorized, toggleable decisions.
 */

export const maxDuration = 15;

interface LibraryInput {
  scenes: unknown;
  suggestions: unknown;
  /** Minimum confidence threshold — suggestions below this are disabled by default. */
  min_confidence?: number;
  /** Maximum alternatives per decision (1-5, default 3). */
  max_alternatives?: number;
}

// ── Alternative generators ──────────────────────────────────────────

function sfxAlternatives(
  currentId: string | undefined,
  category: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const alts: EditDecisionAlternative[] = [];
  const candidates = category
    ? SFX_LIBRARY.filter((s) => s.category === category && s.id !== currentId)
    : SFX_LIBRARY.filter((s) => s.id !== currentId);

  // Pick diverse alternatives — different sub-categories when possible
  const seen = new Set<string>();
  for (const sfx of candidates) {
    if (alts.length >= max) break;
    const key = `${sfx.category}_${sfx.tags?.[0] || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alts.push({
      id: randomUUID(),
      label: sfx.name,
      payload: { sfx_id: sfx.id, category: sfx.category },
    });
  }
  return alts;
}

function transitionAlternatives(
  currentId: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const alts: EditDecisionAlternative[] = [];
  const candidates = TRANSITIONS_LIBRARY.filter((t) => t.id !== currentId);

  // Group by category, pick one from each
  const byCategory: Record<string, typeof candidates> = {};
  for (const t of candidates) {
    const cat = t.category || "cut";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  const catKeys = Object.keys(byCategory);
  for (const catKey of catKeys) {
    if (alts.length >= max) break;
    const group = byCategory[catKey];
    const pick = group[0];
    alts.push({
      id: randomUUID(),
      label: pick.name,
      payload: { transition_id: pick.id },
    });
  }
  return alts;
}

function effectAlternatives(
  currentId: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const alts: EditDecisionAlternative[] = [];
  const candidates = EFFECTS_LIBRARY.filter((e) => e.id !== currentId);

  for (const effect of candidates) {
    if (alts.length >= max) break;
    alts.push({
      id: randomUUID(),
      label: effect.name,
      payload: { effect_id: effect.id },
    });
  }
  return alts;
}

function zoomAlternatives(
  currentStyle: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const styles: Array<{ style: string; label: string; amount: number }> = [
    { style: "punch-in", label: "Punch-in (fast snap)", amount: 1.4 },
    { style: "smooth", label: "Smooth push (cinematic)", amount: 1.3 },
    { style: "jerky", label: "Jerky handheld", amount: 1.2 },
  ];
  return styles
    .filter((s) => s.style !== currentStyle)
    .slice(0, max)
    .map((s) => ({
      id: randomUUID(),
      label: s.label,
      payload: { style: s.style, amount: s.amount },
    }));
}

function musicAlternatives(
  currentMood: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const alts: EditDecisionAlternative[] = [];
  const moods = ["upbeat", "energetic", "chill", "epic", "dark", "funky", "playful", "motivational"];
  const filtered = moods.filter((m) => m !== currentMood);

  for (const mood of filtered) {
    if (alts.length >= max) break;
    const match = MUSIC_LIBRARY.find((m) => m.mood === mood);
    alts.push({
      id: randomUUID(),
      label: `${mood.charAt(0).toUpperCase() + mood.slice(1)} mood`,
      payload: { mood, energy: match ? (match.energy >= 7 ? "high" : match.energy >= 4 ? "medium" : "low") : "medium", music_id: match?.id },
    });
  }
  return alts;
}

function captionAlternatives(
  currentStyle: string | undefined,
  max: number,
): EditDecisionAlternative[] {
  const styles = [
    { id: "hormozi-bounce", label: "Hormozi bounce (bold emphasis)" },
    { id: "mrbeast-pop", label: "MrBeast pop (colorful, large)" },
    { id: "clean-sans", label: "Clean sans-serif (minimal)" },
    { id: "kinetic-colour", label: "Kinetic colour (animated)" },
    { id: "subtle-lower-third", label: "Subtle lower-third" },
    { id: "vlog-handwritten", label: "Vlog handwritten (casual)" },
  ];
  return styles
    .filter((s) => s.id !== currentStyle)
    .slice(0, max)
    .map((s) => ({
      id: randomUUID(),
      label: s.label,
      payload: { style_id: s.id },
    }));
}

// ── Build director note from scene context ──────────────────────────

function buildDirectorNote(
  suggestion: Suggestion,
  scene: Scene | undefined,
): string | undefined {
  if (!scene?.director) return undefined;
  const d = scene.director;
  const parts: string[] = [];

  if (suggestion.type === "zoom" && d.face_zoom_recommended) {
    parts.push(`Face zoom recommended (${d.face_zoom_style || "punch-in"} style)`);
    if (d.suggested_zoom_target && d.suggested_zoom_target !== "face") {
      parts.push(`but consider targeting ${d.suggested_zoom_target} instead`);
    }
  }
  if (suggestion.type === "sfx" && d.is_joke_beat) {
    parts.push(`Comedy beat detected (${d.joke_type || "punchline"})`);
    if (d.comedy_timing_sec !== undefined) {
      parts.push(`punchline at ${d.comedy_timing_sec.toFixed(1)}s`);
    }
  }
  if (suggestion.type === "caption" && d.subtitle_recommended) {
    parts.push(d.subtitle_reason || "Subtitles add value here");
  }
  if (d.key_moment) {
    parts.push(`Key moment: ${d.key_moment_reason || "hero shot"}`);
  }
  if (d.no_cut_zone) {
    parts.push("No-cut zone — let this moment breathe");
  }
  if (d.emotional_beat !== "neutral") {
    parts.push(`Emotional ${d.emotional_beat}`);
  }
  if (d.energy_shift !== "steady") {
    parts.push(`Energy ${d.energy_shift}`);
  }

  return parts.length > 0 ? parts.join(". ") + "." : undefined;
}

// ── Generate cut decisions from dead air + scene boundaries ─────────

function generateCutDecisions(
  scenes: Scene[],
  maxAlts: number,
): EditDecision[] {
  const cuts: EditDecision[] = [];
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    const d = prev.director;

    // Skip if this is a no-cut zone
    if (d?.no_cut_zone) continue;

    const isDeadAir = d?.dead_air_detected;
    const confidence = isDeadAir ? 0.9 : 0.6;
    const cutPoint = isDeadAir && d?.dead_air_at_sec
      ? d.dead_air_at_sec
      : prev.end_sec;

    cuts.push({
      id: randomUUID(),
      category: "cut",
      timestamp_sec: Math.round(cutPoint * 100) / 100,
      scene_index: i - 1,
      label: isDeadAir
        ? `Cut at dead air (${cutPoint.toFixed(1)}s)`
        : `Scene transition cut (${cutPoint.toFixed(1)}s)`,
      description: isDeadAir
        ? `Natural pause detected — clean cut point between "${prev.scene_type}" and "${curr.scene_type}" scenes.`
        : `Scene boundary between "${prev.scene_type}" and "${curr.scene_type}".`,
      confidence,
      enabled: confidence >= 0.7,
      payload: {
        cut_type: isDeadAir ? "dead_air" : "scene_boundary",
        from_scene: i - 1,
        to_scene: i,
      },
      director_note: d?.dead_air_detected
        ? "Director detected natural pause — ideal cut point."
        : d?.energy_shift === "spike" || d?.energy_shift === "drop"
          ? `Energy ${d.energy_shift} makes this a strong cut point.`
          : undefined,
      alternatives: transitionAlternatives(undefined, maxAlts),
    });
  }
  return cuts;
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

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  let body: LibraryInput;
  try {
    body = (await request.json()) as LibraryInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
  const scenes: Scene[] = rawScenes.filter(isValidScene);
  if (scenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "scenes[] is required." },
      { status: 400 },
    );
  }

  const rawSuggestions = Array.isArray(body.suggestions) ? body.suggestions : [];
  const minConfidence =
    typeof body.min_confidence === "number" && body.min_confidence >= 0 && body.min_confidence <= 1
      ? body.min_confidence
      : 0.5;
  const maxAlts =
    typeof body.max_alternatives === "number" && body.max_alternatives >= 1 && body.max_alternatives <= 5
      ? body.max_alternatives
      : 3;

  const library = emptyEditLibrary();
  library.scene_count = scenes.length;
  library.total_duration_sec = scenes[scenes.length - 1]?.end_sec || 0;

  // Convert each suggestion into an EditDecision with alternatives
  for (const raw of rawSuggestions) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;

    const type = typeof s.type === "string" ? s.type.trim().toLowerCase() : "";
    const category: EditCategory | undefined =
      SUGGESTION_TO_CATEGORY[type as keyof typeof SUGGESTION_TO_CATEGORY];
    if (!category) continue;

    const timestamp =
      typeof s.timestamp_sec === "number" ? s.timestamp_sec : 0;
    const confidence =
      typeof s.confidence === "number" ? Math.max(0, Math.min(1, s.confidence)) : 0.5;
    const payload =
      s.payload && typeof s.payload === "object"
        ? (s.payload as Record<string, unknown>)
        : {};
    const reasoning =
      typeof s.reasoning === "string" && s.reasoning.trim()
        ? s.reasoning.trim()
        : "AI-generated suggestion.";

    const sceneIndex =
      typeof s.scene_index === "number" && Number.isFinite(s.scene_index)
        ? Math.max(0, Math.min(scenes.length - 1, Math.floor(s.scene_index)))
        : undefined;
    const scene = sceneIndex !== undefined ? scenes[sceneIndex] : undefined;

    // Generate alternatives based on suggestion type
    let alternatives: EditDecisionAlternative[] = [];
    switch (category) {
      case "sfx":
        alternatives = sfxAlternatives(
          payload.sfx_id as string | undefined,
          payload.category as string | undefined,
          maxAlts,
        );
        break;
      case "transition":
        alternatives = transitionAlternatives(
          payload.transition_id as string | undefined,
          maxAlts,
        );
        break;
      case "effect":
        alternatives = effectAlternatives(
          payload.effect_id as string | undefined,
          maxAlts,
        );
        break;
      case "zoom":
        alternatives = zoomAlternatives(
          payload.style as string | undefined,
          maxAlts,
        );
        break;
      case "music":
        alternatives = musicAlternatives(
          payload.mood as string | undefined,
          maxAlts,
        );
        break;
      case "caption":
        alternatives = captionAlternatives(
          payload.style_id as string | undefined,
          maxAlts,
        );
        break;
      case "broll":
        // B-roll alternatives are query-based, not preset-based
        alternatives = [];
        break;
    }

    // Build label from payload
    let label = `${category} at ${timestamp.toFixed(1)}s`;
    if (category === "sfx" && payload.sfx_id) {
      const sfx = SFX_LIBRARY.find((s) => s.id === payload.sfx_id);
      label = sfx ? sfx.name : String(payload.sfx_id);
    } else if (category === "transition" && payload.transition_id) {
      const tr = TRANSITIONS_LIBRARY.find((t) => t.id === payload.transition_id);
      label = tr ? tr.name : String(payload.transition_id);
    } else if (category === "effect" && payload.effect_id) {
      const fx = EFFECTS_LIBRARY.find((e) => e.id === payload.effect_id);
      label = fx ? fx.name : String(payload.effect_id);
    } else if (category === "zoom") {
      label = `${payload.style || "Smooth"} zoom (${payload.amount || 1.3}x)`;
    } else if (category === "music") {
      label = `${String(payload.mood || "Upbeat").charAt(0).toUpperCase() + String(payload.mood || "upbeat").slice(1)} music cue`;
    } else if (category === "caption") {
      label = `Captions: ${payload.style_id || "clean-sans"}`;
    } else if (category === "broll") {
      label = `B-roll: ${payload.query || "contextual insert"}`;
    }

    const decision: EditDecision = {
      id: typeof s.id === "string" ? s.id : randomUUID(),
      category,
      timestamp_sec: Math.round(timestamp * 100) / 100,
      scene_index: sceneIndex,
      label,
      description: reasoning,
      confidence,
      enabled: confidence >= minConfidence,
      payload,
      director_note: buildDirectorNote(
        { ...({ type, timestamp_sec: timestamp, confidence, reasoning, payload } as Suggestion), id: "" },
        scene,
      ),
      alternatives,
    };

    library.categories[category].push(decision);
  }

  // Add cut decisions derived from scene boundaries + dead air
  const cutDecisions = generateCutDecisions(scenes, maxAlts);
  library.categories.cut.push(...cutDecisions);

  // Sort each category by timestamp
  for (const cat of EDIT_CATEGORIES) {
    library.categories[cat].sort((a, b) => a.timestamp_sec - b.timestamp_sec);
  }

  // Compute totals
  let totalDecisions = 0;
  let enabledCount = 0;
  for (const cat of EDIT_CATEGORIES) {
    totalDecisions += library.categories[cat].length;
    enabledCount += library.categories[cat].filter((d) => d.enabled).length;
  }
  library.total_decisions = totalDecisions;
  library.enabled_count = enabledCount;

  // Director grade based on analysis richness
  const hasDirector = scenes.some((s) => s.director);
  if (hasDirector) {
    const jokeCount = scenes.filter((s) => s.director?.is_joke_beat).length;
    const keyMoments = scenes.filter((s) => s.director?.key_moment).length;
    const enabledRatio = totalDecisions > 0 ? enabledCount / totalDecisions : 0;

    library.director_grade =
      enabledRatio > 0.7 && keyMoments > 0
        ? "A"
        : enabledRatio > 0.5
          ? "B"
          : "C";
    library.director_summary = [
      `${totalDecisions} edit decisions across ${scenes.length} scenes`,
      `${enabledCount} enabled by default (${Math.round(enabledRatio * 100)}%)`,
      jokeCount > 0 ? `${jokeCount} comedy beat${jokeCount > 1 ? "s" : ""} detected` : null,
      keyMoments > 0 ? `${keyMoments} key moment${keyMoments > 1 ? "s" : ""} flagged` : null,
    ]
      .filter(Boolean)
      .join(". ") + ".";
  }

  return NextResponse.json({
    ok: true,
    library,
  });
}
