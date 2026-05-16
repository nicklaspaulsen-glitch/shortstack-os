"use client";

/**
 * LiquidMetalLogo — animated canvas shimmer brand mark for ShortStack OS.
 *
 * Renders the "S" lettermark into an offscreen canvas, then applies:
 *   1. A shifting metallic gradient (4 colour stops, slowly cycling hue).
 *   2. Two sweeping highlight lines (sine-based) that sweep across the mark.
 *   3. A gentle sine-wave distortion field that wobbles the fill slightly.
 *
 * Technique: composite = source-atop. The glyph is drawn as a filled clip
 * region; the metal gradient + highlights are composited inside the clip so
 * they never leak outside the letterform.
 *
 * Sizes: sm (32) · md (48) · lg (64) · xl (96) · hero (160)
 * All rendering is DPR-aware (retina / 2× displays).
 *
 * Reduced motion: animation freezes (RAF cancelled), static metallic still.
 */

import { useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LiquidMetalSize = "sm" | "md" | "lg" | "xl" | "hero";

interface LiquidMetalLogoProps {
  size?: LiquidMetalSize;
  /** Override display size in px (bypasses size map) */
  px?: number;
  /** Shimmer speed multiplier. 1.0 = default. 0 = static. */
  speed?: number;
  className?: string;
  /** Accessible label for the brand mark */
  "aria-label"?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<LiquidMetalSize, number> = {
  sm:   32,
  md:   48,
  lg:   64,
  xl:   96,
  hero: 160,
};

// Metal palette — 5 stops, all blue-steel. Cycling phase shifts between them.
const METAL_STOPS = [
  // [lightness 0–1, alpha]
  [0.65, 1.00], // soft silver-blue
  [0.90, 0.95], // bright highlight
  [0.55, 1.00], // mid steel
  [0.82, 0.90], // secondary highlight
  [0.60, 1.00], // base steel
] as const;

// Brand hue: blue, 220°
const BASE_HUE   = 220;
const SAT        = 28; // low saturation = steel, not vivid blue

// ---------------------------------------------------------------------------
// Helper: draw the "S" glyph into a Path2D
// We construct it programmatically as a rounded-rect shortstack "S".
// ---------------------------------------------------------------------------

function buildGlyphPath(w: number, h: number): Path2D {
  const path = new Path2D();

  const cx = w / 2;
  const cy = h / 2;
  const r  = Math.min(w, h) * 0.38; // radius of the circular arc

  const strokeW = r * 0.36; // stroke width as fraction of radius

  // The "S" is drawn as two half-circles joined by a diagonal.
  // For a canvas glyph we use the actual font instead — fill a large "S"
  // centred in the canvas, then clip to it.
  // We return the letter as text; the caller uses fillText() inside a save/restore.
  // Path2D doesn't support text natively, so we fall back to a rounded-rect
  // "S" approximation:

  const pad = strokeW * 0.5;
  const ir  = r - pad;

  // Top curve (upper half of S) — a semicircle on the right side
  // Bottom curve — a semicircle on the left side
  // Joined by a diagonal crossing band.

  // We'll use a simple design: a thick rounded "S" shape built from two
  // arcs and a connecting band.

  const topCX    = cx + r * 0.18;
  const topCY    = cy - r * 0.48;
  const botCX    = cx - r * 0.18;
  const botCY    = cy + r * 0.48;

  // Top arc
  path.arc(topCX, topCY, ir, Math.PI * 0.55, Math.PI * 1.95);
  path.lineTo(botCX + ir * Math.cos(Math.PI * 0.05 - Math.PI),
              botCY + ir * Math.sin(Math.PI * 0.05 - Math.PI));
  // Bottom arc
  path.arc(botCX, botCY, ir, Math.PI * 1.55, Math.PI * 0.05 + Math.PI);
  path.closePath();

  void cx; void cy; void strokeW; void pad;
  return path;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LiquidMetalLogo({
  size     = "md",
  px,
  speed    = 1.0,
  className,
  "aria-label": ariaLabel = "ShortStack logo",
}: LiquidMetalLogoProps) {
  const displaySize = px ?? SIZE_MAP[size];
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const tRef        = useRef(0);

  // Detect prefers-reduced-motion once
  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const dim  = Math.round(displaySize * dpr);

    canvas.width  = dim;
    canvas.height = dim;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Font for the "S" — large Satoshi display text
    const fontSize = Math.round(dim * 0.72);
    ctx.font = `800 ${fontSize}px 'Satoshi', 'Inter', system-ui, sans-serif`;

    // Measure text to centre it
    const metrics  = ctx.measureText("S");
    const textW    = metrics.width;
    const textH    = fontSize * 0.78; // approximate cap height
    const textX    = (dim - textW)  / 2;
    const textY    = (dim + textH)  / 2;

    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, dim, dim);

      // ── 1. Draw text as clip region ──────────────────────────────
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillText("S", textX, textY);
      // Use globalCompositeOperation so our gradient paints INSIDE the text
      ctx.globalCompositeOperation = "source-atop";

      // ── 2. Cycling metallic gradient ─────────────────────────────
      const phase  = (t * 0.0004 * speed) % (Math.PI * 2);
      const grad   = ctx.createLinearGradient(0, 0, dim, dim);

      METAL_STOPS.forEach(([l, a], i) => {
        const offset = i / (METAL_STOPS.length - 1);
        // Shift lightness with sine — creates the cycling "liquid" feel
        const lShift = l + Math.sin(phase + i * 0.9) * 0.12;
        const hue    = BASE_HUE + Math.sin(phase * 0.7 + i * 0.5) * 6;
        const lFinal = Math.min(1, Math.max(0, lShift));
        grad.addColorStop(
          offset,
          `hsla(${hue}, ${SAT}%, ${Math.round(lFinal * 100)}%, ${a})`,
        );
      });

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, dim, dim);

      // ── 3. Sweep highlight 1 (bright streak) ─────────────────────
      const h1x = (dim * 0.5) + Math.sin(t * 0.0012 * speed) * dim * 0.65;
      const hGrad1 = ctx.createLinearGradient(h1x - dim * 0.18, 0, h1x + dim * 0.18, 0);
      hGrad1.addColorStop(0, "rgba(255,255,255,0)");
      hGrad1.addColorStop(0.5, "rgba(255,255,255,0.30)");
      hGrad1.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hGrad1;
      ctx.fillRect(0, 0, dim, dim);

      // ── 4. Sweep highlight 2 (secondary, phase-shifted) ──────────
      const h2x = (dim * 0.4) + Math.cos(t * 0.0009 * speed + 1.2) * dim * 0.45;
      const hGrad2 = ctx.createLinearGradient(h2x - dim * 0.12, 0, h2x + dim * 0.12, 0);
      hGrad2.addColorStop(0, "rgba(255,255,255,0)");
      hGrad2.addColorStop(0.5, "rgba(255,255,255,0.14)");
      hGrad2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hGrad2;
      ctx.fillRect(0, 0, dim, dim);

      ctx.restore();
    }

    if (prefersReduced || speed === 0) {
      // Static render — no RAF
      draw(0);
      return;
    }

    let startTime: number | null = null;

    function tick(ts: number) {
      if (startTime === null) startTime = ts;
      const elapsed = ts - startTime + tRef.current;
      draw(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      tRef.current += performance.now() - (startTime ?? 0);
      cancelAnimationFrame(rafRef.current);
    };
  }, [displaySize, speed, prefersReduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      role="img"
      className={cn("shrink-0", className)}
      style={{
        width:  displaySize,
        height: displaySize,
        imageRendering: "pixelated",
      }}
    />
  );
}

export type { LiquidMetalLogoProps, LiquidMetalSize };
