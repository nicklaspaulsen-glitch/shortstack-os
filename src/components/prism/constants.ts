/**
 * Prism Design System — shared constants
 *
 * The "prism split" look: per-tile color accents, rainbow top bars,
 * ambient glows, inline glass surfaces, cubic-bezier stagger.
 * Extracted from analytics + clients pages as the canonical reference.
 */

/** Standard prism accent palette — 5 colors that cycle across tiles */
export const PRISM_ACCENTS = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#06B6D4", // cyan
  "#8B5CF6", // violet
  "#F59E0B", // amber
] as const;

/** Per-tile config including tailwind gradient class */
export const PRISM_TILES = PRISM_ACCENTS.map((accent) => ({
  accent,
  bar: `from-[${accent}] to-transparent` as const,
}));

/** Signature cubic-bezier easing — smooth overshoot feel */
export const PRISM_EASE = [0.22, 1, 0.36, 1] as const;

/** Standard prism motion durations (seconds) */
export const PRISM_DURATION = {
  tile: 0.34,
  panel: 0.44,
  hero: 0.48,
  section: 0.22,
} as const;

/** Stagger delay between sibling tiles (seconds) */
export const PRISM_STAGGER = 0.06;

/** Inline glass surface styles — NOT the .glass CSS class */
export const PRISM_GLASS = {
  background: "rgba(255,255,255,0.028)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
} as const;

/** Slightly stronger glass for hero/prominent panels */
export const PRISM_GLASS_STRONG = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const;

/** Indigo-tinted border colors used throughout prism UI */
export const PRISM_BORDERS = {
  subtle: "rgba(99,102,241,0.08)",
  default: "rgba(99,102,241,0.1)",
  strong: "rgba(99,102,241,0.16)",
} as const;

/** Rainbow gradient CSS for the signature top/bottom bars */
export const PRISM_RAINBOW_GRADIENT =
  "linear-gradient(to right, #10B981, #3B82F6, #06B6D4, #8B5CF6, #F59E0B)";

/** Text color tokens matching the prism dark surface */
export const PRISM_TEXT = {
  primary: "#F5F4F1",
  secondary: "#A8A8B2",
  muted: "#6F6D7A",
  accent: "#6366F1",
} as const;

/** Deep surface color for inset containers */
export const PRISM_SURFACE_DEEP = "#0E0D14";
