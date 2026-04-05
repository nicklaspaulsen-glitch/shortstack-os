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
        background: "#06080c",
        surface: "#0c1017",
        "surface-light": "#131923",
        border: "#1e2a3a",
        "border-light": "#2a3a4e",
        gold: "#C9A84C",
        "gold-dark": "#A8893D",
        "gold-light": "#D4B85A",
        accent: "#38bdf8",
        "accent-dark": "#0ea5e9",
        "accent-light": "#7dd3fc",
        muted: "#64748b",
        "muted-light": "#94a3b8",
        danger: "#f43f5e",
        "danger-light": "#fb7185",
        success: "#10b981",
        "success-light": "#34d399",
        warning: "#f59e0b",
        "warning-light": "#fbbf24",
        info: "#3b82f6",
        "info-light": "#60a5fa",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "glow-gold": "radial-gradient(ellipse at center, rgba(201,168,76,0.15) 0%, transparent 70%)",
        "glow-accent": "radial-gradient(ellipse at center, rgba(56,189,248,0.1) 0%, transparent 70%)",
        "gradient-card": "linear-gradient(135deg, rgba(19,25,35,0.8) 0%, rgba(12,16,23,0.9) 100%)",
        "gradient-gold": "linear-gradient(135deg, #C9A84C 0%, #D4B85A 50%, #A8893D 100%)",
        "gradient-accent": "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
        "gradient-sidebar": "linear-gradient(180deg, #0c1017 0%, #080c14 100%)",
        "gradient-header": "linear-gradient(180deg, rgba(6,8,12,0.95) 0%, rgba(6,8,12,0.8) 100%)",
        "mesh": "radial-gradient(at 40% 20%, rgba(56,189,248,0.04) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(201,168,76,0.04) 0px, transparent 50%)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px -3px rgba(201,168,76,0.15)",
        "glow-md": "0 0 25px -5px rgba(201,168,76,0.2)",
        "glow-accent": "0 0 20px -5px rgba(56,189,248,0.2)",
        "card": "0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(30,42,58,0.5)",
        "card-hover": "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          from: { boxShadow: "0 0 10px rgba(201,168,76,0.1)" },
          to: { boxShadow: "0 0 20px rgba(201,168,76,0.25)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
