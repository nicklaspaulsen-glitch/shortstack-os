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
        "bg-base": "rgb(var(--bg-base-rgb, 10 10 11) / <alpha-value>)",
        "bg-surface-1": "rgb(var(--bg-surface-1-rgb, 21 20 26) / <alpha-value>)",
        "bg-surface-2": "rgb(var(--bg-surface-2-rgb, 31 30 38) / <alpha-value>)",
        "bg-surface-3": "rgb(var(--bg-surface-3-rgb, 42 40 50) / <alpha-value>)",
        "border-subtle": "rgba(212, 255, 0, 0.08)",
        "border-strong": "rgba(212, 255, 0, 0.18)",
        "text-primary": "rgb(var(--text-primary-rgb, 245 244 241) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary-rgb, 159 157 170) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb, 111 109 122) / <alpha-value>)",
        // Brand
        "brand-lime": "rgb(var(--brand-lime-rgb, 212 255 0) / <alpha-value>)",
        "brand-lime-soft": "rgb(var(--brand-lime-soft-rgb, 232 255 102) / <alpha-value>)",
        "brand-lime-dim": "rgb(var(--brand-lime-dim-rgb, 138 159 0) / <alpha-value>)",
        "brand-plum": "rgb(var(--brand-plum-rgb, 63 13 45) / <alpha-value>)",
        "brand-plum-hover": "rgb(var(--brand-plum-hover-rgb, 90 27 65) / <alpha-value>)",
        "brand-indigo": "rgb(var(--brand-indigo-rgb, 94 91 255) / <alpha-value>)",
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
        "gold-dark": "rgb(var(--color-accent-rgb, 212 255 0) / <alpha-value>)",
        "gold-light": "rgb(var(--color-accent-rgb, 212 255 0) / <alpha-value>)",
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
        info: "#5E5BFF",
        "info-light": "#9290FF",
        "border-light": "rgb(var(--color-border-rgb, 232 229 224) / <alpha-value>)",

        // ─────────────────────────────────────────────────────────────────
        // BACK-COMPAT SHADE PALETTES — many pages use Tailwind-default
        // `text-amber-300`, `bg-purple-500/20`, etc. We re-register those
        // shade keys so existing utilities keep resolving, but we point them
        // at the new lime / plum / indigo treatment so the visual system
        // unifies. Pages don't need to change; they get the new look for
        // free.
        // ─────────────────────────────────────────────────────────────────
        gold: {
          DEFAULT: "rgb(var(--color-accent-rgb, 212 255 0) / <alpha-value>)",
          50: "#FAFFE0",
          100: "#F5FFC2",
          200: "#EBFF85",
          300: "#E2FF52",
          400: "#D9FF26",
          500: "#D4FF00", // lime
          600: "#B8E000",
          700: "#8A9F00",
          800: "#5C6B00",
          900: "#2E3500",
        },
        amber: {
          50: "#FAFFE0",
          100: "#F5FFC2",
          200: "#EBFF85",
          300: "#E2FF52",
          400: "#D9FF26",
          500: "#D4FF00",
          600: "#B8E000",
          700: "#8A9F00",
          800: "#5C6B00",
          900: "#2E3500",
        },
        // Plum scale replaces the old purple gradient. Existing
        // `bg-purple-500/20` / `text-purple-400` etc. now read as deeper,
        // editorial plum tones — closer to the brand than mass-market
        // Tailwind purple.
        purple: {
          50: "#F5E6F1",
          100: "#E6C9DC",
          200: "#CE94B9",
          300: "#B65F95",
          400: "#7A2D5A",
          500: "#5A1B41",
          600: "#3F0D2D",
          700: "#2E0921",
          800: "#1F0617",
          900: "#10030B",
        },
        plum: {
          50: "#F5E6F1",
          100: "#E6C9DC",
          200: "#CE94B9",
          300: "#B65F95",
          400: "#7A2D5A",
          500: "#5A1B41",
          600: "#3F0D2D",
          700: "#2E0921",
          800: "#1F0617",
          900: "#10030B",
        },
        // Indigo scale — for focus rings, links, single chromatic moments.
        indigo: {
          50: "#EFEEFF",
          100: "#DCDAFF",
          200: "#BBB7FF",
          300: "#9290FF",
          400: "#7773FF",
          500: "#5E5BFF",
          600: "#4946D6",
          700: "#3835A8",
          800: "#27257A",
          900: "#16154D",
        },
        lime: {
          50: "#FAFFE0",
          100: "#F5FFC2",
          200: "#EBFF85",
          300: "#E2FF52",
          400: "#D9FF26",
          500: "#D4FF00",
          600: "#B8E000",
          700: "#8A9F00",
          800: "#5C6B00",
          900: "#2E3500",
        },
      },
      fontFamily: {
        // Body — kept as default font-sans so existing pages don't change.
        sans: ["Inter", "system-ui", "sans-serif"],
        // Display — large headlines, hero numbers, page titles.
        display: ["Satoshi", "Inter", "system-ui", "sans-serif"],
        // Editorial — RESERVED for hero/marketing one-off statements.
        // Never set as body. Apply via `.font-editorial` class.
        editorial: ['"Bodoni Moda"', "Georgia", "serif"],
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
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        elevated: "0 8px 24px rgba(0,0,0,0.08)",
        soft: "0 2px 8px rgba(0,0,0,0.04)",
        // New OLED-friendly multi-layer shadows for the lime/plum surfaces.
        "stack-1": [
          "0 1px 0 rgba(255,255,255,0.04) inset",
          "0 2px 4px rgba(0,0,0,0.45)",
          "0 8px 24px -8px rgba(0,0,0,0.55)",
        ].join(", "),
        "stack-2": [
          "0 1px 0 rgba(255,255,255,0.06) inset",
          "0 4px 8px rgba(0,0,0,0.5)",
          "0 16px 40px -12px rgba(0,0,0,0.6)",
          "0 0 0 1px rgba(212,255,0,0.06)",
        ].join(", "),
        "stack-3": [
          "0 1px 0 rgba(255,255,255,0.08) inset",
          "0 6px 12px rgba(0,0,0,0.55)",
          "0 24px 56px -16px rgba(0,0,0,0.65)",
          "0 0 0 1px rgba(212,255,0,0.12)",
          "0 0 32px -8px rgba(212,255,0,0.18)",
        ].join(", "),
        "lime-glow": "0 0 24px -4px rgba(212,255,0,0.4)",
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
      },
      transitionTimingFunction: {
        "out-expo-foundation": "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        220: "220ms",
        320: "320ms",
        480: "480ms",
      },
    },
  },
  plugins: [],
};
export default config;
