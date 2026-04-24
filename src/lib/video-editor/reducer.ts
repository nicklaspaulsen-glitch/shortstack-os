/* ────────────────────────────────────────────────────────────────
 * Editor reducer + undo/redo history wrapper.
 *
 * The history stack only snapshots *mutating* actions. UI actions
 * like SET_PLAYHEAD and SET_SELECTION push through untouched.
 * ────────────────────────────────────────────────────────────────*/

import {
  EditorAction,
  EditorState,
  HistoryState,
  HISTORY_LIMIT,
  Clip,
  Keyframe,
  KeyframeableProperty,
  Track,
} from "./types";

/* ─── Default state ─────────────────────────────────────────── */

export const DEFAULT_TRACKS: Track[] = [
  { id: "v1", label: "V1", kind: "video", accent: "#EF4444" },
  { id: "v2", label: "V2", kind: "video", accent: "#22C55E" },
  { id: "v3", label: "V3", kind: "video", accent: "#3B82F6" },
  { id: "a1", label: "A1", kind: "audio", accent: "#F59E0B" },
  { id: "a2", label: "A2", kind: "audio", accent: "#F59E0B" },
  { id: "a3", label: "A3", kind: "audio", accent: "#F59E0B" },
  { id: "cap", label: "Captions", kind: "caption", accent: "#A855F7" },
];

export const INITIAL_STATE: EditorState = {
  tracks: DEFAULT_TRACKS,
  clips: [],
  playhead: 0,
  selection: [],
  markerIn: null,
  markerOut: null,
  pixelsPerSecond: 80,
  fps: 30,
};

/* ─── Action classifier ─────────────────────────────────────── */

/** Actions that mutate project data (and therefore push history). */
const MUTATING: EditorAction["type"][] = [
  "ADD_CLIP",
  "MOVE_CLIP",
  "TRIM_CLIP",
  "SPLIT_CLIP",
  "DELETE_CLIP",
  "ADD_KEYFRAME",
  "REMOVE_KEYFRAME",
  "SET_TRANSITION",
  "REPLACE_CLIPS",
];

function isMutating(a: EditorAction): boolean {
  return (MUTATING as string[]).includes(a.type);
}

/* ─── Helpers ───────────────────────────────────────────────── */

function upsertKeyframe(
  existing: Keyframe[] | undefined,
  kf: Keyframe
): Keyframe[] {
  const base = (existing || []).filter((k) => k.frame !== kf.frame);
  return [...base, kf].sort((a, b) => a.frame - b.frame);
}

function removeKeyframe(existing: Keyframe[] | undefined, frame: number): Keyframe[] {
  return (existing || []).filter((k) => k.frame !== frame);
}

/** Returns a tight-packed clip list after deleting `id`.
 *  Ripple closes the gap; non-ripple just removes. */
function deleteClip(clips: Clip[], id: string, ripple: boolean): Clip[] {
  const target = clips.find((c) => c.id === id);
  if (!target) return clips;
  const next = clips.filter((c) => c.id !== id);
  if (!ripple) return next;
  const gap = target.duration;
  return next.map((c) =>
    c.trackId === target.trackId && c.start >= target.start + target.duration
      ? { ...c, start: Math.max(0, c.start - gap) }
      : c
  );
}

function splitClip(clips: Clip[], id: string, atMs: number): Clip[] {
  const clip = clips.find((c) => c.id === id);
  if (!clip) return clips;
  const offset = atMs - clip.start;
  if (offset <= 0 || offset >= clip.duration) return clips;
  const left: Clip = { ...clip, duration: offset };
  const right: Clip = {
    ...clip,
    id: `${clip.id}-b-${Date.now().toString(36)}`,
    start: clip.start + offset,
    duration: clip.duration - offset,
    sourceIn: (clip.sourceIn || 0) + offset,
    keyframes: undefined, // keyframes stay with the left half — simpler semantics
    transitionIn: undefined,
  };
  return [...clips.filter((c) => c.id !== id), left, right];
}

/* ─── Core reducer (non-history) ────────────────────────────── */

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "ADD_CLIP":
      return { ...state, clips: [...state.clips, action.clip], selection: [action.clip.id] };

    case "MOVE_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? { ...c, start: Math.max(0, action.start), trackId: action.trackId || c.trackId }
            : c
        ),
      };

    case "TRIM_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.id
            ? {
                ...c,
                start: Math.max(0, action.start),
                duration: Math.max(50, action.duration),
                sourceIn: action.sourceIn ?? c.sourceIn,
              }
            : c
        ),
      };

    case "SPLIT_CLIP":
      return { ...state, clips: splitClip(state.clips, action.id, action.atMs) };

    case "DELETE_CLIP":
      return {
        ...state,
        clips: deleteClip(state.clips, action.id, action.ripple === true),
        selection: state.selection.filter((s) => s !== action.id),
      };

    case "ADD_KEYFRAME": {
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id !== action.clipId) return c;
          const kf = c.keyframes || {};
          return {
            ...c,
            keyframes: { ...kf, [action.property]: upsertKeyframe(kf[action.property], action.keyframe) },
          };
        }),
      };
    }

    case "REMOVE_KEYFRAME": {
      return {
        ...state,
        clips: state.clips.map((c) => {
          if (c.id !== action.clipId) return c;
          const kf = c.keyframes || {};
          return {
            ...c,
            keyframes: { ...kf, [action.property]: removeKeyframe(kf[action.property], action.frame) },
          };
        }),
      };
    }

    case "SET_TRANSITION":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId
            ? action.side === "in"
              ? { ...c, transitionIn: action.transition }
              : { ...c, transitionOut: action.transition }
            : c
        ),
      };

    case "SET_PLAYHEAD":
      return { ...state, playhead: Math.max(0, action.ms) };

    case "SET_SELECTION":
      return { ...state, selection: action.ids };

    case "SET_MARKER_IN":
      return { ...state, markerIn: action.ms };

    case "SET_MARKER_OUT":
      return { ...state, markerOut: action.ms };

    case "SET_ZOOM":
      return { ...state, pixelsPerSecond: Math.max(10, Math.min(800, action.pixelsPerSecond)) };

    case "SET_TRACK_FLAG":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, [action.flag]: action.value } : t
        ),
      };

    case "REPLACE_CLIPS":
      return { ...state, clips: action.clips };

    default:
      return state;
  }
}

/* ─── History wrapper ───────────────────────────────────────── */

export function historyReducer(
  state: HistoryState<EditorState>,
  action: EditorAction
): HistoryState<EditorState> {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    return { past: newPast, present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === "REDO") {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return { past: [...state.past, state.present], present: next, future: newFuture };
  }

  const nextPresent = editorReducer(state.present, action);
  if (nextPresent === state.present) return state;

  if (!isMutating(action)) {
    // UI-only action — don't touch history, just swap present.
    return { ...state, present: nextPresent };
  }

  const past = [...state.past, state.present];
  const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
  return { past: trimmed, present: nextPresent, future: [] };
}

export function createInitialHistory(state: EditorState = INITIAL_STATE): HistoryState<EditorState> {
  return { past: [], present: state, future: [] };
}

/* ─── Keyframe interpolation ────────────────────────────────── */

export function interpolate(
  keyframes: Keyframe[] | undefined,
  frame: number,
  fallback: number
): number {
  if (!keyframes || keyframes.length === 0) return fallback;
  if (keyframes.length === 1) return keyframes[0].value;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / (b.frame - a.frame);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

/* ─── Snap helpers ──────────────────────────────────────────── */

/** Returns `ms` snapped to the nearest snap target within `snapPx` of
 *  the cursor. Targets = playhead + every clip start/end (except the
 *  clip being moved). */
export function snapToTargets(
  ms: number,
  targets: number[],
  snapPx: number,
  pixelsPerSecond: number
): number {
  const toleranceMs = (snapPx / pixelsPerSecond) * 1000;
  let best = ms;
  let bestDist = toleranceMs;
  for (const t of targets) {
    const d = Math.abs(t - ms);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/** Snap a value to the nearest frame boundary for frame-accurate scrubbing. */
export function snapToFrame(ms: number, fps: number): number {
  const frameMs = 1000 / fps;
  return Math.round(ms / frameMs) * frameMs;
}
