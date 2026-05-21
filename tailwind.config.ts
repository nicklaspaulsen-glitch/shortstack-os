import type { Config } from "tailwindcss";

// New brand-foundation palette — see src/lib/brand/tokens.ts for the
// authoritative source. Hex values must stay in sync. Old "gold/amber/purple"
// shade names from existing pages stay registered here so 100+ pages don't
// break — they remap to lime/plum/indigo respectively. Anything new should
// reference the new token names directly (`bg-brand-lime`, `bg-bg-surface-1`,
// `text-text-primary`, `border-border-subtle`, etc.).

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────────────────────────────
        // NEW BRAND FOUNDATION TOKENS (canonical names — prefer these in
        // new code. See src/lib/brand/tokens.ts)
        // ─────────────────────────────────────────────────────────────────
        "bg-base": "rgb(var(--bg-base-rgb, 10 10 13) / <alpha-value>)",
        "bg-surface-1": "rgb(var(--bg-surface-1-rgb, 17 17 20) / <alpha-value>)",
        "bg-surface-2": "rgb(var(--bg-surface-2-rgb, 25 25 29) / <alpha-value>)",
        "bg-surface-3": "rgb(var(--bg-surface-3-rgb, 40 40 46) / <alpha-value>)",
        "border-subtle": "rgba(255, 255, 255, 0.07)",
        "border-strong": "rgba(255, 255, 255, 0.16)",
        "text-primary": "rgb(var(--text-primary-rgb, 245 245 247) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary-rgb, 168 168 178) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb, 111 111 122) / <alpha-value>)",
        // Brand — chartreuse lime accent (restored, matching ZIP design system).
        // brand-lime is both the primary accent AND the back-compat alias so
        // existing `bg-brand-lime` / `text-brand-lime/30` etc. continue to work.
        "brand-accent": "rgb(var(--brand-accent-rgb, 212 255 0) / <alpha-value>)",
        "brand-accent-soft": "rgb(var(--brand-accent-soft-rgb, 232 255 77) / <alpha-value>)",
        "brand-accent-dim": "rgb(var(--brand-accent-dim-rgb, 170 204 0) / <alpha-value>)",
        "brand-lime": "rgb(var(--brand-lime-rgb, 212 255 0) / <alpha-value>)",
        "brand-lime-soft": "rgb(var(--brand-lime-soft-rgb, 232 255 77) / <alpha-value>)",
        "brand-lime-dim": "rgb(var(--brand-lime-dim-rgb, 170 204 0) / <alpha-value>)",
        "brand-plum": "rgb(var(--brand-plum-rgb, 31 31 35) / <alpha-value>)",
        "brand-plum-hover": "rgb(var(--brand-plum-hover-rgb, 44 44 50) / <alpha-value>)",
        "brand-indigo": "rgb(var(--brand-indigo-rgb, 99 102 241) / <alpha-value>)",
        // Status
        "status-success": "rgb(var(--status-success-rgb, 127 229 184) / <alpha-value>)",
        "status-warning": "rgb(var(--status-warning-rgb, 255 192 98) / <alpha-value>)",
        "status-error": "rgb(var(--status-error-rgb, 242 96 99) / <alpha-value>)",

        // ─────────────────────────────────────────────────────────────────
        // EXISTING SEMANTIC TOKENS (kept verbatim — the runtime ThemeProvider
        // sets --color-accent-rgb to the active theme; brand-foundation also
        // sets it to lime so everything that reads `text-gold` becomes lime).
        // ─────────────────────────────────────────────────────────────────
        background: "rgb(var(--color-background-rgb, 250 250 247) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb, 255 255 255) / <alpha-value>)",
        "surface-light": "rgb(var(--color-surface-light-rgb, 245 243 238) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb, 232 229 224) / <alpha-value>)",
        // The "gold" alias is replaced below by a full `gold` palette object
        // (DEFAULT + 50..900). DEFAULT keeps the runtime CSS-var pipeline so
        // ThemeProvider can still drive `text-gold` per-theme while shaded
        // utilities like `text-gold-400` resolve to lime values.
        "gold-dark": "rgb(var(--color-accent-rgb, 79 70 229) / <alpha-value>)",
        "gold-light": "rgb(var(--color-accent-rgb, 79 70 229) / <alpha-value>)",
        foreground: "rgb(var(--color-text-rgb, 55 65 81) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb, 107 114 128) / <alpha-value>)",
        "muted-light": "rgb(var(--color-muted-rgb, 107 114 128) / <alpha-value>)",
        accent: "#5B8A72",
        "accent-dark": "#4A7660",
        "accent-light": "#7BA896",
        danger: "#F26063",
        "danger-light": "#FCA5A5",
        success: "#7FE5B8",
        "success-light": "#A7F0CC",
        warning: "#FFC062",
        "warning-light": "#FFD89A",
        info: "#2563EB",
        "info-light": "#3B82F6",
        "border-light": "rgb(var(--color-border-rgb, 232 229 224) / <alpha-value>)",

        // ─────────────────────────────────────────────────────────────────
        // PERIWINKLE + GLASS — May 16 glass overhaul tokens
        // ─────────────────────────────────────────────────────────────────
        "periwinkle": "#6C72AC",
        "periwinkle-soft": "#9CA7DE",
        "periwinkle-bg": "rgba(108,114,172,0.09)",
        "glass-surface": "rgba(255,255,255,0.75)",
        "glass-surface-strong": "rgba(255,255,255,0.88)",

        // ─────────────────────────────────────────────────────────────────
        // BACK-COMPAT SHADE PALETTES — many pages use Tailwind-default
        // `text-amber-300`, `bg-purple-500/20`, etc. We re-register those
        // shade keys so existing utilities keep resolving, but we point them
        // at the new lime / plum / indigo treatment so the visual system
        // unifies. Pages don't need to change; they get the new look for
        // free.
        // ─────────────────────────────────────────────────────────────────
        // Apr 28: gold/amber/lime/purple scales all redirected to the new
        // indigo accent. The aliases stay registered so existing pages
        // (text-gold-400, bg-amber-500/10, border-lime-700, etc.) keep
        // resolving — they just paint indigo now. Plum maps to a charcoal
        // neutral so old purple chrome doesn't fight the monochrome base.
        gold: {
          DEFAULT: "rgb(var(--color-accent-rgb, 212 255 0) / <alpha-value>)",
          50: "#F7FFD4",
          100: "#EEFF99",
          200: "#E8FF4D",
          300: "#D4FF00",
          400: "#AACC00",
          500: "#8AAA00",
          600: "#6B8800",
          700: "#4F6600",
          800: "#374600",
          900: "#202800",
        },
        // amber, purple, green, emerald, teal, cyan, sky — Tailwind defaults
        // render natively. amber/yellow stay literal for warning/paused status
        // indicators. indigo is overridden (→ red scale) below — ~40 pages
        // use indigo-* which would bleed through as Tailwind violet otherwise.
        //
        // NOTE: yellow-* is intentionally NOT shimmed. It remains Tailwind's
        // literal yellow and is used semantically for "paused" / "warning"
        // status indicators across dashboard pages.
        plum: {
          50: "#F4F4F5",
          100: "#E4E4E7",
          200: "#D4D4D8",
          300: "#A1A1AA",
          400: "#52525B",
          500: "#3F3F46",
          600: "#2C2C32",
          700: "#1F1F23",
          800: "#18181B",
          900: "#101012",
        },
        // Indigo — restored to real indigo values (link/secondary accent color).
        indigo: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
        // Lime alias — restored to real lime values.
        lime: {
          50: "#F7FFD4",
          100: "#EEFF99",
          200: "#E8FF4D",
          300: "#D4FF00",
          400: "#AACC00",
          500: "#8AAA00",
          600: "#6B8800",
          700: "#4F6600",
          800: "#374600",
          900: "#202800",
        },
        // Blue alias — redirected to neutral grey/silver so old `bg-blue-600
        // text-white` buttons become grey chrome that stands out on the OLED
        // dark base. White text passes AA on 600+. No color hue — pure neutral.
        blue: {
          50: "#FAFAFA",
          100: "#F0F0F3",
          200: "#E4E4E8",
          300: "#CACAD0",
          400: "#9898A0",
          500: "#6E6E78",
          600: "#4A4A54",
          700: "#383840",
          800: "#28282E",
          900: "#1C1C21",
          950: "#141417",
        },
        // green, emerald, teal, cyan, sky: removed custom overrides.
        // Tailwind defaults render natively for prismatic vibrancy.
      },
      fontFamily: {
        // Body — kept as default font-sans so existing pages don't change.
        sans: ["Inter", "system-ui", "sans-serif"],
        // Display — large headlines, hero numbers, page titles.
        display: ["Satoshi", "Inter", "system-ui", "sans-serif"],
        // Editorial — tight bold sans for eyebrow/section labels.
        editorial: ["Satoshi", "Inter", "system-ui", "sans-serif"],
        // UI — Manrope from ZIP design system: numeric displays, OS chrome,
        // stat counters. Sharp geometric humanist that pairs with Satoshi.
        ui: ["Manrope", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        // Fluid display sizes — clamp(min, preferred, max) for hero/page
        // titles. Use with `font-display` for the brand headline treatment.
        "display-sm": ["clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem)", { lineHeight: "1.05" }],
        "display-md": ["clamp(2.25rem, 1.8rem + 2.2vw, 3.5rem)", { lineHeight: "1.02" }],
        "display-lg": ["clamp(2.5rem, 1.5rem + 4vw, 5rem)", { lineHeight: "1.0" }],
        "display-xl": ["clamp(3rem, 1rem + 7vw, 8rem)", { lineHeight: "0.96" }],
      },
      letterSpacing: {
        "tight-display": "-0.03em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.08), 0 8px 24px -4px rgba(0,0,0,0.12), 0 0 32px -8px rgba(212,255,0,0.04)",
        elevated: "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.1), 0 20px 48px -12px rgba(0,0,0,0.15)",
        soft: "0 1px 4px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.06)",
        // Window-glass depth system — multi-layer shadows for OLED surfaces
        "stack-1": [
          "inset 0 1px 0 rgba(255,255,255,0.06)",
          "0 1px 2px rgba(0,0,0,0.3)",
          "0 4px 16px rgba(0,0,0,0.25)",
          "0 12px 40px -8px rgba(0,0,0,0.4)",
        ].join(", "),
        "stack-2": [
          "inset 0 1px 0 rgba(255,255,255,0.08)",
          "0 2px 4px rgba(0,0,0,0.35)",
          "0 8px 24px rgba(0,0,0,0.3)",
          "0 20px 56px -12px rgba(0,0,0,0.5)",
          "0 0 0 1px rgba(212,255,0,0.06)",
        ].join(", "),
        "stack-3": [
          "inset 0 1px 0 rgba(255,255,255,0.1)",
          "0 4px 8px rgba(0,0,0,0.4)",
          "0 12px 32px rgba(0,0,0,0.35)",
          "0 28px 64px -16px rgba(0,0,0,0.55)",
          "0 0 0 1px rgba(212,255,0,0.08)",
          "0 0 40px -12px rgba(212,255,0,0.10)",
        ].join(", "),
        "lime-glow": "0 0 24px -4px rgba(212,255,0,0.35), 0 0 48px -8px rgba(212,255,0,0.15)",
        // Window glass floating shadow — for stat cards, panels floating above base
        "window": [
          "inset 0 1px 0 rgba(255,255,255,0.06)",
          "0 1px 2px rgba(0,0,0,0.3)",
          "0 4px 16px rgba(0,0,0,0.25)",
          "0 12px 40px -8px rgba(0,0,0,0.4)",
        ].join(", "),
        "window-hover": [
          "inset 0 1px 0 rgba(255,255,255,0.1)",
          "0 2px 4px rgba(0,0,0,0.35)",
          "0 8px 24px rgba(0,0,0,0.3)",
          "0 20px 48px -12px rgba(0,0,0,0.5)",
        ].join(", "),
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "slide-in": "slideIn 0.35s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        // Foundation motion primitives — see globals.css for keyframes.
        "slide-in-up": "slideInUp 480ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "fade-in-foundation": "fadeInFoundation 320ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "lime-pulse": "limePulse 2.4s ease-in-out infinite",
        "stack-rotate": "stackRotate 16s linear infinite",
        // Premium blur-reveal — element fades in from soft blur (impeccable motion ref)
        "blur-reveal": "blurReveal 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        // Shadow bloom pulse — gentle breathing for featured cards
        "shadow-breathe": "shadowBreathe 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInFoundation: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        limePulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,255,0,0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(212,255,0,0)" },
        },
        stackRotate: {
          from: { transform: "rotateY(0deg)" },
          to: { transform: "rotateY(360deg)" },
        },
        blurReveal: {
          from: { opacity: "0", filter: "blur(8px)" },
          to: { opacity: "1", filter: "blur(0px)" },
        },
        shadowBreathe: {
          "0%, 100%": { boxShadow: "0 0 24px -8px rgba(212,255,0,0.08)" },
          "50%": { boxShadow: "0 0 40px -8px rgba(212,255,0,0.16)" },
        },
      },
      transitionTimingFunction: {
        "out-expo-foundation": "cubic-bezier(0.32, 0.72, 0, 1)",
        // Premium expo-out — snappier, more confident (impeccable motion ref)
        "out-expo-premium": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        // Impeccable 100/300/500 duration scale
        100: "100ms",
        220: "220ms",
        300: "300ms",
        320: "320ms",
        480: "480ms",
        500: "500ms",
      },
    },
  },
  plugins: [],
};
export default config;
