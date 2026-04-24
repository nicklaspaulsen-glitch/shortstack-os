"use client";

/* ────────────────────────────────────────────────────────────────
 * Track — horizontal lane hosting Clips.
 * ────────────────────────────────────────────────────────────────*/

import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import type { Clip as ClipT, Track as TrackT } from "@/lib/video-editor/types";
import { Clip } from "./clip";

export interface TrackProps {
  track: TrackT;
  clips: ClipT[];
  pixelsPerSecond: number;
  height?: number;
  selection: string[];
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, startMs: number, trackId?: string) => void;
  onTrim: (id: string, startMs: number, durationMs: number, sourceIn?: number) => void;
  onClipDoubleClick?: (id: string) => void;
  onToggleFlag: (flag: "muted" | "hidden" | "locked" | "solo", value: boolean) => void;
  onEmptyClick?: (ms: number) => void;
  renderPeaks?: (clip: ClipT, widthPx: number, heightPx: number) => JSX.Element | null;
  snap?: (ms: number) => number;
}

export function Track({
  track,
  clips,
  pixelsPerSecond,
  height = 52,
  selection,
  onSelect,
  onMove,
  onTrim,
  onClipDoubleClick,
  onToggleFlag,
  onEmptyClick,
  renderPeaks,
  snap,
}: TrackProps) {
  const trackClips = clips.filter((c) => c.trackId === track.id);

  return (
    <div className="flex border-b border-neutral-800/80" style={{ height }}>
      <div
        className="w-36 shrink-0 border-r border-neutral-800 bg-neutral-900/70 flex items-center gap-1 px-2 text-[11px] text-neutral-300"
        style={{ height }}
      >
        <div className="w-1 h-5 rounded-full" style={{ background: track.accent }} />
        <span className="font-mono uppercase flex-1 truncate">{track.label}</span>
        {track.kind === "audio" && (
          <button
            type="button"
            className="p-0.5 text-neutral-400 hover:text-white"
            onClick={() => onToggleFlag("muted", !track.muted)}
            title={track.muted ? "Unmute" : "Mute"}
          >
            {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        )}
        {track.kind === "video" && (
          <button
            type="button"
            className="p-0.5 text-neutral-400 hover:text-white"
            onClick={() => onToggleFlag("hidden", !track.hidden)}
            title={track.hidden ? "Show" : "Hide"}
          >
            {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
        <button
          type="button"
          className="p-0.5 text-neutral-400 hover:text-white"
          onClick={() => onToggleFlag("locked", !track.locked)}
          title={track.locked ? "Unlock" : "Lock"}
        >
          {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      </div>

      <div
        className="relative flex-1 bg-neutral-950/50"
        onClick={(e) => {
          if (e.target !== e.currentTarget || !onEmptyClick) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ms = (x / pixelsPerSecond) * 1000;
          onEmptyClick(Math.max(0, ms));
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${
              pixelsPerSecond - 1
            }px, rgba(255,255,255,0.04) ${pixelsPerSecond - 1}px, rgba(255,255,255,0.04) ${pixelsPerSecond}px)`,
          }}
        />

        {trackClips.map((clip) => (
          <Clip
            key={clip.id}
            clip={clip}
            track={track}
            pixelsPerSecond={pixelsPerSecond}
            selected={selection.includes(clip.id)}
            onSelect={onSelect}
            onMove={onMove}
            onTrim={onTrim}
            onDoubleClick={onClipDoubleClick}
            renderPeaks={renderPeaks}
            snap={snap}
          />
        ))}
      </div>
    </div>
  );
}
