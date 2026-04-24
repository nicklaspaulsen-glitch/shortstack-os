/* ────────────────────────────────────────────────────────────────
 * Premiere-Pro-style NLE types
 *
 * Unit convention: everything time-related is in milliseconds (ms)
 * unless the name explicitly says "frames" or "sec". Frames are
 * computed at 30 fps for the scrubber, so 1 frame = 33.33 ms.
 * ────────────────────────────────────────────────────────────────*/

export type TrackKind = "video" | "audio" | "caption";

export interface Track {
  id: string;
  label: string;
  kind: TrackKind;
  /** Hex accent colour for the track's clips. */
  accent: string;
  /** Muted / solo / hidden — pure UI. */
  muted?: boolean;
  solo?: boolean;
  hidden?: boolean;
  locked?: boolean;
}

/** A single keyframe. `value` is normalised per property
 * (opacity 0..1, scale 0..N, position/rotation in px/deg). */
export interface Keyframe {
  /** Time within the clip, in ms, not on the global timeline. */
  frame: number;
  value: number;
}

export type KeyframeableProperty =
  | "opacity"
  | "scale"
  | "positionX"
  | "positionY"
  | "rotation";

export type KeyframeMap = Partial<Record<KeyframeableProperty, Keyframe[]>>;

export type TransitionKind =
  | "none"
  | "cross-dissolve"
  | "dip-to-black"
  | "push"
  | "slide";

export interface Transition {
  kind: TransitionKind;
  /** Duration in ms. Sits on the clip's *leading* edge. */
  duration: number;
}

export interface Clip {
  id: string;
  trackId: string;
  /** Global timeline position, in ms. */
  start: number;
  /** Duration in ms. */
  duration: number;
  /** For video/audio: where in the source media the clip begins, in ms. */
  sourceIn?: number;
  /** Display label. */
  label: string;
  /** Hex fill. */
  color: string;
  /** Source URL for video/audio. Captions keep it blank. */
  src?: string;
  /** Text content for caption clips. */
  text?: string;
  /** Pre-extracted peak samples (0..1) for audio waveform. */
  peaks?: number[];
  /** Keyframeable animation properties. */
  keyframes?: KeyframeMap;
  /** Transition on the clip's leading edge. */
  transitionIn?: Transition;
  /** Transition on the clip's trailing edge. */
  transitionOut?: Transition;
  /** Arbitrary caption/title style id. */
  styleId?: string;
}

export interface EditorState {
  tracks: Track[];
  clips: Clip[];
  /** Global playhead in ms. */
  playhead: number;
  /** Selected clip ids. */
  selection: string[];
  /** In/out markers for J-K-L preview. */
  markerIn: number | null;
  markerOut: number | null;
  /** Pixels per second for rendering. */
  pixelsPerSecond: number;
  /** FPS of the project — used for frame-accurate scrub. */
  fps: number;
}

export type EditorAction =
  | { type: "ADD_CLIP"; clip: Clip }
  | { type: "MOVE_CLIP"; id: string; start: number; trackId?: string }
  | { type: "TRIM_CLIP"; id: string; start: number; duration: number; sourceIn?: number }
  | { type: "SPLIT_CLIP"; id: string; atMs: number }
  | { type: "DELETE_CLIP"; id: string; ripple?: boolean }
  | { type: "ADD_KEYFRAME"; clipId: string; property: KeyframeableProperty; keyframe: Keyframe }
  | { type: "REMOVE_KEYFRAME"; clipId: string; property: KeyframeableProperty; frame: number }
  | { type: "SET_TRANSITION"; clipId: string; side: "in" | "out"; transition: Transition }
  | { type: "SET_PLAYHEAD"; ms: number }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "SET_MARKER_IN"; ms: number | null }
  | { type: "SET_MARKER_OUT"; ms: number | null }
  | { type: "SET_ZOOM"; pixelsPerSecond: number }
  | { type: "SET_TRACK_FLAG"; trackId: string; flag: "muted" | "solo" | "hidden" | "locked"; value: boolean }
  | { type: "REPLACE_CLIPS"; clips: Clip[] }
  | { type: "UNDO" }
  | { type: "REDO" };

/** History wrapper — capped stack kept separate from editor. */
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 50;
