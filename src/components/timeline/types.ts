/* ────────────────────────────────────────────────────────────────
 * Shared Timeline types — consumed by both <Timeline/> (the reusable
 * primitive under src/components/timeline/) and the video-editor's
 * higher-level <VideoTimeline/> wrapper under src/components/video-editor.
 *
 * Keeping the types in a leaf module means they can be imported by
 * either side without a circular dependency, and callers can build
 * adapter shims that map their domain shape (video clips, thumbnail
 * layer animations, etc.) onto this canonical shape.
 * ────────────────────────────────────────────────────────────────*/

export type TimelineTrackKind = "video" | "audio" | "caption" | "effect" | "custom";

export interface TimelineClip {
  id: string;
  trackId: string;
  /** start time in milliseconds (on the project timeline) */
  start: number;
  /** duration in milliseconds */
  duration: number;
  /** label shown on the clip */
  label: string;
  /** optional color for the clip block */
  color?: string;
  /** optional thumbnail URL (shown at clip start) */
  thumbnailUrl?: string;
  /** if true, this clip is a "marker" rendered as a vertical line (captions/effects). */
  isMarker?: boolean;
  /** locked clips cannot be moved, trimmed, or deleted. */
  locked?: boolean;
}

export interface TimelineTrack {
  id: string;
  label: string;
  kind: TimelineTrackKind;
  muted?: boolean;
  locked?: boolean;
  accent?: string;
}

export interface TimelineProject {
  /** total duration in ms — timeline rail extends this far. */
  duration: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
}

/** A snapshot of the project kept on the undo/redo stack. */
export interface TimelineHistoryEntry {
  project: TimelineProject;
  ts: number;
}

/* ─── Simplified Clip interface ─────────────────────────────────────────────
 * Thin shape used by callers that don't need multi-track projects
 * (e.g. thumbnail-generator layer animations).  Adapters convert between
 * this and TimelineClip when wiring into <Timeline/>.
 * ─────────────────────────────────────────────────────────────────────────*/
export interface Clip {
  id: string;
  /** start time in milliseconds */
  start: number;
  /** duration in milliseconds */
  duration: number;
  /** display label */
  label: string;
  /** optional clip color */
  color?: string;
}
