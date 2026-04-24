"use client";

/* ────────────────────────────────────────────────────────────────
 * Video-editor timeline bridge.
 *
 * The production-grade shared <Timeline/> lives at
 *   src/components/timeline/Timeline.tsx
 *
 * This module:
 *   1. Re-exports all shared types so existing page imports still resolve.
 *   2. Provides a thin `VideoTimeline` wrapper that accepts the legacy
 *      `onProjectChange` prop name + video-editor extras (suggestions,
 *      Captions/Suggest toolbar buttons) via `renderExtraToolbar`.
 *   3. Also exports `Timeline` as an alias for backward compat with the
 *      page's `import { Timeline as VideoTimeline }` statement.
 *   4. Keeps video-editor-specific helpers: DEFAULT_TRACKS,
 *      buildProjectFromStoryboard, TimelineSuggestion.
 * ────────────────────────────────────────────────────────────────*/

import {
  Captions as CaptionsIcon,
  Lightbulb,
  Activity,
  Check as CheckIcon,
  X as XIcon,
} from "lucide-react";

// ── Shared Timeline (aliased to avoid redeclaration conflict) ─
import { Timeline as _SharedTimeline, useTimelineHistory } from "@/components/timeline";
export { useTimelineHistory };

// ── Re-export types ──────────────────────────────────────────
export type {
  TimelineProps,
  UseTimelineHistory,
  Clip,
  TimelineClip,
  TimelineTrack,
  TimelineTrackKind,
  TimelineProject,
  TimelineHistoryEntry,
} from "@/components/timeline";

import type { TimelineProject, TimelineClip, TimelineProps } from "@/components/timeline";

/* ─── AI suggestion type (video-editor-specific) ────────────── */

export interface TimelineSuggestion {
  id: string;
  timestamp_sec: number;
  type: string;
  payload: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  scene_index?: number;
}

/* ─── Default multi-track set ───────────────────────────────── */

export const DEFAULT_TRACKS = [
  { id: "v1",  label: "V1",         kind: "video"   as const, accent: "#60A5FA" },
  { id: "v2",  label: "V2",         kind: "video"   as const, accent: "#60A5FA" },
  { id: "v3",  label: "V3",         kind: "video"   as const, accent: "#60A5FA" },
  { id: "a1",  label: "A1 · Music", kind: "audio"   as const, accent: "#22C55E" },
  { id: "a2",  label: "A2 · SFX",   kind: "audio"   as const, accent: "#F59E0B" },
  { id: "a3",  label: "A3 · VO",    kind: "audio"   as const, accent: "#EC4899" },
  { id: "cap", label: "Captions",   kind: "caption" as const, accent: "#A855F7" },
  { id: "fx",  label: "FX",         kind: "effect"  as const, accent: "#EF4444" },
];

/* ─── Thin wrapper — legacy prop + extras ───────────────────── */

export interface VideoTimelineProps extends Omit<TimelineProps, "onChange"> {
  /** Alias for the shared Timeline's `onChange` — kept for backward compat. */
  onProjectChange?: (next: TimelineProject) => void;
  onChange?: (next: TimelineProject) => void;

  /** Extra video-editor toolbar buttons. */
  onGenerateCaptions?: () => void | Promise<void>;
  onSuggestEdits?: () => void | Promise<void>;
  suggestions?: TimelineSuggestion[];
  onAcceptSuggestion?: (sug: TimelineSuggestion) => void;
  onRejectSuggestion?: (sug: TimelineSuggestion) => void;
}

function VideoTimeline({
  onProjectChange,
  onChange,
  onGenerateCaptions,
  onSuggestEdits,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
  project,
  ...rest
}: VideoTimelineProps) {
  const handleChange = onChange ?? onProjectChange ?? (() => undefined);

  // BPM derived from first A1 music clip label.
  const bpm: number = (() => {
    const musicClip = (project?.clips ?? []).find(
      (c) => c.trackId === "a1" && !c.isMarker,
    );
    if (!musicClip) return 120;
    const m = /(\d{2,3})\s*BPM/i.exec(musicClip.label || "");
    if (m) {
      const n = Number(m[1]);
      if (n >= 40 && n <= 300) return n;
    }
    return 120;
  })();

  const renderExtraToolbar = () => (
    <>
      {onGenerateCaptions && (
        <button
          type="button"
          onClick={() => void onGenerateCaptions()}
          className="flex items-center gap-1 text-[9px] rounded px-2 py-1 border border-border text-muted hover:text-foreground"
          title="Auto-transcribe primary video & render caption keyframes"
        >
          <CaptionsIcon size={10} /> Captions
        </button>
      )}

      {onSuggestEdits && (
        <button
          type="button"
          onClick={() => void onSuggestEdits()}
          className="flex items-center gap-1 text-[9px] rounded px-2 py-1 border border-border text-muted hover:text-gold"
          title="Ask the AI editor for timed edit suggestions"
        >
          <Lightbulb size={10} /> Suggest
        </button>
      )}

      {bpm >= 40 && (
        <span
          className="flex items-center gap-1 text-[9px] rounded px-2 py-1 border border-border text-muted"
          title={`Detected BPM: ${bpm}`}
        >
          <Activity size={10} /> {bpm} BPM
        </span>
      )}

      {suggestions.slice(0, 3).map((sug) => (
        <span
          key={sug.id}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-medium bg-emerald-500/80 text-white"
          title={sug.reasoning}
        >
          <Lightbulb size={8} />
          <span className="max-w-[60px] truncate">{sug.type}</span>
          {onAcceptSuggestion && (
            <button
              type="button"
              onClick={() => onAcceptSuggestion(sug)}
              className="ml-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-white h-3 w-3 flex items-center justify-center"
              title={`Accept: ${sug.reasoning}`}
            >
              <CheckIcon size={7} />
            </button>
          )}
          {onRejectSuggestion && (
            <button
              type="button"
              onClick={() => onRejectSuggestion(sug)}
              className="rounded bg-red-500/80 hover:bg-red-500 text-white h-3 w-3 flex items-center justify-center"
              title="Reject"
            >
              <XIcon size={7} />
            </button>
          )}
        </span>
      ))}
      {suggestions.length > 3 && (
        <span className="text-[8px] text-muted">+{suggestions.length - 3} more</span>
      )}
    </>
  );

  return (
    <_SharedTimeline
      project={project}
      onChange={handleChange}
      renderExtraToolbar={renderExtraToolbar}
      {...rest}
    />
  );
}

// Export as both `VideoTimeline` and `Timeline` (page uses `Timeline as VideoTimeline`).
export { VideoTimeline };
export { VideoTimeline as Timeline };
export default VideoTimeline;

/* ─── buildProjectFromStoryboard ──────────────────────────────
 * Converts an AI-generated scene plan into a TimelineProject.
 * ─────────────────────────────────────────────────────────────*/

export function buildProjectFromStoryboard(
  storyboard: Array<{
    scene_number: number;
    duration: string;
    visual: string;
    text_overlay?: string;
    transition?: string;
    music_note?: string;
  }>,
  totalDurationMs?: number,
): TimelineProject {
  const clips: TimelineClip[] = [];
  let cursor = 0;

  const parseDurationMs = (s: string | undefined, fallback = 3000): number => {
    if (!s) return fallback;
    const trimmed = String(s).trim();
    const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*s/i);
    if (secMatch) return Math.round(Number(secMatch[1]) * 1000);
    const colonMatch = trimmed.match(/^(\d+):(\d+)$/);
    if (colonMatch) return (Number(colonMatch[1]) * 60 + Number(colonMatch[2])) * 1000;
    const num = Number(trimmed);
    if (!isNaN(num)) return num < 100 ? Math.round(num * 1000) : Math.round(num);
    return fallback;
  };

  storyboard.forEach((scene, i) => {
    const dur = parseDurationMs(scene.duration, 3000);
    clips.push({
      id: `scene-${i}`,
      trackId: "v1",
      start: cursor,
      duration: dur,
      label: `Scene ${scene.scene_number} — ${scene.visual.slice(0, 24)}`,
      color: "#60A5FA",
    });
    if (scene.text_overlay) {
      clips.push({
        id: `cap-${i}`,
        trackId: "cap",
        start: cursor + 100,
        duration: Math.max(500, dur - 200),
        label: scene.text_overlay.slice(0, 32),
        color: "#A855F7",
      });
    }
    if (scene.transition && scene.transition.toLowerCase() !== "none") {
      clips.push({
        id: `fx-${i}`,
        trackId: "fx",
        start: cursor + dur - 200,
        duration: 400,
        label: scene.transition,
        color: "#EF4444",
        isMarker: true,
      });
    }
    if (i === 0 && scene.music_note) {
      clips.push({
        id: "music",
        trackId: "a1",
        start: 0,
        duration: Math.max(1000, totalDurationMs || 0),
        label: scene.music_note.slice(0, 32),
        color: "#22C55E",
      });
    }
    cursor += dur;
  });

  const total = totalDurationMs || cursor || 10000;
  const music = clips.find((c) => c.id === "music");
  if (music && music.duration < total) music.duration = total;

  return { duration: total, tracks: DEFAULT_TRACKS, clips };
}
