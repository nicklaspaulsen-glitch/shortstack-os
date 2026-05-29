/**
 * auto-edit-types.ts — shared types for the Auto-Edit Engine.
 *
 * Routes under `/api/video/auto-edit/*` share the `Scene` and `Suggestion`
 * shapes. Keeping them in one file avoids drift between detect-scenes (which
 * produces them) and suggest/apply/full-pass (which consume them).
 *
 * v2 additions: DirectorIntelligence (second-pass comedy/face/timing analysis)
 * and EditLibrary types (selectable edit decision UI).
 */

// ─── Scene types ─────────────────────────────────────────────────────

export type SceneType =
  | "talking_head"
  | "action"
  | "b_roll"
  | "product"
  | "text_slide"
  | "transition";

export type MotionLevel = "low" | "medium" | "high";

/**
 * Director intelligence — second-pass analysis that detects nuanced signals
 * the basic scene classifier misses: comedy beats, face zoom opportunities,
 * speech emphasis, emotional arcs, and "no-cut" zones.
 *
 * Produced by POST /api/video/auto-edit/analyze; consumed by the suggest
 * route and the edit library UI.
 */
export interface DirectorIntelligence {
  /** Whether a human face is prominently visible in this scene. */
  has_face: boolean;
  /** Director recommends zooming into the face during this scene. */
  face_zoom_recommended: boolean;
  face_zoom_style?: "punch-in" | "smooth" | "jerky";
  /** Where to aim the zoom: face, hands, product, text, or keep wide. */
  suggested_zoom_target?: "face" | "hands" | "product" | "text" | "wide";
  /** Speech delivery style detected. */
  speech_emphasis: "normal" | "shouting" | "whispering" | "emphatic" | "monotone";
  /** Is this a comedy/humor beat? */
  is_joke_beat: boolean;
  joke_type?: "punchline" | "setup" | "callback" | "visual_gag" | "reaction";
  /** Exact timestamp of the punchline/beat within the scene. */
  comedy_timing_sec?: number;
  /** Subtitles would add value here (speech clarity, emphasis, comedy). */
  subtitle_recommended: boolean;
  subtitle_reason?: string;
  /** Emotional arc classification for this scene. */
  emotional_beat: "build" | "peak" | "release" | "neutral" | "tension" | "surprise";
  /** Energy trajectory relative to previous scene. */
  energy_shift: "rising" | "falling" | "steady" | "spike" | "drop";
  /** This is a "hero moment" worth featuring — key quote, dramatic shot, etc. */
  key_moment: boolean;
  key_moment_reason?: string;
  /** Director says "don't cut here" — let the moment breathe. */
  no_cut_zone: boolean;
  /** Natural pause or dead air detected — good cut opportunity. */
  dead_air_detected: boolean;
  dead_air_at_sec?: number;
}

export interface Scene {
  start_sec: number;
  end_sec: number;
  scene_type: SceneType;
  motion_level: MotionLevel;
  energy: number; // 0-100
  dominant_colors: string[]; // hex
  suggested_sfx_category?: string;
  suggested_transition?: string; // id from TRANSITIONS_LIBRARY
  /** Second-pass director intelligence (populated by /analyze route). */
  director?: DirectorIntelligence;
}

// ─── Suggestion types ────────────────────────────────────────────────

export type SuggestionType =
  | "sfx"
  | "caption"
  | "transition"
  | "color_grade"
  | "broll_insert"
  | "zoom"
  | "music_cue";

export interface Suggestion {
  id: string;
  timestamp_sec: number;
  type: SuggestionType;
  payload: Record<string, unknown>;
  confidence: number; // 0-1
  reasoning: string;
  /**
   * The scene (by index into the caller's scene array) this suggestion was
   * generated for. Included so the UI can group suggestions by scene.
   */
  scene_index?: number;
}

// ─── Edit Library types (selectable UI) ──────────────────────────────

export type EditCategory =
  | "music"
  | "zoom"
  | "effect"
  | "transition"
  | "sfx"
  | "caption"
  | "broll"
  | "cut";

export const EDIT_CATEGORIES: readonly EditCategory[] = [
  "music",
  "zoom",
  "effect",
  "transition",
  "sfx",
  "caption",
  "broll",
  "cut",
] as const;

/** A swap-in alternative the user can pick instead of the primary suggestion. */
export interface EditDecisionAlternative {
  id: string;
  label: string;
  payload: Record<string, unknown>;
}

/**
 * A single selectable edit decision in the library. The UI shows these
 * grouped by category; users toggle `enabled` on/off and can swap the
 * primary choice for an alternative.
 */
export interface EditDecision {
  id: string;
  category: EditCategory;
  timestamp_sec: number;
  scene_index?: number;
  label: string;
  description: string;
  confidence: number; // 0-1
  /** Whether this decision is included in the final edit by default. */
  enabled: boolean;
  /** The raw suggestion payload (sfx_id, transition_id, etc.). */
  payload: Record<string, unknown>;
  /** Director's note explaining why this edit matters. */
  director_note?: string;
  /** Up to 3 alternative choices the user can swap to. */
  alternatives: EditDecisionAlternative[];
}

/** The full edit library returned after analysis. Organized by category. */
export interface EditLibrary {
  categories: Record<EditCategory, EditDecision[]>;
  scene_count: number;
  total_duration_sec: number;
  total_decisions: number;
  enabled_count: number;
  director_grade?: string;
  director_summary?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

export const SCENE_TYPES: readonly SceneType[] = [
  "talking_head",
  "action",
  "b_roll",
  "product",
  "text_slide",
  "transition",
] as const;

export const MOTION_LEVELS: readonly MotionLevel[] = [
  "low",
  "medium",
  "high",
] as const;

export const SUGGESTION_TYPES: readonly SuggestionType[] = [
  "sfx",
  "caption",
  "transition",
  "color_grade",
  "broll_insert",
  "zoom",
  "music_cue",
] as const;

/** Maps SuggestionType → EditCategory for the library organizer. */
export const SUGGESTION_TO_CATEGORY: Record<SuggestionType, EditCategory> = {
  sfx: "sfx",
  caption: "caption",
  transition: "transition",
  color_grade: "effect",
  broll_insert: "broll",
  zoom: "zoom",
  music_cue: "music",
};

// ─── Coercion helpers ────────────────────────────────────────────────

export function coerceSceneType(raw: unknown): SceneType {
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase() as SceneType;
    if (SCENE_TYPES.includes(v)) return v;
  }
  return "b_roll";
}

export function coerceMotionLevel(raw: unknown): MotionLevel {
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase() as MotionLevel;
    if (MOTION_LEVELS.includes(v)) return v;
  }
  return "medium";
}

export function coerceSuggestionType(raw: unknown): SuggestionType | null {
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase() as SuggestionType;
    if (SUGGESTION_TYPES.includes(v)) return v;
  }
  return null;
}

export function isValidScene(s: unknown): s is Scene {
  if (!s || typeof s !== "object") return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.start_sec === "number" &&
    typeof r.end_sec === "number" &&
    typeof r.scene_type === "string" &&
    typeof r.motion_level === "string"
  );
}

/** Create an empty EditLibrary with all categories initialized. */
export function emptyEditLibrary(): EditLibrary {
  const categories = {} as Record<EditCategory, EditDecision[]>;
  for (const cat of EDIT_CATEGORIES) categories[cat] = [];
  return {
    categories,
    scene_count: 0,
    total_duration_sec: 0,
    total_decisions: 0,
    enabled_count: 0,
  };
}
