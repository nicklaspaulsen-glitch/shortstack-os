import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors — respond to applyTheme() CSS variable changes
        background: "rgb(var(--color-background-rgb, 250 250 247) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb, 255 255 255) / <alpha-value>)",
        "surface-light": "rgb(var(--color-surface-light-rgb, 245 243 238) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb, 232 229 224) / <alpha-value>)",
        gold: "rgb(var(--color-accent-rgb, 201 168 76) / <alpha-value>)",
        "gold-dark": "rgb(var(--color-accent-rgb, 201 168 76) / <alpha-value>)",
        "gold-light": "rgb(var(--color-accent-rgb, 201 168 76) / <alpha-value>)",
        foreground: "rgb(var(--color-text-rgb, 55 65 81) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb, 107 114 128) / <alpha-value>)",
        "muted-light": "rgb(var(--color-muted-rgb, 107 114 128) / <alpha-value>)",
        // Static semantic colors — same across all themes
        accent: "#5B8A72",
        "accent-dark": "#4A7660",
        "accent-light": "#7BA896",
        danger: "#EF4444",
        "danger-light": "#FCA5A5",
        success: "#10b981",
        "success-light": "#6EE7B7",
        warning: "#F59E0B",
        "warning-light": "#FCD34D",
        info: "#3B82F6",
        "info-light": "#93C5FD",
        "border-light": "rgb(var(--color-border-rgb, 232 229 224) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        elevated: "0 8px 24px rgba(0,0,0,0.08)",
        soft: "0 2px 8px rgba(0,0,0,0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "slide-in": "slideIn 0.35s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
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
      },
    },
  },
  plugins: [],
};
export default config;
