// Brand tokens — single source of truth for the ShortStack OS visual system.
// Kept in TypeScript so React components can import them programmatically
// (e.g. <PageHero variant="lime" />) and so the values can be type-checked.
// Tailwind reads from the same hex values via tailwind.config.ts.
//
// Direction: "Editorial Bento × OLED Dark × 3D Depth × Liquid-Glass Accents"
// Brand color: LIME (#B8E000) — deliberately not gold. Slightly softer than
// the original full-saturation neon (#D4FF00) so the brand identity stays
// distinctive without going acid against OLED dark surfaces. Do not introduce
// new gold/amber accents in new pages; the existing aliases remap to lime.

export const tokens = {
  bg: {
    base: "#0A0A0B",
    surface1: "#15141A",
    surface2: "#1F1E26",
    surface3: "#2A2832",
  },
  border: {
    subtle: "rgba(184, 224, 0, 0.07)",
    strong: "rgba(184, 224, 0, 0.16)",
  },
  text: {
    primary: "#F5F4F1",
    secondary: "#9F9DAA",
    muted: "#6F6D7A",
  },
  brand: {
    lime: "#B8E000",
    limeSoft: "#D4FF33",
    limeDim: "#6F8A00",
    limeGlow: "rgba(184, 224, 0, 0.4)",
    plum: "#3F0D2D",
    plumHover: "#5A1B41",
    indigo: "#5E5BFF",
  },
  status: {
    success: "#7FE5B8",
    warning: "#FFC062",
    error: "#F26063",
  },
  motion: {
    standard: "220ms cubic-bezier(0.32, 0.72, 0, 1)",
    heroReveal: "480ms cubic-bezier(0.32, 0.72, 0, 1)",
    pageTransition: "320ms cubic-bezier(0.32, 0.72, 0, 1)",
  },
} as const;

export type BrandTokens = typeof tokens;

/** RGB triplet helpers — Tailwind opacity modifiers need `r g b` strings. */
export const tokenRgb = {
  bgBase: "10 10 11",
  bgSurface1: "21 20 26",
  bgSurface2: "31 30 38",
  bgSurface3: "42 40 50",
  textPrimary: "245 244 241",
  textSecondary: "159 157 170",
  textMuted: "111 109 122",
  brandLime: "184 224 0",
  brandLimeSoft: "212 255 51",
  brandLimeDim: "111 138 0",
  brandPlum: "63 13 45",
  brandPlumHover: "90 27 65",
  brandIndigo: "94 91 255",
  statusSuccess: "127 229 184",
  statusWarning: "255 192 98",
  statusError: "242 96 99",
} as const;
