"use client";

/* ────────────────────────────────────────────────────────────────
 * Clip — a single block on a track.
 *
 * Renders the clip body, drag-to-trim handles on both edges, and a
 * small transition badge when a transition is attached. The parent
 * <Track/> is responsible for positioning.
 * ────────────────────────────────────────────────────────────────*/

import { useRef, useState, useEffect, MouseEvent as ReactMouseEvent } from "react";
import type { Clip as ClipT, Track as TrackT } from "@/lib/video-editor/types";

export interface ClipProps {
  clip: ClipT;
  track: TrackT;
  pixelsPerSecond: number;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, startMs: number, trackId?: string) => void;
  onTrim: (id: string, startMs: number, durationMs: number, sourceIn?: number) => void;
  onDoubleClick?: (id: string) => void;
  renderPeaks?: (clip: ClipT, widthPx: number, heightPx: number) => JSX.Element | null;
  snap?: (ms: number) => number;
}

type DragMode = "move" | "trim-left" | "trim-right" | null;

export function Clip({
  clip,
  track,
  pixelsPerSecond,
  selected,
  onSelect,
  onMove,
  onTrim,
  onDoubleClick,
  renderPeaks,
  snap,
}: ClipProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    mode: DragMode;
    startX: number;
    startMs: number;
    origDur: number;
    origSrcIn: number;
  }>({ mode: null, startX: 0, startMs: 0, origDur: 0, origSrcIn: 0 });

  const leftPx = (clip.start / 1000) * pixelsPerSecond;
  const widthPx = Math.max(24, (clip.duration / 1000) * pixelsPerSecond);

  const onMouseDown = (mode: DragMode) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(clip.id, e.shiftKey || e.metaKey || e.ctrlKey);
    setDrag({
      mode,
      startX: e.clientX,
      startMs: clip.start,
      origDur: clip.duration,
      origSrcIn: clip.sourceIn || 0,
    });
  };

  useEffect(() => {
    if (!drag.mode) return;
    const handleMove = (ev: MouseEvent) => {
      const deltaPx = ev.clientX - drag.startX;
      const deltaMs = (deltaPx / pixelsPerSecond) * 1000;
      if (drag.mode === "move") {
        const raw = drag.startMs + deltaMs;
        const snapped = snap ? snap(raw) : raw;
        onMove(clip.id, snapped);
      } else if (drag.mode === "trim-left") {
        const newStart = Math.max(0, drag.startMs + deltaMs);
        const maxStart = drag.startMs + drag.origDur - 50;
        const clamped = Math.min(newStart, maxStart);
        const snapped = snap ? snap(clamped) : clamped;
        const newDur = drag.origDur - (snapped - drag.startMs);
        const newSrcIn = drag.origSrcIn + (snapped - drag.startMs);
        onTrim(clip.id, snapped, newDur, Math.max(0, newSrcIn));
      } else if (drag.mode === "trim-right") {
        const newDur = Math.max(50, drag.origDur + deltaMs);
        const rawEnd = drag.startMs + newDur;
        const snapped = snap ? snap(rawEnd) : rawEnd;
        onTrim(clip.id, drag.startMs, snapped - drag.startMs, drag.origSrcIn);
      }
    };
    const handleUp = () =>
      setDrag({ mode: null, startX: 0, startMs: 0, origDur: 0, origSrcIn: 0 });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag, pixelsPerSecond, clip.id, onMove, onTrim, snap]);

  const body = clip.color || track.accent;

  return (
    <div
      ref={rootRef}
      className={`absolute top-0 bottom-0 rounded-md select-none overflow-hidden border text-[10px] transition-colors ${
        selected ? "border-white ring-1 ring-white/60" : "border-neutral-900/40"
      }`}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        background: `linear-gradient(180deg, ${body}dd 0%, ${body}aa 100%)`,
        cursor: drag.mode === "move" ? "grabbing" : "grab",
      }}
      onMouseDown={onMouseDown("move")}
      onDoubleClick={() => onDoubleClick?.(clip.id)}
      title={clip.label}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/60"
        onMouseDown={onMouseDown("trim-left")}
        title="Trim start"
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/60"
        onMouseDown={onMouseDown("trim-right")}
        title="Trim end"
      />
      {clip.transitionIn && clip.transitionIn.kind !== "none" && (
        <div
          className="absolute left-1.5 top-0 bottom-0 bg-white/20 pointer-events-none"
          style={{ width: `${(clip.transitionIn.duration / 1000) * pixelsPerSecond}px` }}
          title={`In: ${clip.transitionIn.kind}`}
        />
      )}
      {clip.transitionOut && clip.transitionOut.kind !== "none" && (
        <div
          className="absolute right-1.5 top-0 bottom-0 bg-white/20 pointer-events-none"
          style={{ width: `${(clip.transitionOut.duration / 1000) * pixelsPerSecond}px` }}
          title={`Out: ${clip.transitionOut.kind}`}
        />
      )}
      {track.kind === "audio" && renderPeaks && (
        <div className="absolute inset-x-1.5 top-0 bottom-0 pointer-events-none">
          {renderPeaks(clip, Math.max(1, widthPx - 12), 100)}
        </div>
      )}
      <div className="absolute left-2 top-0.5 right-2 truncate text-white/90 font-mono drop-shadow-[0_1px_0_rgba(0,0,0,0.6)] pointer-events-none">
        {clip.label}
      </div>
    </div>
  );
}
