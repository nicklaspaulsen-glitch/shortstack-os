/**
 * auto-edit-types.ts — shared types for the Auto-Edit Engine.
 *
 * Routes under `/api/video/auto-edit/*` share the `Scene` and `Suggestion`
 * shapes. Keeping them in one file avoids drift between detect-scenes (which
 * produces them) and suggest/apply/full-pass (which consume them).
 */

export type SceneType =
  | "talking_head"
  | "action"
  | "b_roll"
  | "product"
  | "text_slide"
  | "transition";

export type MotionLevel = "low" | "medium" | "high";

export interface Scene {
  start_sec: number;
  end_sec: number;
  scene_type: SceneType;
  motion_level: MotionLevel;
  energy: number; // 0-100
  dominant_colors: string[]; // hex
  suggested_sfx_category?: string;
  suggested_transition?: string; // id from TRANSITIONS_LIBRARY
}

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
