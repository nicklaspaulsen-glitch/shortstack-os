"use client";

/* ────────────────────────────────────────────────────────────────
 * Premiere-Pro-style multi-track Timeline.
 *
 * File named `premiere-timeline.tsx` to avoid clashing with the
 * existing `timeline.tsx` bridge consumed by the legacy page.
 *
 * Owns:
 *   - ruler rendering (timecode ticks)
 *   - playhead drag/scrub
 *   - ctrl+wheel zoom
 *   - snap-to-playhead / snap-to-clip-edge helper injected into clips
 * ────────────────────────────────────────────────────────────────*/

import {
  useCallback,
  useRef,
  WheelEvent as ReactWheelEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import type { EditorState, EditorAction, Clip } from "@/lib/video-editor/types";
import { snapToTargets, snapToFrame } from "@/lib/video-editor/reducer";
import { Track } from "./track";

export interface PremiereTimelineProps {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  renderPeaks?: (clip: Clip, widthPx: number, heightPx: number) => JSX.Element | null;
  totalDurationMs?: number;
}

const RULER_HEIGHT = 28;
const TRACK_HEIGHT = 52;
const HEADER_W = 144; // w-36

export function msToTc(ms: number, fps: number): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const f = Math.floor(((total % 1000) / 1000) * fps);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function PremiereTimeline({
  state,
  dispatch,
  renderPeaks,
  totalDurationMs,
}: PremiereTimelineProps) {
  const laneRef = useRef<HTMLDivElement | null>(null);

  const {
    tracks,
    clips,
    playhead,
    selection,
    pixelsPerSecond,
    fps,
    markerIn,
    markerOut,
  } = state;
  const totalMs = Math.max(
    totalDurationMs || 0,
    ...clips.map((c) => c.start + c.duration),
    30_000
  );
  const widthPx = (totalMs / 1000) * pixelsPerSecond;

  const buildSnap = useCallback(
    (excludeClipId?: string) => (ms: number) => {
      const targets: number[] = [playhead];
      for (const c of clips) {
        if (c.id === excludeClipId) continue;
        targets.push(c.start);
        targets.push(c.start + c.duration);
      }
      const snapped = snapToTargets(ms, targets, 8, pixelsPerSecond);
      return snapToFrame(snapped, fps);
    },
    [clips, playhead, pixelsPerSecond, fps]
  );

  const onRulerMouseDown = (e: ReactMouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const move = (clientX: number) => {
      const x = clientX - rect.left;
      const ms = Math.max(0, (x / pixelsPerSecond) * 1000);
      dispatch({ type: "SET_PLAYHEAD", ms: snapToFrame(ms, fps) });
    };
    move(e.clientX);
    const mv = (ev: MouseEvent) => move(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const onWheel = (e: ReactWheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    dispatch({ type: "SET_ZOOM", pixelsPerSecond: pixelsPerSecond * factor });
  };

  const ticks: JSX.Element[] = [];
  const totalSeconds = Math.ceil(totalMs / 1000);
  for (let s = 0; s <= totalSeconds; s++) {
    const x = s * pixelsPerSecond;
    const major = s % 5 === 0;
    ticks.push(
      <div
        key={`t-${s}`}
        className={`absolute top-0 ${major ? "h-full" : "h-1/2"} w-px ${
          major ? "bg-neutral-500" : "bg-neutral-700"
        }`}
        style={{ left: `${x}px` }}
      />
    );
    if (major) {
      ticks.push(
        <span
          key={`l-${s}`}
          className="absolute top-0.5 text-[9px] text-neutral-400 font-mono pl-1"
          style={{ left: `${x}px` }}
        >
          {msToTc(s * 1000, fps)}
        </span>
      );
    }
  }

  const playheadX = (playhead / 1000) * pixelsPerSecond;

  return (
    <div
      className="flex flex-col bg-neutral-950 rounded-lg border border-neutral-800 overflow-auto max-h-[60vh]"
      onWheel={onWheel}
    >
      <div className="flex sticky top-0 z-10 bg-neutral-950">
        <div
          className="shrink-0 bg-neutral-900 border-r border-neutral-800 flex items-center justify-center text-[10px] font-mono text-neutral-400"
          style={{ width: HEADER_W }}
        >
          {msToTc(playhead, fps)}
        </div>
        <div
          className="relative flex-1 overflow-hidden bg-neutral-900/60 cursor-col-resize"
          style={{ height: RULER_HEIGHT }}
          onMouseDown={onRulerMouseDown}
        >
          <div className="relative" style={{ width: `${widthPx}px`, height: RULER_HEIGHT }}>
            {ticks}
            {markerIn !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
                style={{ left: `${(markerIn / 1000) * pixelsPerSecond}px` }}
                title="In"
              />
            )}
            {markerOut !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-400"
                style={{ left: `${(markerOut / 1000) * pixelsPerSecond}px` }}
                title="Out"
              />
            )}
          </div>
        </div>
      </div>

      <div className="relative" ref={laneRef}>
        <div className="flex flex-col">
          {tracks.map((t) => (
            <Track
              key={t.id}
              track={t}
              clips={clips}
              pixelsPerSecond={pixelsPerSecond}
              height={TRACK_HEIGHT}
              selection={selection}
              onSelect={(id, additive) =>
                dispatch({
                  type: "SET_SELECTION",
                  ids: additive ? Array.from(new Set([...selection, id])) : [id],
                })
              }
              onMove={(id, start, trackId) =>
                dispatch({ type: "MOVE_CLIP", id, start, trackId })
              }
              onTrim={(id, start, duration, sourceIn) =>
                dispatch({ type: "TRIM_CLIP", id, start, duration, sourceIn })
              }
              onClipDoubleClick={(id) => dispatch({ type: "SET_SELECTION", ids: [id] })}
              onToggleFlag={(flag, value) =>
                dispatch({ type: "SET_TRACK_FLAG", trackId: t.id, flag, value })
              }
              onEmptyClick={(ms) =>
                dispatch({ type: "SET_PLAYHEAD", ms: snapToFrame(ms, fps) })
              }
              renderPeaks={renderPeaks}
              snap={buildSnap(selection[0])}
            />
          ))}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
          style={{ left: `${HEADER_W + playheadX}px` }}
        />
        <div
          className="absolute w-2.5 h-2.5 bg-rose-500 rounded-sm -translate-x-1/2 pointer-events-none"
          style={{ left: `${HEADER_W + playheadX}px`, top: 0 }}
        />
      </div>
    </div>
  );
}
