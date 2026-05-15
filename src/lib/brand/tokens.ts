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
    base: "#F3F6FA",
    surface1: "#FFFFFF",
    surface2: "#F1F5F9",
    surface3: "#E2E8F0",
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
    /** The brand accent — PRISM BLUE. Sharp, distinctive.
     *  Three variants:
     *    accent     — #2563EB — AA on white surfaces
     *    accentSoft — #3B82F6 — hover / highlight on light
     *    accentDim  — #1D4ED8 — deep blue for emphasis */
    accent: "#2563EB",
    accentSoft: "#3B82F6",
    accentDim: "#1D4ED8",
    accentGlow: "rgba(37, 99, 235, 0.2)",

    lime: "#2563EB",
    limeSoft: "#3B82F6",
    limeDim: "#1D4ED8",
    limeGlow: "rgba(37, 99, 235, 0.2)",

    /** Editorial complement — light neutral surface. */
    plum: "#F0F0F4",
    plumHover: "#E4E4E7",

    indigo: "#2563EB",
  },
  status: {
    success: "#7FE5B8",
    warning: "#FFC062",
    error: "#3B82F6",
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
  bgBase: "243 246 250",
  bgSurface1: "255 255 255",
  bgSurface2: "241 245 249",
  bgSurface3: "226 232 240",
  textPrimary: "240 240 244",
  textSecondary: "168 168 178",
  textMuted: "74 74 90",
  brandAccent: "37 99 235",
  brandAccentSoft: "59 130 246",
  brandAccentDim: "29 78 216",
  brandLime: "37 99 235",       // legacy alias (= accent)
  brandLimeSoft: "59 130 246",  // legacy alias (= accentSoft)
  brandLimeDim: "29 78 216",    // legacy alias (= accentDim)
  brandPlum: "228 228 231",      // #E4E4E7 — light neutral surface
  brandPlumHover: "212 212 216", // #D4D4D8
  brandIndigo: "37 99 235",
  statusSuccess: "127 229 184",
  statusWarning: "255 192 98",
  statusError: "242 96 99",
} as const;
