"use client";

import { useEffect } from "react";

const THEMES: Record<string, { bg: string; surface: string; surfaceLight: string; border: string; accent: string; text: string; muted: string }> = {
  midnight: { bg: "#06080c", surface: "#0c1017", surfaceLight: "#131923", border: "#1e2a3a", accent: "#C9A84C", text: "#e2e8f0", muted: "#64748b" },
  light: { bg: "#f8fafc", surface: "#ffffff", surfaceLight: "#f1f5f9", border: "#e2e8f0", accent: "#C9A84C", text: "#0f172a", muted: "#64748b" },
  ocean: { bg: "#0a1628", surface: "#0f1d32", surfaceLight: "#152440", border: "#1e3a5f", accent: "#38bdf8", text: "#e2e8f0", muted: "#64748b" },
  ember: { bg: "#120a08", surface: "#1a100c", surfaceLight: "#231812", border: "#3a2518", accent: "#f97316", text: "#e2e8f0", muted: "#78716c" },
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("ss-theme") || "midnight";
    applyTheme(saved);

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

export function applyTheme(themeId: string) {
  const theme = THEMES[themeId] || THEMES.midnight;
  const root = document.documentElement;

  root.style.setProperty("--color-background", theme.bg);
  root.style.setProperty("--color-surface", theme.surface);
  root.style.setProperty("--color-surface-light", theme.surfaceLight);
  root.style.setProperty("--color-border", theme.border);
  root.style.setProperty("--color-accent", theme.accent);
  root.style.setProperty("--color-text", theme.text);
  root.style.setProperty("--color-muted", theme.muted);

  document.body.style.backgroundColor = theme.bg;
  document.body.style.color = theme.text;

  // Toggle light class for inverted elements
  if (themeId === "light") {
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  } else {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  }
}
