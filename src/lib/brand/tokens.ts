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
    subtle: "rgba(99, 102, 241, 0.07)",
    strong: "rgba(99, 102, 241, 0.16)",
  },
  text: {
    primary: "#F5F5F7",
    secondary: "#A8A8B2",
    muted: "#6F6F7A",
  },
  brand: {
    /** The brand accent — INDIGO/VIOLET (May 2). Richer, more editorial.
     *  Three variants:
     *    accent     — indigo-500 (#6366F1) — primary on dark surfaces
     *    accentSoft — violet-400 (#A78BFA) — hover / highlight on dark
     *    accentDim  — indigo-600 (#4F46E5) — primary on LIGHT surfaces (AA on white)
     *  Light theme picks accentDim via globals.css so contrast holds. */
    accent: "#6366F1",
    accentSoft: "#A78BFA",
    accentDim: "#4F46E5",
    accentGlow: "rgba(99, 102, 241, 0.4)",

    /** Legacy alias — `tokens.brand.lime` now resolves to the indigo accent.
     *  Do not introduce new uses; existing call sites are intentionally left
     *  pointing at this so the visual system migrates without a sweeping
     *  refactor of the 100+ pages still referencing it. */
    lime: "#6366F1",
    limeSoft: "#A78BFA",
    limeDim: "#4F46E5",
    limeGlow: "rgba(99, 102, 241, 0.4)",

    /** Editorial complement — neutral charcoal (replaces the old plum). */
    plum: "#1F1F23",
    plumHover: "#2C2C32",

    /** `indigo` alias — resolves to the primary accent. */
    indigo: "#6366F1",
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
  bgBase: "7 7 8",
  bgSurface1: "16 16 18",
  bgSurface2: "23 23 26",
  bgSurface3: "38 38 43",
  textPrimary: "245 245 247",
  textSecondary: "168 168 178",
  textMuted: "111 111 122",
  brandAccent: "99 102 241",
  brandAccentSoft: "167 139 250",
  brandAccentDim: "79 70 229",
  brandLime: "99 102 241",       // legacy alias (= accent)
  brandLimeSoft: "167 139 250",  // legacy alias (= accentSoft)
  brandLimeDim: "79 70 229",     // legacy alias (= accentDim)
  brandPlum: "31 31 35",
  brandPlumHover: "44 44 50",
  brandIndigo: "99 102 241",
  statusSuccess: "127 229 184",
  statusWarning: "255 192 98",
  statusError: "242 96 99",
} as const;
