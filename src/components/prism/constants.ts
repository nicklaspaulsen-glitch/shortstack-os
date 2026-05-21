/**
 * Prism Split Design System — shared constants (light-theme edition)
 *
 * Updated May 10 for the light × glass × blue brand direction.
 * PRISM_GLASS and PRISM_BORDERS now use light-theme values — frosted white
 * over the #F3F6FA base with blue accent glows. Dark OLED values removed.
 *
 * Reference: _design-previews/93-prism-dashboard.html
 */

/** Primary brand accent — blue */
export const PRISM_ACCENT = "#2563EB";
/** @deprecated Use PRISM_ACCENT instead */
export const PRISM_RED = PRISM_ACCENT;

/** Brand accent palette — blue-dominant with restrained secondary tones */
export const PRISM_ACCENTS = [
  "#2563EB", // blue (hero)
  "#1D4ED8", // blue-dark
  "#3B82F6", // blue-light
  "#2563EB", // blue (repeat)
  "#1D4ED8", // blue-dark
  "#3B82F6", // blue-light
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

/** Inline glass surface styles — frosted white for light theme */
export const PRISM_GLASS = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(24px) saturate(1.8)",
  WebkitBackdropFilter: "blur(24px) saturate(1.8)",
} as const;

/** Stronger glass for hero/prominent panels */
export const PRISM_GLASS_STRONG = {
  background: "rgba(255,255,255,0.94)",
  backdropFilter: "blur(32px) saturate(1.8)",
  WebkitBackdropFilter: "blur(32px) saturate(1.8)",
} as const;

/** Light-theme borders — dark tints for visibility on white surfaces */
export const PRISM_BORDERS = {
  subtle: "rgba(0,0,0,0.06)",
  default: "rgba(0,0,0,0.08)",
  strong: "rgba(0,0,0,0.14)",
  hover: "rgba(212,255,0,0.18)",
} as const;

/** Accent gradient for signature top bars — blue shimmer, not rainbow */
export const PRISM_RAINBOW_GRADIENT =
  "linear-gradient(90deg, #1D4ED8, #2563EB, #3B82F6, #2563EB, #1D4ED8)";

/** Text color tokens — light-theme values */
export const PRISM_TEXT = {
  primary: "#111827",
  secondary: "#374151",
  muted: "#6B7280",
  accent: "#2563EB",
  /** @deprecated Use accent instead */
  red: "#2563EB",
} as const;

/** Surface colors — light-theme */
export const PRISM_SURFACES = {
  bg: "#F3F6FA",
  surface1: "rgba(255,255,255,0.70)",
  surface2: "rgba(255,255,255,0.88)",
  surface3: "rgba(255,255,255,0.95)",
} as const;

/** Card shadows — light-theme depth + blue glow on hover */
export const PRISM_SHADOWS = {
  card: "0 1px 0 rgba(255,255,255,1) inset, 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08), 0 0 32px -8px rgba(212,255,0,0.06)",
  cardHover: "0 1px 0 rgba(255,255,255,1) inset, 0 2px 8px rgba(0,0,0,0.08), 0 8px 24px -6px rgba(0,0,0,0.12), 0 0 48px -12px rgba(212,255,0,0.14)",
  panel: "0 1px 0 rgba(255,255,255,1) inset, 0 4px 16px rgba(0,0,0,0.08), 0 0 32px -8px rgba(212,255,0,0.08)",
} as const;

/** Inset container surface — light-theme */
export const PRISM_SURFACE_DEEP = "#F8FAFC";
