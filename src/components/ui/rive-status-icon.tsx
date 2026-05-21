"use client";

/**
 * RiveStatusIcon — progressive-enhancement status dots for ShortStack.
 *
 * Architecture: CSS fallbacks are always rendered first. When a `.riv` file
 * loads from /public/rive/, the Rive canvas replaces the CSS animation.
 * If the file is absent (404) or fails to load, the component stays on the
 * CSS fallback indefinitely — zero visual regression.
 *
 * Drop .riv assets into /public/rive/ to activate:
 *   status-generating.riv  → animated loading dot (blue)
 *   status-live.riv         → animated pulse dot (green / custom color)
 *   status-success.riv      → animated checkmark
 *
 * Usage:
 *   <GeneratingRiveIcon />               // 8px blue pulsing dot
 *   <LiveRiveIcon color="#10b981" />      // 8px green pulsing dot
 *   <SuccessRiveIcon />                   // 14px emerald checkmark
 *   <RiveStatusIcon status="live" size={20} />  // custom size
 */

import React, { useState } from "react";
import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";

// ---------------------------------------------------------------------------
// CSS fallback primitives — pixel-identical to the legacy LiveDot component
// ---------------------------------------------------------------------------

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  const dotSize = Math.max(4, Math.round(size * 0.5));
  return (
    <span
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: dotSize, height: dotSize, backgroundColor: color }}
      />
    </span>
  );
}

function CheckmarkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10b981"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rive loader — mounts canvas only after successful file load
// ---------------------------------------------------------------------------

interface RiveLoaderProps {
  src: string;
  size: number;
  fallback: React.ReactNode;
}

function RiveLoader({ src, size, fallback }: RiveLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const { RiveComponent } = useRive({
    src,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => setLoaded(true),
    onLoadError: () => setErrored(true),
  });

  // Stay on CSS fallback until the .riv file successfully loads
  if (!loaded || errored) {
    return <>{fallback}</>;
  }

  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", width: size, height: size, flexShrink: 0 }}
    >
      <RiveComponent />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RiveStatusState = "generating" | "live" | "success";

interface RiveStatusIconProps {
  status: RiveStatusState;
  /**
   * Pixel size of the icon square.
   * For badge dots: 8. For inline indicators: 14–20.
   */
  size?: number;
  /**
   * Dot color override for "live" and "generating" states.
   * Defaults: live → #10b981 (green), generating → #D4FF00 (lime)
   */
  color?: string;
  /**
   * Custom path to .riv file inside /public/.
   * Defaults to the canonical ShortStack paths:
   *   /rive/status-generating.riv
   *   /rive/status-live.riv
   *   /rive/status-success.riv
   * Pass `null` to force CSS fallback even when the file exists.
   */
  riveSrc?: string | null;
}

const DEFAULT_RIV_PATHS: Record<RiveStatusState, string> = {
  generating: "/rive/status-generating.riv",
  live: "/rive/status-live.riv",
  success: "/rive/status-success.riv",
};

const DEFAULT_COLORS: Record<RiveStatusState, string> = {
  generating: "#D4FF00",
  live: "#10b981",
  success: "#10b981",
};

export function RiveStatusIcon({
  status,
  size = 8,
  color,
  riveSrc,
}: RiveStatusIconProps) {
  const effectiveColor = color ?? DEFAULT_COLORS[status];

  const fallback =
    status === "success" ? (
      <CheckmarkIcon size={size} />
    ) : (
      <PulsingDot color={effectiveColor} size={size} />
    );

  // riveSrc === null → always use CSS fallback (explicit opt-out)
  const src = riveSrc === null ? null : (riveSrc ?? DEFAULT_RIV_PATHS[status]);

  if (!src) return <>{fallback}</>;

  return <RiveLoader src={src} size={size} fallback={fallback} />;
}

// ---------------------------------------------------------------------------
// Convenience wrappers (drop-in replacements for the legacy LiveDot)
// ---------------------------------------------------------------------------

/** Animated generating/deploying indicator — blue pulsing dot */
export function GeneratingRiveIcon({ size = 8 }: { size?: number }) {
  return <RiveStatusIcon status="generating" size={size} />;
}

/** Animated live indicator — green (or custom color) pulsing dot */
export function LiveRiveIcon({
  size = 8,
  color = "#10b981",
}: {
  size?: number;
  color?: string;
}) {
  return <RiveStatusIcon status="live" size={size} color={color} />;
}

/** Animated success indicator — emerald checkmark */
export function SuccessRiveIcon({ size = 14 }: { size?: number }) {
  return <RiveStatusIcon status="success" size={size} />;
}
