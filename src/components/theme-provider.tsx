"use client";

import { useEffect } from "react";

const THEMES: Record<string, { bg: string; surface: string; surfaceLight: string; border: string; accent: string; text: string; muted: string }> = {
  nordic: { bg: "#FAFAF7", surface: "#FFFFFF", surfaceLight: "#F5F3EE", border: "#E8E5E0", accent: "#C9A84C", text: "#374151", muted: "#6B7280" },
  midnight: { bg: "#06080c", surface: "#0c1017", surfaceLight: "#131923", border: "#1e2a3a", accent: "#C9A84C", text: "#e2e8f0", muted: "#64748b" },
  light: { bg: "#f8fafc", surface: "#ffffff", surfaceLight: "#f1f5f9", border: "#e2e8f0", accent: "#C9A84C", text: "#0f172a", muted: "#64748b" },
  ocean: { bg: "#0a1628", surface: "#0f1d32", surfaceLight: "#152440", border: "#1e3a5f", accent: "#38bdf8", text: "#e2e8f0", muted: "#64748b" },
  ember: { bg: "#120a08", surface: "#1a100c", surfaceLight: "#231812", border: "#3a2518", accent: "#f97316", text: "#e2e8f0", muted: "#78716c" },
  forest: { bg: "#071008", surface: "#0d1a10", surfaceLight: "#142218", border: "#1e3a22", accent: "#22c55e", text: "#e2e8f0", muted: "#6b8a6e" },
  purple: { bg: "#0e0812", surface: "#16101e", surfaceLight: "#1e1828", border: "#2e2440", accent: "#a855f7", text: "#e8e0f0", muted: "#8b7aa0" },
  rose: { bg: "#120810", surface: "#1c0e18", surfaceLight: "#241620", border: "#3a1e30", accent: "#f43f5e", text: "#f0e0e8", muted: "#a07888" },
  arctic: { bg: "#0a0f14", surface: "#10171e", surfaceLight: "#182028", border: "#1e3040", accent: "#06b6d4", text: "#e0eaf0", muted: "#6890a0" },
  noir: { bg: "#050505", surface: "#0e0e0e", surfaceLight: "#181818", border: "#282828", accent: "#ffffff", text: "#d0d0d0", muted: "#707070" },
  sunset: { bg: "#100808", surface: "#1a0e0e", surfaceLight: "#241616", border: "#3a2020", accent: "#fb923c", text: "#f0e8e0", muted: "#a08070" },
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Default to "midnight" (dark) so new signups land in a properly
    // themed UI. "nordic" (light cream) was the original default but it
    // fights with our hardcoded-dark sidebar and creates a jarring split:
    // dark chrome + cream content. Dark is the brand intent.
    const saved = localStorage.getItem("ss-theme") || "midnight";
    applyTheme(saved);

    // Hydrate data-theme attribute for CSS variable dark mode overrides
    const isLight = saved === "nordic" || saved === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");

    // Apply saved zoom
    const zoom = localStorage.getItem("ss-zoom");
    if (zoom) document.documentElement.style.zoom = zoom;

    // Apply reduced motion
    if (localStorage.getItem("ss-animations") === "false") {
      document.documentElement.classList.add("reduce-motion");
    }
  }, []);

  return <>{children}</>;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

export function applyTheme(themeId: string) {
  const theme = THEMES[themeId] || THEMES.nordic;
  const root = document.documentElement;

  // Set hex values for direct CSS use
  root.style.setProperty("--color-background", theme.bg);
  root.style.setProperty("--color-surface", theme.surface);
  root.style.setProperty("--color-surface-light", theme.surfaceLight);
  root.style.setProperty("--color-border", theme.border);
  root.style.setProperty("--color-accent", theme.accent);
  root.style.setProperty("--color-text", theme.text);
  root.style.setProperty("--color-muted", theme.muted);

  // Set RGB channel values for Tailwind opacity modifiers (bg-gold/10, etc.)
  root.style.setProperty("--color-background-rgb", hexToRgb(theme.bg));
  root.style.setProperty("--color-surface-rgb", hexToRgb(theme.surface));
  root.style.setProperty("--color-surface-light-rgb", hexToRgb(theme.surfaceLight));
  root.style.setProperty("--color-border-rgb", hexToRgb(theme.border));
  root.style.setProperty("--color-accent-rgb", hexToRgb(theme.accent));
  root.style.setProperty("--color-text-rgb", hexToRgb(theme.text));
  root.style.setProperty("--color-muted-rgb", hexToRgb(theme.muted));

  document.body.style.backgroundColor = theme.bg;
  document.body.style.color = theme.text;

  // Toggle light class for inverted elements
  const isLight = themeId === "nordic" || themeId === "light";
  root.classList.toggle("theme-light", isLight);
  root.classList.toggle("theme-dark", !isLight);

  // Set data-theme attribute for CSS variable overrides
  root.setAttribute("data-theme", isLight ? "light" : "dark");

  // Persist dark mode state for the quick toggle
  localStorage.setItem("ss_theme", isLight ? "light" : "dark");
}
