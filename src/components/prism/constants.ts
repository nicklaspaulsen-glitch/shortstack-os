/**
 * Prism Split Design System — shared constants
 *
 * The approved prism split look: sharp corners (zero border-radius),
 * red (#2563EB) as hero accent, pure white (#FFFFFF) for emphasis,
 * near-black (#050507) background, white-tinted glass surfaces,
 * JetBrains Mono for data, 3D perspective tilt on hover.
 *
 * Reference: _design-previews/93-prism-dashboard.html
 */

/** Primary prism accent — RED is the hero color */
export const PRISM_RED = "#2563EB";

/** Full prism accent palette — red leads, then cycles through spectrum */
export const PRISM_ACCENTS = [
  "#2563EB", // red (hero)
  "#8B5CF6", // violet
  "#2563EB", // blue
  "#FF5252", // cyan
  "#2563EB", // green
  "#F59E0B", // amber
] as const;

/** Per-tile config — accent color + bottom bar gradient */
export const PRISM_TILES = PRISM_ACCENTS.map((accent) => ({
  accent,
  bar: `from-[${accent}] to-transparent` as const,
}));

/** Signature cubic-bezier easing */
export const PRISM_EASE = [0.32, 0.72, 0, 1] as const;

/** Standard prism motion durations (seconds) */
export const PRISM_DURATION = {
  tile: 0.34,
  panel: 0.44,
  hero: 0.5,
  section: 0.22,
} as const;

/** Stagger delay between sibling tiles (seconds) */
export const PRISM_STAGGER = 0.06;

/** Inline glass surface styles — white-tinted, NOT indigo */
export const PRISM_GLASS = {
  background: "rgba(255,255,255,0.035)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
} as const;

/** Stronger glass for hero/prominent panels */
export const PRISM_GLASS_STRONG = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
} as const;

/** White-tinted borders — NOT indigo. The prism split uses pure white tints */
export const PRISM_BORDERS = {
  subtle: "rgba(255,255,255,0.05)",
  default: "rgba(255,255,255,0.07)",
  strong: "rgba(255,255,255,0.12)",
  hover: "rgba(255,255,255,0.18)",
} as const;

/** Prismatic gradient for the signature top bars (red leads) */
export const PRISM_RAINBOW_GRADIENT =
  "linear-gradient(90deg, #2563EB, #8B5CF6, #2563EB, #FF5252, #2563EB, #F59E0B)";

/** Text color tokens — pure white for emphasis, not off-white */
export const PRISM_TEXT = {
  primary: "#F0F0F4",
  secondary: "#7A7A8E",
  muted: "#4A4A5A",
  accent: "#FFFFFF",
  red: "#2563EB",
} as const;

/** Surface colors */
export const PRISM_SURFACES = {
  bg: "#050507",
  surface1: "rgba(255,255,255,0.025)",
  surface2: "rgba(255,255,255,0.05)",
  surface3: "rgba(255,255,255,0.075)",
} as const;

/** Card shadows — red glow on hover */
export const PRISM_SHADOWS = {
  card: "0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)",
  cardHover: "0 12px 48px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1), 0 0 40px rgba(37,99,235,0.06)",
  panel: "0 8px 32px rgba(0,0,0,0.35)",
} as const;

/** Deep surface color for inset containers */
export const PRISM_SURFACE_DEEP = "#050507";
