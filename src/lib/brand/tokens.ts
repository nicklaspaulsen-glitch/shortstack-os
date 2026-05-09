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
    base: "#FFFFFF",
    surface1: "#FAFAFB",
    surface2: "#F2F2F4",
    surface3: "#E4E4E7",
  },
  border: {
    subtle: "rgba(0, 0, 0, 0.08)",
    strong: "rgba(0, 0, 0, 0.16)",
  },
  text: {
    primary: "#0A0A0B",
    secondary: "#52525B",
    muted: "#A1A1AA",
  },
  brand: {
    /** The brand accent — PRISM RED. Sharp, distinctive.
     *  Three variants:
     *    accent     — #CC2424 — AA on white surfaces
     *    accentSoft — #FF4040 — hover / highlight on light
     *    accentDim  — #991B1B — deep red for emphasis */
    accent: "#CC2424",
    accentSoft: "#FF4040",
    accentDim: "#991B1B",
    accentGlow: "rgba(204, 36, 36, 0.25)",

    lime: "#CC2424",
    limeSoft: "#FF4040",
    limeDim: "#991B1B",
    limeGlow: "rgba(204, 36, 36, 0.25)",

    /** Editorial complement — light neutral surface. */
    plum: "#F0F0F4",
    plumHover: "#E4E4E7",

    indigo: "#CC2424",
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
