"use client";

/**
 * MandalaMark — ShortStack brand mark with a slow 3D-feeling rotation.
 *
 * Apr 28 v3: SVG is INLINED (not loaded via <img src>) so the path's
 * `fill="currentColor"` actually inherits the parent's CSS `color`
 * property. That lets the same component render correctly on:
 *   - dark sidebar  → text-text-primary  (off-white)
 *   - light pages   → text-text-primary  (near-black)
 *   - active state  → text-brand-accent  (indigo)
 * without shipping multiple PNG variants.
 *
 * The mark itself is the 3-tier stacked-shape glyph
 * (`/icons/shortstack-logo.svg` mirror — same path data, kept here so
 * the component is self-contained and doesn't need to fetch over the
 * network on first paint).
 *
 * Spin effect: pure CSS rotateY around the parent's perspective, every
 * 9.5 seconds. Honors prefers-reduced-motion → static.
 *
 * Sizes:  sm=32px (sidebar)  md=64px (page hero)  lg=128px (login)
 *         xl=240px (404, marketing)
 */

import { useEffect, useState } from "react";

export type MandalaMarkSize = "sm" | "md" | "lg" | "xl";

export interface MandalaMarkProps {
  size?: MandalaMarkSize;
  /** Spin animation. Default true. */
  spinning?: boolean;
  className?: string;
}

const SIZE_PX: Record<MandalaMarkSize, number> = {
  sm: 32,
  md: 64,
  lg: 128,
  xl: 240,
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export default function MandalaMark({
  size = "md",
  spinning = true,
  className = "",
}: MandalaMarkProps) {
  const px = SIZE_PX[size];
  const reduce = usePrefersReducedMotion();
  const animate = spinning && !reduce;

  return (
    <span
      className={`mandala-mark inline-flex items-center justify-center ${className}`}
      style={{
        width: px,
        height: px,
        perspective: `${px * 6}px`,
      }}
      aria-hidden="true"
    >
      <span
        className={animate ? "mandala-mark-spinner" : ""}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          willChange: animate ? "transform, filter" : undefined,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width={px}
          height={px}
          role="img"
          aria-label="ShortStack"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            filter: animate
              ? "drop-shadow(0 4px 12px rgba(204, 36, 36,0.25))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,0.10))",
          }}
        >
          <title>ShortStack</title>
          <g fill="currentColor">
            {/* Top tier */}
            <path d="M 56 72 Q 56 50 84 50 Q 128 42 172 50 Q 200 50 200 72 Q 200 94 172 94 Q 128 102 84 94 Q 56 94 56 72 Z" />
            {/* Middle tier */}
            <path d="M 56 128 Q 56 106 84 106 Q 128 98 172 106 Q 200 106 200 128 Q 200 150 172 150 Q 128 158 84 150 Q 56 150 56 128 Z" />
            {/* Bottom tier */}
            <path d="M 56 184 Q 56 162 84 162 Q 128 154 172 162 Q 200 162 200 184 Q 200 206 172 206 Q 128 214 84 206 Q 56 206 56 184 Z" />
          </g>
        </svg>
      </span>
    </span>
  );
}
