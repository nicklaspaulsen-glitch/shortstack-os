"use client";

import { useEffect, useRef } from "react";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface Props {
  segments: TranscriptSegment[];
  fallbackRaw?: string;
  currentTime?: number;
  onSeek?: (ts: number) => void;
}

function formatTs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

function speakerColor(speaker?: string): string {
  if (!speaker) return "text-muted";
  // Stable hue from speaker label — two-speaker case gets gold + blue.
  if (/1/.test(speaker)) return "text-gold";
  if (/2/.test(speaker)) return "text-blue-400";
  if (/3/.test(speaker)) return "text-purple-400";
  return "text-muted";
}

export default function TranscriptViewer({ segments, fallbackRaw, currentTime = 0, onSeek }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active segment into view.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentTime]);

  if (!segments.length) {
    return (
      <div className="text-[11px] text-muted whitespace-pre-wrap leading-relaxed">
        {fallbackRaw || "Transcript not available yet."}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {segments.map((seg, i) => {
        const active = currentTime >= seg.start && currentTime < seg.end;
        const colorClass = speakerColor(seg.speaker);
        return (
          <button
            key={i}
            ref={active ? activeRef : null}
            onClick={() => onSeek?.(seg.start)}
            className={`group w-full text-left flex gap-3 px-2 py-1.5 rounded-md transition-all ${
              active ? "bg-gold/10 ring-1 ring-gold/30" : "hover:bg-white/[0.03]"
            }`}
          >
            <span className="flex-shrink-0 text-[10px] font-mono text-muted w-12 pt-0.5">
              {formatTs(seg.start)}
            </span>
            <span className="flex-1 text-[11px] leading-relaxed">
              {seg.speaker && (
                <span className={`font-semibold ${colorClass} mr-1.5`}>{seg.speaker}:</span>
              )}
              <span className="text-foreground">{seg.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
