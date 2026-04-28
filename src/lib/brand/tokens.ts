// Brand tokens — single source of truth for the ShortStack OS visual system.
// Kept in TypeScript so React components can import them programmatically
// and so the values can be type-checked. Tailwind reads from the same hex
// values via tailwind.config.ts.
//
// Apr 28 direction: pure-monochrome (black/white themes) + a single
// indigo accent that works in both. Replaces the previous OLED + acid-lime
// system. Lime aliases are kept so existing pages don't break, but every
// `lime` value now resolves to the indigo accent.

export const tokens = {
  bg: {
    base: "#070708",
    surface1: "#101012",
    surface2: "#17171A",
    surface3: "#26262B",
  },
  border: {
    subtle: "rgba(94, 91, 255, 0.07)",
    strong: "rgba(94, 91, 255, 0.16)",
  },
  text: {
    primary: "#F5F5F7",
    secondary: "#A8A8B2",
    muted: "#6F6F7A",
  },
  brand: {
    /** The brand accent — indigo. Works on both pure black and pure white. */
    accent: "#5E5BFF",
    accentSoft: "#7B79FF",
    accentDim: "#3D3CB3",
    accentGlow: "rgba(94, 91, 255, 0.4)",

    /** Legacy alias — `tokens.brand.lime` now resolves to the indigo accent.
     *  Do not introduce new uses; existing call sites are intentionally left
     *  pointing at this so the visual system migrates without a sweeping
     *  refactor of the 100+ pages still referencing it. */
    lime: "#5E5BFF",
    limeSoft: "#7B79FF",
    limeDim: "#3D3CB3",
    limeGlow: "rgba(94, 91, 255, 0.4)",

    /** Editorial complement — neutral charcoal (replaces the old plum). */
    plum: "#1F1F23",
    plumHover: "#2C2C32",

    /** Same hex as `accent` — kept as alias for back-compat. */
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
  bgBase: "7 7 8",
  bgSurface1: "16 16 18",
  bgSurface2: "23 23 26",
  bgSurface3: "38 38 43",
  textPrimary: "245 245 247",
  textSecondary: "168 168 178",
  textMuted: "111 111 122",
  brandAccent: "94 91 255",
  brandAccentSoft: "123 121 255",
  brandAccentDim: "61 60 179",
  brandLime: "94 91 255",       // legacy alias (= accent)
  brandLimeSoft: "123 121 255", // legacy alias (= accentSoft)
  brandLimeDim: "61 60 179",    // legacy alias (= accentDim)
  brandPlum: "31 31 35",
  brandPlumHover: "44 44 50",
  brandIndigo: "94 91 255",
  statusSuccess: "127 229 184",
  statusWarning: "255 192 98",
  statusError: "242 96 99",
} as const;
