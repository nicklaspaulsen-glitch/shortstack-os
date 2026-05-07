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
    /** Base: warm-charcoal grey (not pure black) — glass panels float above.
     *  The gap between base and surface-1 creates the "depth channel". */
    base: "#0A0A0D",
    surface1: "#111114",
    surface2: "#19191D",
    surface3: "#28282E",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.07)",
    strong: "rgba(255, 255, 255, 0.16)",
  },
  text: {
    primary: "#F0F0F4",
    secondary: "#A8A8B2",
    muted: "#4A4A5A",
  },
  brand: {
    /** The brand accent — PRISM RED (May 7). Sharp, distinctive, anti-AI-slop.
     *  Three variants:
     *    accent     — #FF2D2D — primary on dark surfaces (hero red)
     *    accentSoft — #FF6B6B — hover / highlight on dark
     *    accentDim  — #CC2424 — primary on LIGHT surfaces (AA on white)
     *  Prism split: red leads, then rainbow cycle for variety. */
    accent: "#FF2D2D",
    accentSoft: "#FF6B6B",
    accentDim: "#CC2424",
    accentGlow: "rgba(255, 45, 45, 0.4)",

    /** Legacy alias — `tokens.brand.lime` now resolves to the prism red.
     *  Do not introduce new uses; existing call sites are intentionally left
     *  pointing at this so the visual system migrates without a sweeping
     *  refactor of the 100+ pages still referencing it. */
    lime: "#FF2D2D",
    limeSoft: "#FF6B6B",
    limeDim: "#CC2424",
    limeGlow: "rgba(255, 45, 45, 0.4)",

    /** Editorial complement — neutral charcoal (replaces the old plum). */
    plum: "#1F1F23",
    plumHover: "#2C2C32",

    /** `indigo` alias — resolves to the prism red accent. */
    indigo: "#FF2D2D",
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

/**
 * CSS-var-backed sibling tokens (Apr 28 v4).
 *
 * The hex values in `tokens` above are baked-in defaults. Components that
 * need to RESPECT the active theme (light vs dark) at render time should
 * import `themeTokens` instead — every value is a `rgb(var(--name-rgb) / a)`
 * string that the browser resolves against the active theme's CSS vars.
 *
 * Use:
 *   import { themeTokens } from "@/lib/brand/tokens";
 *   <div style={{ background: themeTokens.bg.surface1 }} />
 *
 * Don't use these for hex+alpha string concatenation (e.g.
 * `${tokens.brand.lime}22` for an 0x22 alpha hex). For that path stay
 * with the hex `tokens` export and accept the dark-baked default.
 */
export const themeTokens = {
  bg: {
    base: "rgb(var(--bg-base-rgb) / 1)",
    surface1: "rgb(var(--bg-surface-1-rgb) / 1)",
    surface2: "rgb(var(--bg-surface-2-rgb) / 1)",
    surface3: "rgb(var(--bg-surface-3-rgb) / 1)",
  },
  text: {
    primary: "rgb(var(--text-primary-rgb) / 1)",
    secondary: "rgb(var(--text-secondary-rgb) / 1)",
    muted: "rgb(var(--text-muted-rgb) / 1)",
  },
  brand: {
    accent: "rgb(var(--brand-accent-rgb) / 1)",
    accentSoft: "rgb(var(--brand-accent-soft-rgb) / 1)",
    accentGlow: "rgb(var(--brand-accent-rgb) / 0.4)",
    lime: "rgb(var(--brand-lime-rgb) / 1)",
    limeSoft: "rgb(var(--brand-lime-soft-rgb) / 1)",
    limeGlow: "rgb(var(--brand-lime-rgb) / 0.4)",
    plum: "rgb(var(--brand-plum-rgb) / 1)",
  },
  border: {
    subtle: "rgb(var(--brand-accent-rgb) / 0.08)",
    strong: "rgb(var(--brand-accent-rgb) / 0.20)",
  },
} as const;

/** RGB triplet helpers — Tailwind opacity modifiers need `r g b` strings. */
export const tokenRgb = {
  bgBase: "5 5 7",
  bgSurface1: "16 16 18",
  bgSurface2: "23 23 26",
  bgSurface3: "38 38 43",
  textPrimary: "240 240 244",
  textSecondary: "168 168 178",
  textMuted: "74 74 90",
  brandAccent: "255 45 45",
  brandAccentSoft: "255 107 107",
  brandAccentDim: "204 36 36",
  brandLime: "255 45 45",       // legacy alias (= accent)
  brandLimeSoft: "255 107 107",  // legacy alias (= accentSoft)
  brandLimeDim: "204 36 36",     // legacy alias (= accentDim)
  brandPlum: "31 31 35",
  brandPlumHover: "44 44 50",
  brandIndigo: "255 45 45",
  statusSuccess: "127 229 184",
  statusWarning: "255 192 98",
  statusError: "242 96 99",
} as const;
