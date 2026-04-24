"use client";

/* ────────────────────────────────────────────────────────────────
 * <Timeline/> — production-grade reusable multi-track timeline.
 *
 * Features:
 *   • Horizontal track per row; each clip is a draggable block.
 *   • Drag-to-move clips between tracks (vertical drag switches track).
 *   • Trim handles on left/right edge to resize clips.
 *   • Playhead indicator — click the ruler/track to scrub.
 *   • Zoom level control — buttons, slider, and "+"/"-" keyboard shortcuts.
 *   • Snap to 1-second grid (toggleable); also snaps to clip edges and
 *     the playhead within a small threshold.
 *   • Multi-select — shift-click to add, plain click to replace selection.
 *   • Delete / Backspace deletes all selected clips.
 *   • Undo / Redo — Ctrl+Z / Ctrl+Shift+Z, 50-entry in-memory stack.
 *   • Keyboard: Space (play/pause), +/- (zoom), arrows (nudge), Del, Ctrl+Z/Y.
 *
 * Zero external deps.  Pure div + pointer events.
 *
 * The component is controlled: the caller owns `project` and responds to
 * `onChange`.  We also take an optional `playhead` + `onPlayheadChange`
 * so the caller can drive a media element; if omitted, we manage it
 * internally.  Selection is internal-only (opaque array of clip IDs).
 *
 * Undo/redo snapshots are taken on "commit" boundaries (mouseup after
 * drag, keyboard delete, etc.) — NOT on every pixel.  This keeps the
 * 50-entry cap meaningful.
 * ────────────────────────────────────────────────────────────────*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Trash2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Film,
  Music,
  Type,
  Sparkles,
  Layers as LayersIcon,
  Keyboard,
} from "lucide-react";

import type {
  TimelineClip,
  TimelineProject,
  TimelineTrack,
  TimelineTrackKind,
} from "./types";
import { useTimelineHistory } from "./use-timeline-history";

/* ─── Layout constants ─────────────────────────────────────── */

const TRACK_HEIGHT = 36;
const TRACK_GAP = 2;
const RULER_HEIGHT = 22;
const TRACK_HEADER_WIDTH = 96;
const SNAP_THRESHOLD_MS = 100;
const GRID_MS = 1000; // 1-second grid default
const MIN_CLIP_DURATION_MS = 100;

/* ─── Props ────────────────────────────────────────────────── */

export interface TimelineProps {
  project: TimelineProject;
  onChange: (next: TimelineProject) => void;

  /** controlled playhead in ms — omit to let the component manage it. */
  playhead?: number;
  onPlayheadChange?: (ms: number) => void;

  /** playback state (controlled).  If omitted, play button is hidden. */
  playing?: boolean;
  onPlayPause?: () => void;

  /** Optional HTMLVideoElement ref — keyboard scrub/seek also drives this. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;

  /** px per ms, zoom bounds. */
  minPxPerMs?: number;
  maxPxPerMs?: number;
  initialPxPerMs?: number;

  /** Render an extra toolbar widget (e.g. "Generate captions" button). */
  renderExtraToolbar?: () => React.ReactNode;

  className?: string;
  /** data-testid override */
  testId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function iconForKind(kind: TimelineTrackKind) {
  switch (kind) {
    case "video": return <Film size={10} />;
    case "audio": return <Music size={10} />;
    case "caption": return <Type size={10} />;
    case "effect": return <Sparkles size={10} />;
    case "custom":
    default: return <LayersIcon size={10} />;
  }
}

function rulerTicks(durationMs: number, pxPerMs: number): { ms: number; major: boolean }[] {
  const desiredPx = 60;
  const desiredMs = desiredPx / pxPerMs;
  const steps = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
  const step = steps.reduce(
    (prev, cur) => Math.abs(cur - desiredMs) < Math.abs(prev - desiredMs) ? cur : prev,
    steps[0],
  );
  const out: { ms: number; major: boolean }[] = [];
  for (let t = 0; t <= durationMs; t += step / 5) {
    out.push({ ms: t, major: Math.abs(t % step) < 0.01 });
  }
  return out;
}

function snapToGrid(ms: number, gridMs = GRID_MS): number {
  return Math.round(ms / gridMs) * gridMs;
}

/* ─── Component ────────────────────────────────────────────── */

export function Timeline({
  project,
  onChange,
  playhead: playheadProp,
  onPlayheadChange,
  playing = false,
  onPlayPause,
  videoRef,
  minPxPerMs = 0.02,
  maxPxPerMs = 0.2,
  initialPxPerMs = 0.05,
  renderExtraToolbar,
  className = "",
  testId = "timeline",
}: TimelineProps) {
  /* ─── Defensive defaults ──────────────────────────── */
  const safeProject: TimelineProject = useMemo(
    () => ({
      duration: Math.max(project?.duration ?? 0, 1000),
      tracks: project?.tracks?.length ? project.tracks : [],
      clips: project?.clips ?? [],
    }),
    [project],
  );

  /* ─── History (undo/redo) ─────────────────────────── */
  const history = useTimelineHistory(safeProject);

  // When the parent replaces `project` with something shape-different
  // (e.g. re-seed from storyboard), reset history so we don't let the
  // user "undo" back to the old project.
  const lastProjectRef = useRef(project);
  useEffect(() => {
    if (lastProjectRef.current !== project && project?.tracks?.length !== lastProjectRef.current?.tracks?.length) {
      history.reset(safeProject);
    }
    lastProjectRef.current = project;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  /* ─── Internal state ──────────────────────────────── */
  const [internalPlayhead, setInternalPlayhead] = useState(0);
  const playhead = typeof playheadProp === "number" ? playheadProp : internalPlayhead;
  const setPlayhead = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, safeProject.duration));
      if (onPlayheadChange) onPlayheadChange(clamped);
      else setInternalPlayhead(clamped);
      if (videoRef?.current && isFinite(clamped)) {
        try { videoRef.current.currentTime = clamped / 1000; } catch { /* ignore */ }
      }
    },
    [onPlayheadChange, safeProject.duration, videoRef],
  );

  const [pxPerMs, setPxPerMs] = useState(initialPxPerMs);
  const [snapOn, setSnapOn] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Drag state for clip move / trim.
  type DragState = {
    mode: "move" | "trim-left" | "trim-right";
    primaryId: string;
    originMouseX: number;
    originMouseY: number;
    clipOrigins: Record<string, { start: number; duration: number; trackId: string }>;
    originTrackIndex: number;
  };
  const [drag, setDrag] = useState<DragState | null>(null);

  const railRef = useRef<HTMLDivElement | null>(null);

  /* ─── Project mutation helpers ─────────────────────── */

  const commit = useCallback(
    (next: TimelineProject) => {
      onChange(next);
      history.push(next);
    },
    [onChange, history],
  );

  const commitDebounced = useCallback(
    (next: TimelineProject) => {
      onChange(next);
      history.pushDebounced(next);
    },
    [onChange, history],
  );

  const updateClips = useCallback(
    (mutator: (clips: TimelineClip[]) => TimelineClip[], debounced = false) => {
      const next: TimelineProject = { ...safeProject, clips: mutator(safeProject.clips) };
      if (debounced) commitDebounced(next);
      else commit(next);
    },
    [safeProject, commit, commitDebounced],
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const removable = new Set(
      safeProject.clips.filter((c) => selectedIds.includes(c.id) && !c.locked).map((c) => c.id),
    );
    if (removable.size === 0) return;
    const next: TimelineProject = {
      ...safeProject,
      clips: safeProject.clips.filter((c) => !removable.has(c.id)),
    };
    commit(next);
    setSelectedIds([]);
  }, [safeProject, selectedIds, commit]);

  /* ─── Undo / Redo ──────────────────────────────────── */

  const doUndo = useCallback(() => {
    const snap = history.undo();
    if (snap) onChange(snap);
  }, [history, onChange]);

  const doRedo = useCallback(() => {
    const snap = history.redo();
    if (snap) onChange(snap);
  }, [history, onChange]);

  /* ─── Px <-> ms ────────────────────────────────────── */

  const msToPx = useCallback((ms: number) => ms * pxPerMs, [pxPerMs]);
  const pxToMs = useCallback((px: number) => px / pxPerMs, [pxPerMs]);

  /* ─── Snap logic ───────────────────────────────────── */

  const applySnap = useCallback(
    (candidateMs: number, ignoreClipIds: string[] = []): number => {
      if (!snapOn) return candidateMs;
      const ignore = new Set(ignoreClipIds);
      const targets: number[] = [
        snapToGrid(candidateMs, GRID_MS),
        playhead,
      ];
      for (const c of safeProject.clips) {
        if (ignore.has(c.id)) continue;
        targets.push(c.start, c.start + c.duration);
      }
      let best = candidateMs;
      let bestDelta = Infinity;
      for (const t of targets) {
        const d = Math.abs(candidateMs - t);
        if (d < bestDelta && d <= SNAP_THRESHOLD_MS) {
          best = t;
          bestDelta = d;
        }
      }
      return best;
    },
    [snapOn, playhead, safeProject.clips],
  );

  /* ─── Click selection ──────────────────────────────── */

  const onClipClick = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      e.stopPropagation();
      if (e.shiftKey) {
        setSelectedIds((prev) =>
          prev.includes(clip.id) ? prev.filter((id) => id !== clip.id) : [...prev, clip.id],
        );
      } else {
        setSelectedIds([clip.id]);
      }
    },
    [],
  );

  /* ─── Drag start ───────────────────────────────────── */

  const onClipMouseDown = useCallback(
    (
      e: React.MouseEvent,
      clip: TimelineClip,
      mode: "move" | "trim-left" | "trim-right",
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (clip.locked && mode !== "move") return;
      if (clip.locked) return;

      // Update selection on mousedown so a plain-drag on an unselected clip
      // selects it (without clearing others if shift is held).
      let ids = selectedIds;
      if (!selectedIds.includes(clip.id)) {
        ids = e.shiftKey ? [...selectedIds, clip.id] : [clip.id];
        setSelectedIds(ids);
      }

      const clipOrigins: DragState["clipOrigins"] = {};
      // In trim modes, only trim the primary clip regardless of selection.
      const targetIds = mode === "move" ? ids : [clip.id];
      for (const c of safeProject.clips) {
        if (targetIds.includes(c.id)) {
          clipOrigins[c.id] = { start: c.start, duration: c.duration, trackId: c.trackId };
        }
      }
      const originTrackIndex = Math.max(0, safeProject.tracks.findIndex((t) => t.id === clip.trackId));
      setDrag({
        mode,
        primaryId: clip.id,
        originMouseX: e.clientX,
        originMouseY: e.clientY,
        clipOrigins,
        originTrackIndex,
      });
    },
    [selectedIds, safeProject.clips, safeProject.tracks],
  );

  /* ─── Drag move/up ─────────────────────────────────── */

  useEffect(() => {
    if (!drag) return;

    const tracks = safeProject.tracks;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - drag.originMouseX;
      const dMs = pxToMs(dx);
      const dy = ev.clientY - drag.originMouseY;
      const rowsDelta = Math.round(dy / (TRACK_HEIGHT + TRACK_GAP));

      updateClips((clips) => {
        return clips.map((c) => {
          const origin = drag.clipOrigins[c.id];
          if (!origin) return c;
          if (drag.mode === "move") {
            const rawStart = Math.max(0, origin.start + dMs);
            const snappedStart = applySnap(rawStart, Object.keys(drag.clipOrigins));
            // Vertical drag → change track (only for the primary clip to
            // avoid multi-select crossing tracks in confusing ways).
            let trackId = origin.trackId;
            if (c.id === drag.primaryId && rowsDelta !== 0) {
              const nextIdx = Math.max(
                0,
                Math.min(tracks.length - 1, drag.originTrackIndex + rowsDelta),
              );
              const candidate = tracks[nextIdx];
              if (candidate && !candidate.locked) trackId = candidate.id;
            }
            return { ...c, start: snappedStart, trackId };
          }
          if (drag.mode === "trim-left") {
            const rightEdge = origin.start + origin.duration;
            const rawStart = origin.start + dMs;
            const maxStart = rightEdge - MIN_CLIP_DURATION_MS;
            const snapped = applySnap(
              Math.max(0, Math.min(rawStart, maxStart)),
              [c.id],
            );
            return { ...c, start: snapped, duration: rightEdge - snapped };
          }
          if (drag.mode === "trim-right") {
            const rawEnd = origin.start + origin.duration + dMs;
            const snappedEnd = applySnap(Math.max(origin.start + MIN_CLIP_DURATION_MS, rawEnd), [c.id]);
            return { ...c, duration: Math.max(MIN_CLIP_DURATION_MS, snappedEnd - origin.start) };
          }
          return c;
        });
      }, true);
    };

    const onUp = () => {
      setDrag(null);
      // Force a flush so the final position becomes an undo boundary.
      history.flush();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, pxToMs, applySnap, updateClips, safeProject.tracks, history]);

  /* ─── Rail click — seek & clear selection ─────────── */

  const onRailMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!railRef.current) return;
      const tgt = e.target as HTMLElement;
      if (tgt.dataset.role === "clip" || tgt.dataset.role === "trim-handle") return;
      const rect = railRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ms = Math.max(0, pxToMs(x));
      setPlayhead(applySnap(ms));
      if (!e.shiftKey) setSelectedIds([]);
    },
    [pxToMs, setPlayhead, applySnap],
  );

  /* ─── Keyboard shortcuts ──────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Undo / Redo
      if (isMod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (isMod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        doRedo();
        return;
      }

      // Zoom
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setPxPerMs((z) => Math.min(maxPxPerMs, z * 1.5));
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setPxPerMs((z) => Math.max(minPxPerMs, z / 1.5));
        return;
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      // Play / pause
      if (e.code === "Space") {
        e.preventDefault();
        if (videoRef?.current) {
          if (videoRef.current.paused) void videoRef.current.play();
          else videoRef.current.pause();
        }
        onPlayPause?.();
        return;
      }

      // Nudge playhead
      if (e.key === "ArrowLeft") setPlayhead(playhead - (e.shiftKey ? 1000 : 100));
      else if (e.key === "ArrowRight") setPlayhead(playhead + (e.shiftKey ? 1000 : 100));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    doUndo,
    doRedo,
    selectedIds,
    deleteSelected,
    setPlayhead,
    playhead,
    videoRef,
    onPlayPause,
    minPxPerMs,
    maxPxPerMs,
  ]);

  /* ─── Layout math ─────────────────────────────────── */

  const trackTop = (idx: number) => RULER_HEIGHT + idx * (TRACK_HEIGHT + TRACK_GAP);
  const totalHeight = RULER_HEIGHT + Math.max(1, safeProject.tracks.length) * (TRACK_HEIGHT + TRACK_GAP);
  const railWidth = Math.max(msToPx(safeProject.duration) + 40, 600);
  const ticks = useMemo(
    () => rulerTicks(safeProject.duration, pxPerMs),
    [safeProject.duration, pxPerMs],
  );

  /* ─── Render ───────────────────────────────────────── */

  return (
    <div
      className={`rounded-xl border border-border bg-surface/70 backdrop-blur-sm overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-surface-light/40">
        {onPlayPause !== undefined && (
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
        )}
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

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={doUndo}
          disabled={!history.canUndo}
          className={`text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-[10px]`}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={12} />
        </button>
        <button
          type="button"
          onClick={doRedo}
          disabled={!history.canRedo}
          className={`text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-[10px]`}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={12} />
        </button>

        <div className="mx-2 text-[10px] font-mono text-foreground">
          {formatTime(playhead)} <span className="text-muted">/ {formatTime(safeProject.duration)}</span>
        </div>

        <div className="flex-1" />

        {/* Selected count + delete */}
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={deleteSelected}
            className="flex items-center gap-1 text-[9px] rounded px-2 py-1 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            title="Delete selected (Del)"
          >
            <Trash2 size={10} /> Delete
            <span className="text-[8px] text-muted">({selectedIds.length})</span>
          </button>
        )}

        {/* Snap toggle */}
        <button
          type="button"
          onClick={() => setSnapOn((v) => !v)}
          className={`flex items-center gap-1 text-[9px] rounded px-2 py-1 border transition-colors ${
            snapOn ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
          }`}
          title="Snap to 1-second grid, clip edges & playhead"
        >
          <Magnet size={10} /> Snap
        </button>

        {renderExtraToolbar?.()}

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPxPerMs((z) => Math.max(minPxPerMs, z / 1.5))}
            className="text-muted hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out (-)"
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
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => setPxPerMs((z) => Math.min(maxPxPerMs, z * 1.5))}
            className="text-muted hover:text-foreground"
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <ZoomIn size={12} />
          </button>
        </div>

        <span
          className="text-[8px] text-muted flex items-center gap-1"
          title="Space play/pause · +/- zoom · Shift+click multi-select · Del remove · Ctrl+Z undo · Ctrl+Shift+Z redo"
        >
          <Keyboard size={10} /> shortcuts
        </span>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Track headers */}
        <div className="flex-shrink-0 border-r border-border" style={{ width: TRACK_HEADER_WIDTH }}>
          <div style={{ height: RULER_HEIGHT }} className="border-b border-border bg-surface-light/30" />
          {safeProject.tracks.map((track, i) => (
            <TrackHeader key={track.id} track={track} firstRow={i === 0} />
          ))}
        </div>

        {/* Rail scroller */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative" style={{ height: totalHeight }}>
          <div
            ref={railRef}
            className="relative"
            style={{ width: railWidth, height: totalHeight }}
            onMouseDown={onRailMouseDown}
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

            {/* Snap grid — faint 1s vertical lines when snap is on. */}
            {snapOn && (() => {
              const lines: number[] = [];
              for (let t = 0; t <= safeProject.duration; t += GRID_MS) lines.push(t);
              return lines.map((ms) => (
                <div
                  key={`grid-${ms}`}
                  className="absolute top-0 pointer-events-none"
                  style={{
                    left: msToPx(ms),
                    height: totalHeight,
                    width: 1,
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              ));
            })()}

            {/* Clips */}
            {safeProject.clips.map((clip) => {
              const trackIdx = safeProject.tracks.findIndex((t) => t.id === clip.trackId);
              if (trackIdx < 0) return null;
              const top = trackTop(trackIdx) + 3;
              const left = msToPx(clip.start);
              const width = Math.max(4, msToPx(clip.duration));
              const color =
                clip.color || safeProject.tracks[trackIdx].accent || "#60A5FA";
              const isSelected = selectedIds.includes(clip.id);

              if (clip.isMarker) {
                return (
                  <ClipMarker
                    key={clip.id}
                    clip={clip}
                    top={top}
                    left={left}
                    color={color}
                    isSelected={isSelected}
                    onClick={(e) => onClipClick(e, clip)}
                    onMouseDown={(e) => onClipMouseDown(e, clip, "move")}
                  />
                );
              }

              return (
                <ClipBlock
                  key={clip.id}
                  clip={clip}
                  top={top}
                  left={left}
                  width={width}
                  color={color}
                  isSelected={isSelected}
                  onClick={(e) => onClipClick(e, clip)}
                  onMouseDown={(e, mode) => onClipMouseDown(e, clip, mode)}
                />
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
          No clips on the timeline yet.
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function TrackHeader({ track, firstRow }: { track: TimelineTrack; firstRow: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 border-b border-border/60"
      style={{ height: TRACK_HEIGHT, marginTop: firstRow ? 0 : TRACK_GAP }}
    >
      <span style={{ color: track.accent || undefined }}>{iconForKind(track.kind)}</span>
      <span className="text-[10px] font-mono text-foreground truncate">{track.label}</span>
    </div>
  );
}

interface ClipBlockProps {
  clip: TimelineClip;
  top: number;
  left: number;
  width: number;
  color: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent, mode: "move" | "trim-left" | "trim-right") => void;
}

function ClipBlock({ clip, top, left, width, color, isSelected, onClick, onMouseDown }: ClipBlockProps) {
  return (
    <div
      data-role="clip"
      data-clip-id={clip.id}
      className={`absolute rounded-md overflow-hidden cursor-grab active:cursor-grabbing group ${
        isSelected ? "ring-2 ring-gold" : "ring-1 ring-black/20"
      } ${clip.locked ? "opacity-70 cursor-not-allowed" : ""}`}
      style={{
        top,
        left,
        width,
        height: TRACK_HEIGHT - 6,
        background: `linear-gradient(90deg, ${color}dd, ${color}99)`,
      }}
      onMouseDown={(e) => onMouseDown(e, "move")}
      onClick={onClick}
      title={clip.label}
    >
      {!clip.locked && (
        <>
          <div
            data-role="trim-handle"
            className="absolute left-0 top-0 h-full w-1.5 bg-white/30 hover:bg-white/70 cursor-ew-resize"
            onMouseDown={(e) => onMouseDown(e, "trim-left")}
          />
          <div
            data-role="trim-handle"
            className="absolute right-0 top-0 h-full w-1.5 bg-white/30 hover:bg-white/70 cursor-ew-resize"
            onMouseDown={(e) => onMouseDown(e, "trim-right")}
          />
        </>
      )}

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
    </div>
  );
}

interface ClipMarkerProps {
  clip: TimelineClip;
  top: number;
  left: number;
  color: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function ClipMarker({ clip, top, left, color, isSelected, onClick, onMouseDown }: ClipMarkerProps) {
  return (
    <div
      data-role="clip"
      data-clip-id={clip.id}
      className={`absolute cursor-pointer group ${isSelected ? "ring-2 ring-gold" : ""}`}
      style={{
        top,
        left: left - 1,
        height: TRACK_HEIGHT - 6,
        width: 3,
        background: color,
      }}
      title={clip.label}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <span className="absolute top-0 left-2 whitespace-nowrap text-[8px] text-white/70 group-hover:text-white bg-black/40 px-1 rounded pointer-events-none">
        {clip.label}
      </span>
    </div>
  );
}

export default Timeline;
