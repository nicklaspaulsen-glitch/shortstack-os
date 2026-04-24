"use client";

/* ────────────────────────────────────────────────────────────────
 * Waveform — renders pre-computed audio peaks on a canvas.
 *
 * Peaks are stored on the Clip itself (Clip.peaks) by a parent hook
 * that calls extractPeaksFromUrl. If peaks are missing we show a
 * subtle placeholder band.
 * ────────────────────────────────────────────────────────────────*/

import { useEffect, useRef } from "react";
import { renderPeaksToCanvas } from "@/lib/video-editor/audio-peaks";

export interface WaveformProps {
  peaks?: number[];
  widthPx: number;
  heightPx: number;
  accent?: string;
}

export function Waveform({ peaks, widthPx, heightPx, accent = "#F59E0B" }: WaveformProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(heightPx * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    if (!peaks || peaks.length === 0) {
      // Placeholder: centered faint line
      const c = canvas.getContext("2d");
      if (c) {
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.fillStyle = "rgba(255,255,255,0.15)";
        c.fillRect(0, heightPx / 2 - 1, widthPx, 2);
      }
      return;
    }
    renderPeaksToCanvas(canvas, peaks, accent);
  }, [peaks, widthPx, heightPx, accent]);

  return (
    <canvas
      ref={ref}
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, display: "block" }}
    />
  );
}
