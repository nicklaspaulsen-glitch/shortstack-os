"use client";

/* ────────────────────────────────────────────────────────────────
 * Timeline — Adobe-Premiere-style multi-track timeline component.
 *
 * Tracks:
 *   • V1 / V2 / V3   — video clips with trim handles
 *   • A1 / A2 / A3   — audio clips (main music / SFX / voiceover)
 *   • Text / Captions — keyframed text overlays (shown as vertical markers)
 *   • Effects        — color grade / transitions / filters (vertical markers)
 *
 * Controls:
 *   • Playhead (click-to-seek)
 *   • Zoom slider (pxPerMs)
 *   • Snap toggle
 *   • Right-click context menu (Delete / Duplicate / Split / Detach audio)
 *   • Keyboard: Space (play/pause), J/K/L (scrub), Cmd/Ctrl+B (split)
 *
 * No external deps — plain HTML/CSS + native drag handlers.
 *
 * Defensive: if the parent passes an empty project, the timeline
 * renders empty rails with ruler + playhead. Never throws on null.
 * ────────────────────────────────────────────────────────────────*/

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Play, Pause, SkipBack, SkipForward, Scissors,
  Copy as CopyIcon, Trash2, AudioLines, ZoomIn, ZoomOut,
  Magnet, Keyboard, Film, Music, Type, Sparkles,
  Captions as CaptionsIcon, Lightbulb, Check as CheckIcon, X as XIcon,
  Activity,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────── */

export type TrackKind = "video" | "audio" | "caption" | "effect";

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
}

export interface TimelineTrack {
  id: string;
  label: string;       // "V1", "A1 · Music", etc.
  kind: TrackKind;
  /** track is muted (audio) or hidden (video) */
  muted?: boolean;
  locked?: boolean;
  /** arbitrary color for the track header */
  accent?: string;
}

export interface TimelineProject {
  /** total duration in ms — timeline rail extends this far. */
  duration: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
}

/** AI edit suggestion to render as an inline ghost marker on the timeline. */
export interface TimelineSuggestion {
  id: string;
  timestamp_sec: number;
  type: string;
  payload: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  scene_index?: number;
}

export interface TimelineProps {
  project: TimelineProject;
  onProjectChange?: (next: TimelineProject) => void;
  /** current playhead in ms (controlled) — if omitted, component manages internally. */
  playhead?: number;
  onPlayheadChange?: (ms: number) => void;
  /** playback state */
  playing?: boolean;
  onPlayPause?: () => void;
  /** optional — link to a <video> player so keyboard shortcuts work on the
   *  actual media, not just the internal playhead model. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** minimum/max zoom — px per ms. */
  minPxPerMs?: number;
  maxPxPerMs?: number;
  className?: string;
  /** When provided, the toolbar shows a "Generate Captions" button that calls
   *  this (expected to hit /api/video/auto-edit/captions). */
  onGenerateCaptions?: () => void | Promise<void>;
  /** When provided, the toolbar shows a "Suggest edits" button that should
   *  call /api/video/auto-edit/suggest and push the result into `suggestions`. */
  onSuggestEdits?: () => void | Promise<void>;
  /** Pending AI suggestions — rendered as ghost markers with accept/reject buttons. */
  suggestions?: TimelineSuggestion[];
  onAcceptSuggestion?: (sug: TimelineSuggestion) => void;
  onRejectSuggestion?: (sug: TimelineSuggestion) => void;
}

/* ─── Defaults ─────────────────────────────────────────────── */

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "v1", label: "V1", kind: "video", accent: "#60A5FA" },
  { id: "v2", label: "V2", kind: "video", accent: "#60A5FA" },
  { id: "v3", label: "V3", kind: "video", accent: "#60A5FA" },
  { id: "a1", label: "A1 · Music", kind: "audio", accent: "#22C55E" },
  { id: "a2", label: "A2 · SFX", kind: "audio", accent: "#F59E0B" },
  { id: "a3", label: "A3 · VO", kind: "audio", accent: "#EC4899" },
  { id: "cap", label: "Captions", kind: "caption", accent: "#A855F7" },
  { id: "fx", label: "FX", kind: "effect", accent: "#EF4444" },
];

const TRACK_HEIGHT = 36;
const TRACK_GAP = 2;
const RULER_HEIGHT = 22;
const TRACK_HEADER_WIDTH = 96;
const SNAP_THRESHOLD_MS = 100; // within this, snaps to playhead / clip edge

/* ─── Helpers ──────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function iconForTrack(kind: TrackKind) {
  switch (kind) {
    case "video":   return <Film size={10} />;
    case "audio":   return <Music size={10} />;
    case "caption": return <Type size={10} />;
    case "effect":  return <Sparkles size={10} />;
  }
}

/** Generate a reasonable set of ruler tick marks for the current duration+zoom. */
function rulerTicks(durationMs: number, pxPerMs: number): { ms: number; major: boolean }[] {
  const desiredPx = 60; // aim for a major tick every ~60px
  const desiredMs = desiredPx / pxPerMs;
  // snap to nice step: 50ms, 100, 250, 500, 1000, 2000, 5000, 10000
  const steps = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
  const step = steps.reduce((prev, cur) => Math.abs(cur - desiredMs) < Math.abs(prev - desiredMs) ? cur : prev, steps[0]);
  const out: { ms: number; major: boolean }[] = [];
  for (let t = 0; t <= durationMs; t += step / 5) {
    const major = Math.abs(t % step) < 0.01;
    out.push({ ms: t, major });
  }
  return out;
}

/* ─── Component ────────────────────────────────────────────── */

export function Timeline({
  project,
  onProjectChange,
  playhead: playheadProp,
  onPlayheadChange,
  playing = false,
  onPlayPause,
  videoRef,
  minPxPerMs = 0.02,
  maxPxPerMs = 0.1,
  className = "",
  onGenerateCaptions,
  onSuggestEdits,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: TimelineProps) {
  // Defensive defaults.
  const safeProject: TimelineProject = useMemo(() => ({
    duration: Math.max(project?.duration ?? 0, 1000),
    tracks: (project?.tracks && project.tracks.length > 0) ? project.tracks : DEFAULT_TRACKS,
    clips: project?.clips || [],
  }), [project]);

  const [internalPlayhead, setInternalPlayhead] = useState(0);
  const playhead = typeof playheadProp === "number" ? playheadProp : internalPlayhead;
  const setPlayhead = useCallback((ms: number) => {
    const clamped = Math.max(0, Math.min(ms, safeProject.duration));
    if (onPlayheadChange) onPlayheadChange(clamped);
    else setInternalPlayhead(clamped);
    if (videoRef?.current && isFinite(clamped)) {
      try { videoRef.current.currentTime = clamped / 1000; } catch {}
    }
  }, [onPlayheadChange, safeProject.duration, videoRef]);

  const [pxPerMs, setPxPerMs] = useState(0.05);
  const [snap, setSnap] = useState(true);
  const [snapToBeat, setSnapToBeat] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [draggingClip, setDraggingClip] = useState<{
    id: string; mode: "move" | "trim-left" | "trim-right";
    originStart: number; originDuration: number; originMouseX: number;
  } | null>(null);

  const railRef = useRef<HTMLDivElement | null>(null);

  /* ─── Project mutators ────────────────────────────────── */

  const updateProject = useCallback((mutate: (p: TimelineProject) => TimelineProject) => {
    if (!onProjectChange) return;
    onProjectChange(mutate(safeProject));
  }, [onProjectChange, safeProject]);

  const updateClip = useCallback((id: string, patch: Partial<TimelineClip>) => {
    updateProject((p) => ({
      ...p,
      clips: p.clips.map((c) => c.id === id ? { ...c, ...patch } : c),
    }));
  }, [updateProject]);

  const deleteClip = useCallback((id: string) => {
    updateProject((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== id) }));
    setSelectedClipId((sel) => sel === id ? null : sel);
  }, [updateProject]);

  const duplicateClip = useCallback((id: string) => {
    updateProject((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (!c) return p;
      const newId = `${c.id}-copy-${Date.now()}`;
      return {
        ...p,
        clips: [...p.clips, { ...c, id: newId, start: c.start + c.duration }],
      };
    });
  }, [updateProject]);

  const splitClipAtPlayhead = useCallback((clipId?: string) => {
    updateProject((p) => {
      const target = clipId
        ? p.clips.find((c) => c.id === clipId)
        : p.clips.find((c) => playhead >= c.start && playhead <= c.start + c.duration && !c.isMarker);
      if (!target) return p;
      if (playhead <= target.start + 20 || playhead >= target.start + target.duration - 20) return p;
      const leftDur = playhead - target.start;
      const rightDur = target.duration - leftDur;
      const leftClip: TimelineClip = { ...target, duration: leftDur };
      const rightClip: TimelineClip = { ...target, id: `${target.id}-split-${Date.now()}`, start: playhead, duration: rightDur };
      return {
        ...p,
        clips: p.clips.flatMap((c) => c.id === target.id ? [leftClip, rightClip] : [c]),
      };
    });
  }, [playhead, updateProject]);

  const detachAudio = useCallback((clipId: string) => {
    updateProject((p) => {
      const c = p.clips.find((x) => x.id === clipId);
      if (!c) return p;
      const audioTrack = p.tracks.find((t) => t.kind === "audio")?.id || "a1";
      const detached: TimelineClip = {
        ...c,
        id: `${c.id}-audio-${Date.now()}`,
        trackId: audioTrack,
        label: `${c.label} (audio)`,
        color: "#22C55E",
      };
      return { ...p, clips: [...p.clips, detached] };
    });
  }, [updateProject]);

  /* ─── Mouse helpers ─────────────────────────────────── */

  const msToPx = useCallback((ms: number) => ms * pxPerMs, [pxPerMs]);
  const pxToMs = useCallback((px: number) => px / pxPerMs, [pxPerMs]);

  /** Derive BPM from the first music clip on A1. Label format coming from the
   *  Preset Picker drop is "<title>" but the music library also embeds BPM in
   *  the (dataset) label attribute when present. We look for "(\\d+) *BPM" in
   *  the label and fall back to 120 when missing. */
  const bpm: number = useMemo(() => {
    const musicClip = safeProject.clips.find((c) => c.trackId === "a1" && !c.isMarker);
    if (!musicClip) return 120;
    const match = /(\d{2,3})\s*BPM/i.exec(musicClip.label || "");
    if (match) {
      const n = Number(match[1]);
      if (n >= 40 && n <= 300) return n;
    }
    return 120;
  }, [safeProject.clips]);

  const beatMs: number = useMemo(() => 60000 / Math.max(40, bpm), [bpm]);

  const nearestBeat = useCallback(
    (ms: number): number => Math.round(ms / beatMs) * beatMs,
    [beatMs],
  );

  /** Given a candidate ms position, snap it to playhead or nearest clip edge. */
  const applySnap = useCallback((candidateMs: number, ignoreClipId?: string): number => {
    if (!snap && !snapToBeat) return candidateMs;
    const targets: number[] = [];
    if (snap) {
      targets.push(playhead);
      for (const c of safeProject.clips) {
        if (c.id === ignoreClipId) continue;
        targets.push(c.start, c.start + c.duration);
      }
    }
    if (snapToBeat) {
      targets.push(nearestBeat(candidateMs));
    }
    for (const t of targets) {
      if (Math.abs(candidateMs - t) <= SNAP_THRESHOLD_MS) return t;
    }
    return candidateMs;
  }, [snap, snapToBeat, playhead, safeProject.clips, nearestBeat]);

  /* ─── Clip drag handlers ────────────────────────────── */

  const onClipMouseDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: "move" | "trim-left" | "trim-right",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedClipId(clip.id);
    setDraggingClip({
      id: clip.id, mode,
      originStart: clip.start,
      originDuration: clip.duration,
      originMouseX: e.clientX,
    });
  };

  useEffect(() => {
    if (!draggingClip) return;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - draggingClip.originMouseX;
      const dMs = pxToMs(dx);
      if (draggingClip.mode === "move") {
        const newStart = applySnap(Math.max(0, draggingClip.originStart + dMs), draggingClip.id);
        updateClip(draggingClip.id, { start: newStart });
      } else if (draggingClip.mode === "trim-left") {
        const rawStart = draggingClip.originStart + dMs;
        const newStart = applySnap(Math.max(0, Math.min(rawStart, draggingClip.originStart + draggingClip.originDuration - 100)), draggingClip.id);
        const newDur = draggingClip.originStart + draggingClip.originDuration - newStart;
        updateClip(draggingClip.id, { start: newStart, duration: newDur });
      } else if (draggingClip.mode === "trim-right") {
        const newDur = Math.max(100, applySnap(draggingClip.originStart + draggingClip.originDuration + dMs, draggingClip.id) - draggingClip.originStart);
        updateClip(draggingClip.id, { duration: newDur });
      }
    };
    const onUp = () => setDraggingClip(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingClip, pxToMs, applySnap, updateClip]);

  /* ─── Rail click (seek playhead) ────────────────────── */

  const onRailClick = (e: React.MouseEvent) => {
    if (!railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = Math.max(0, pxToMs(x));
    setPlayhead(applySnap(ms));
  };

  /* ─── Keyboard shortcuts ───────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (videoRef?.current) {
          if (videoRef.current.paused) void videoRef.current.play();
          else videoRef.current.pause();
        }
        onPlayPause?.();
      } else if (e.key === "j" || e.key === "J") {
        setPlayhead(playhead - 2000);
      } else if (e.key === "k" || e.key === "K") {
        if (videoRef?.current) videoRef.current.pause();
      } else if (e.key === "l" || e.key === "L") {
        setPlayhead(playhead + 2000);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) deleteClip(selectedClipId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playhead, selectedClipId, splitClipAtPlayhead, deleteClip, setPlayhead, videoRef, onPlayPause]);

  /* ─── Close context menu on any outside click ──────── */

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [ctxMenu]);

  /* ─── Track layout ─────────────────────────────────── */

  const trackTop = (idx: number) => RULER_HEIGHT + idx * (TRACK_HEIGHT + TRACK_GAP);
  const totalHeight = RULER_HEIGHT + safeProject.tracks.length * (TRACK_HEIGHT + TRACK_GAP);
  const railWidth = Math.max(msToPx(safeProject.duration) + 40, 600);

  const ticks = useMemo(() => rulerTicks(safeProject.duration, pxPerMs), [safeProject.duration, pxPerMs]);

  /* ─── Render ───────────────────────────────────────── */

  return (
    <div
      className={`rounded-xl border border-border bg-surface/70 backdrop-blur-sm overflow-hidden ${className}`}
      data-testid="video-editor-timeline"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-surface-light/40">
        <button
          type="button"
          onClick={() => {
            if (videoRef?.current) {
              if (videoRef.current.paused) void videoRef.current.play();
              else videoRef.current.pause();
            }
            onPlayPause?.();
          }}
          className="text-foreground hover:text-gold transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setPlayhead(Math.max(0, playhead - 1000))}
          className="text-muted hover:text-foreground"
          aria-label="Skip back 1s"
        >
          <SkipBack size={12} />
        </button>
        <button
          type="button"
          onClick={() => setPlayhead(playhead + 1000)}
          className="text-muted hover:text-foreground"
          aria-label="Skip forward 1s"
        >
          <SkipForward size={12} />
        </button>
        <button
          type="button"
          onClick={() => splitClipAtPlayhead()}
          className="text-muted hover:text-foreground flex items-center gap-1 text-[10px]"
          aria-label="Split at playhead"
        >
          <Scissors size={12} /> Split
        </button>

        <div className="mx-2 text-[10px] font-mono text-foreground">
          {formatTime(playhead)} <span className="text-muted">/ {formatTime(safeProject.duration)}</span>
        </div>

        <div className="flex-1" />

        {/* Snap */}
        <button
          type="button"
          onClick={() => setSnap((v) => !v)}
          className={`flex items-center gap-1 text-[9px] rounded px-2 py-1 border transition-colors ${
            snap ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
          }`}
          title="Snap to playhead & clip edges"
        >
          <Magnet size={10} /> Snap
        </button>

        {/* Snap to beat — reveals a BPM beat grid + snaps clips to beats. */}
        <button
          type="button"
          onClick={() => setSnapToBeat((v) => !v)}
          className={`flex items-center gap-1 text-[9px] rounded px-2 py-1 border transition-colors ${
            snapToBeat ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
          }`}
          title={`Snap drags to the nearest music beat (current BPM: ${bpm})`}
        >
          <Activity size={10} /> Beat
          <span className="text-[8px] text-muted">{bpm}</span>
        </button>

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

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPxPerMs((z) => Math.max(minPxPerMs, z / 1.5))}
            className="text-muted hover:text-foreground"
            aria-label="Zoom out"
          >
            <ZoomOut size={12} />
          </button>
          <input
            type="range"
            min={minPxPerMs}
            max={maxPxPerMs}
            step={0.005}
            value={pxPerMs}
            onChange={(e) => setPxPerMs(Number(e.target.value))}
            className="w-24 h-1 accent-gold"
          />
          <button
            type="button"
            onClick={() => setPxPerMs((z) => Math.min(maxPxPerMs, z * 1.5))}
            className="text-muted hover:text-foreground"
            aria-label="Zoom in"
          >
            <ZoomIn size={12} />
          </button>
        </div>

        <span
          className="text-[8px] text-muted flex items-center gap-1"
          title="Space play/pause · J/K/L scrub · Ctrl+B split"
        >
          <Keyboard size={10} /> shortcuts
        </span>
      </div>

      {/* Timeline body */}
      <div className="flex">
        {/* Track headers */}
        <div className="flex-shrink-0 border-r border-border" style={{ width: TRACK_HEADER_WIDTH }}>
          <div style={{ height: RULER_HEIGHT }} className="border-b border-border bg-surface-light/30" />
          {safeProject.tracks.map((track, i) => (
            <div
              key={track.id}
              className="flex items-center gap-1.5 px-2 border-b border-border/60"
              style={{ height: TRACK_HEIGHT, marginTop: i === 0 ? 0 : TRACK_GAP }}
            >
              <span className="text-gold" style={{ color: track.accent }}>{iconForTrack(track.kind)}</span>
              <span className="text-[10px] font-mono text-foreground truncate">{track.label}</span>
            </div>
          ))}
        </div>

        {/* Scroll container */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative" style={{ height: totalHeight }}>
          <div
            ref={railRef}
            className="relative"
            style={{ width: railWidth, height: totalHeight }}
            onMouseDown={(e) => {
              // Only seek when clicking empty area (not a clip).
              const tgt = e.target as HTMLElement;
              if (tgt.dataset.role !== "clip" && tgt.dataset.role !== "trim-handle") onRailClick(e);
            }}
          >
            {/* Ruler */}
            <div
              className="sticky top-0 z-10 bg-surface-light/80 backdrop-blur-sm border-b border-border"
              style={{ height: RULER_HEIGHT, width: railWidth }}
            >
              {ticks.map((tick) => (
                <div
                  key={tick.ms}
                  className={`absolute top-0 ${tick.major ? "bg-muted/50" : "bg-muted/20"}`}
                  style={{
                    left: msToPx(tick.ms),
                    width: 1,
                    height: tick.major ? RULER_HEIGHT : RULER_HEIGHT / 2,
                    bottom: 0,
                  }}
                >
                  {tick.major && (
                    <span className="absolute top-0 left-1 text-[8px] font-mono text-muted select-none">
                      {formatTime(tick.ms).replace(".00", "")}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Track rails */}
            {safeProject.tracks.map((track, i) => (
              <div
                key={track.id}
                className="absolute left-0 right-0 border-b border-border/40 bg-surface/30"
                style={{
                  top: trackTop(i),
                  height: TRACK_HEIGHT,
                  width: railWidth,
                }}
              />
            ))}

            {/* Beat grid — faint vertical lines at each BPM beat. Only rendered
             *  when snapToBeat is on, so the default view stays uncluttered. */}
            {snapToBeat && bpm >= 40 && (() => {
              const lines: number[] = [];
              const total = safeProject.duration;
              for (let t = 0; t <= total; t += beatMs) lines.push(t);
              return lines.map((ms, i) => {
                const isDownbeat = i % 4 === 0;
                return (
                  <div
                    key={`beat-${i}`}
                    className="absolute top-0 pointer-events-none"
                    style={{
                      left: msToPx(ms),
                      height: totalHeight,
                      width: 1,
                      background: isDownbeat ? "rgba(252,211,77,0.35)" : "rgba(252,211,77,0.12)",
                    }}
                  />
                );
              });
            })()}

            {/* Clips */}
            {safeProject.clips.map((clip) => {
              const trackIdx = safeProject.tracks.findIndex((t) => t.id === clip.trackId);
              if (trackIdx < 0) return null;
              const top = trackTop(trackIdx) + 3;
              const left = msToPx(clip.start);
              const width = Math.max(4, msToPx(clip.duration));
              const color = clip.color || safeProject.tracks[trackIdx].accent || "#60A5FA";
              const isSelected = selectedClipId === clip.id;

              if (clip.isMarker) {
                return (
                  <div
                    key={clip.id}
                    className="absolute cursor-pointer group"
                    style={{
                      top, left: left - 1,
                      height: TRACK_HEIGHT - 6,
                      width: 3,
                      background: color,
                    }}
                    title={clip.label}
                    data-role="clip"
                    onMouseDown={(e) => onClipMouseDown(e, clip, "move")}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
                    }}
                  >
                    <span className="absolute top-0 left-2 whitespace-nowrap text-[8px] text-white/70 group-hover:text-white bg-black/40 px-1 rounded pointer-events-none">
                      {clip.label}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={clip.id}
                  data-role="clip"
                  className={`absolute rounded-md overflow-hidden cursor-grab active:cursor-grabbing group ${
                    isSelected ? "ring-2 ring-gold" : "ring-1 ring-black/20"
                  }`}
                  style={{
                    top, left, width,
                    height: TRACK_HEIGHT - 6,
                    background: `linear-gradient(90deg, ${color}dd, ${color}99)`,
                  }}
                  onMouseDown={(e) => onClipMouseDown(e, clip, "move")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
                  }}
                  title={clip.label}
                >
                  {/* Left trim handle */}
                  <div
                    data-role="trim-handle"
                    className="absolute left-0 top-0 h-full w-1.5 bg-white/30 hover:bg-white/70 cursor-ew-resize"
                    onMouseDown={(e) => onClipMouseDown(e, clip, "trim-left")}
                  />
                  {/* Right trim handle */}
                  <div
                    data-role="trim-handle"
                    className="absolute right-0 top-0 h-full w-1.5 bg-white/30 hover:bg-white/70 cursor-ew-resize"
                    onMouseDown={(e) => onClipMouseDown(e, clip, "trim-right")}
                  />

                  {clip.thumbnailUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={clip.thumbnailUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-40 pointer-events-none"
                    />
                  )}

                  <span className="relative px-2 py-0.5 text-[9px] text-white/95 drop-shadow font-medium truncate block">
                    {clip.label}
                  </span>
                  <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-white/70">
                    {formatTime(clip.duration).replace("00:", "")}
                  </span>
                </div>
              );
            })}

            {/* AI suggestion ghost markers — green vertical lines with a chip
             *  floating above the ruler. Hover to show accept/reject inline. */}
            {suggestions.map((sug) => {
              const ms = Math.round(sug.timestamp_sec * 1000);
              const left = msToPx(ms);
              const isHover = hoveredSuggestionId === sug.id;
              return (
                <div
                  key={sug.id}
                  className="absolute top-0 z-[15] pointer-events-none"
                  style={{ left: left - 1, width: 2, height: totalHeight }}
                >
                  <div
                    className="absolute top-0 left-0 w-[2px] h-full"
                    style={{
                      background: "rgba(16,185,129,0.55)",
                      boxShadow: "0 0 6px rgba(16,185,129,0.7)",
                    }}
                  />
                  <div
                    className={`absolute -top-[20px] left-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-medium pointer-events-auto ${
                      isHover ? "bg-black/90 text-white" : "bg-emerald-500/80 text-white"
                    }`}
                    onMouseEnter={() => setHoveredSuggestionId(sug.id)}
                    onMouseLeave={() => setHoveredSuggestionId(null)}
                    title={sug.reasoning}
                  >
                    <Lightbulb size={8} />
                    <span className="max-w-[80px] truncate">{sug.type}</span>
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
                  </div>
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 pointer-events-none z-20"
              style={{
                left: msToPx(playhead) - 1,
                height: totalHeight,
                width: 2,
                background: "#FCD34D",
                boxShadow: "0 0 6px rgba(252,211,77,0.8)",
              }}
            >
              <div
                className="absolute -top-1 -left-[5px] w-3 h-3 rotate-45"
                style={{ background: "#FCD34D" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {safeProject.clips.length === 0 && (
        <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted italic text-center">
          No clips on the timeline yet. Drop a video or click &ldquo;Generate&rdquo; &mdash; your clips will appear here.
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 rounded-lg border border-border bg-surface shadow-xl py-1 text-[11px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 180 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon={<Trash2 size={11} />}
            label="Delete"
            onClick={() => { deleteClip(ctxMenu.clipId); setCtxMenu(null); }}
          />
          <MenuItem
            icon={<CopyIcon size={11} />}
            label="Duplicate"
            onClick={() => { duplicateClip(ctxMenu.clipId); setCtxMenu(null); }}
          />
          <MenuItem
            icon={<Scissors size={11} />}
            label="Split at playhead"
            shortcut="Ctrl+B"
            onClick={() => { splitClipAtPlayhead(ctxMenu.clipId); setCtxMenu(null); }}
          />
          <MenuItem
            icon={<AudioLines size={11} />}
            label="Detach audio"
            onClick={() => { detachAudio(ctxMenu.clipId); setCtxMenu(null); }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-light text-foreground text-left"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[9px] text-muted font-mono">{shortcut}</span>}
    </button>
  );
}

/* ─── Helper: build a TimelineProject from a storyboard + durations ── */

export function buildProjectFromStoryboard(storyboard: Array<{
  scene_number: number; duration: string; visual: string; text_overlay?: string; transition?: string; music_note?: string;
}>, totalDurationMs?: number): TimelineProject {
  const clips: TimelineClip[] = [];
  let cursor = 0;

  // Parse duration strings like "3s", "2.5s", "0:03".
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
      // Music stretches across the whole project.
      clips.push({
        id: `music`,
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
  // Fix up the music clip's duration if it was created before we knew the total.
  const music = clips.find((c) => c.id === "music");
  if (music && music.duration < total) music.duration = total;

  return {
    duration: total,
    tracks: DEFAULT_TRACKS,
    clips,
  };
}

export default Timeline;
