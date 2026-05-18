"use client";

import { useEffect } from "react";

/**
 * ThemeProvider — only two permanent themes: pure black ("dark") and pure
 * white ("light"). One accent color (indigo `#5E5BFF`) works against both.
 *
 * Why the rewrite (Apr 28): the previous palette was acid-lime against
 * OLED black, which the user described as "ugly". The lime came across
 * as too neon / too youth-marketing for a premium agency OS. Replaced
 * with a disciplined pure-monochrome system + a single chromatic accent.
 *
 * White-label override (`--wl-primary`) still wins over both — agencies
 * branding their portal can pick any accent they want without touching
 * this file.
 */

export type ThemeId = "dark" | "light";

interface ThemeDef {
  bg: string;
  surface: string;
  surfaceLight: string;
  border: string;
  accent: string;        // indigo accent — same in both themes
  accentSoft: string;    // tinted variant for hover states
  accentDim: string;     // muted variant for disabled / secondary
  text: string;
  muted: string;
}

const THEMES: Record<ThemeId, ThemeDef> = {
  dark: {
    bg: "#020711",                // Trinity OS matte-black — matches globals.css
    surface: "#0D1120",            // panels (Trinity surface-1)
    surfaceLight: "#131827",       // hover / raised (Trinity surface-2)
    border: "#2A3350",
    accent: "#3B82F6",             // blue — matches globals.css dark override
    accentSoft: "#60A5FA",
    accentDim: "#2563EB",
    text: "#F0F0F4",               // off-white, never pure
    muted: "#A8A8B2",
  },
  light: {
    bg: "#F3F6FA",                // light blue-gray base — matches globals.css
    surface: "#FFFFFF",
    surfaceLight: "#F1F5F9",
    border: "#E2E8F0",
    accent: "#2563EB",             // blue — AA contrast on white
    accentSoft: "#3B82F6",
    accentDim: "#1D4ED8",
    text: "#0A0A0B",               // pure black for body
    muted: "#52525B",
  },
};

const STORAGE_KEY = "ss-theme";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // May 17 v3 migration — switch default from light → dark (OLED glass overhaul).
    // Clears the v2 migration key and any stored "light" preference so all
    // users land on the new dark OLED default. Users who explicitly want
    // light can toggle it back via ThemeToggle.
    const MIGRATION_KEY_V3 = "ss-theme-migrated-v3";
    if (!localStorage.getItem(MIGRATION_KEY_V3)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("ss_theme");
      localStorage.removeItem("ss-theme-migrated-v2");
      localStorage.setItem(MIGRATION_KEY_V3, "1");
    }

    // Resolve initial theme: explicit user choice → dark OLED (May 17 default).
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeId | null);
    const initial: ThemeId = saved ?? "dark";
    applyTheme(initial);

    // Apply saved zoom + reduced-motion if previously set.
    const zoom = localStorage.getItem("ss-zoom");
    if (zoom) document.documentElement.style.zoom = zoom;
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

/**
 * Apply a theme to <html>. Sets CSS custom properties (so any component
 * referencing `var(--color-accent)` updates instantly), toggles the
 * `theme-light` / `theme-dark` classes, and persists the choice.
 *
 * Accepts both modern ids ("dark" | "light") and legacy ids from the
 * previous 11-theme palette (e.g. "midnight", "nordic", "noir") so old
 * cookies / localStorage entries still resolve cleanly.
 */
export function applyTheme(themeId: string): void {
  const id = normalizeThemeId(themeId);
  const theme = THEMES[id];
  const root = document.documentElement;

  // Hex values for direct CSS use.
  root.style.setProperty("--color-background", theme.bg);
  root.style.setProperty("--color-surface", theme.surface);
  root.style.setProperty("--color-surface-light", theme.surfaceLight);
  root.style.setProperty("--color-border", theme.border);
  root.style.setProperty("--color-accent", theme.accent);
  root.style.setProperty("--color-accent-soft", theme.accentSoft);
  root.style.setProperty("--color-accent-dim", theme.accentDim);
  root.style.setProperty("--color-text", theme.text);
  root.style.setProperty("--color-muted", theme.muted);
  root.style.setProperty("--color-foreground", theme.text);

  // RGB channel values for Tailwind opacity modifiers (bg-accent/10, etc.)
  root.style.setProperty("--color-background-rgb", hexToRgb(theme.bg));
  root.style.setProperty("--color-surface-rgb", hexToRgb(theme.surface));
  root.style.setProperty("--color-surface-light-rgb", hexToRgb(theme.surfaceLight));
  root.style.setProperty("--color-border-rgb", hexToRgb(theme.border));
  root.style.setProperty("--color-accent-rgb", hexToRgb(theme.accent));
  root.style.setProperty("--color-accent-soft-rgb", hexToRgb(theme.accentSoft));
  root.style.setProperty("--color-accent-dim-rgb", hexToRgb(theme.accentDim));
  root.style.setProperty("--color-text-rgb", hexToRgb(theme.text));
  root.style.setProperty("--color-muted-rgb", hexToRgb(theme.muted));

  // Re-point legacy brand-foundation variables (lime/plum) at the new
  // monochrome+indigo system so the ~100 existing pages keep working.
  root.style.setProperty("--bg-base", theme.bg);
  root.style.setProperty("--bg-surface-1", theme.surface);
  root.style.setProperty("--bg-surface-2", theme.surfaceLight);
  root.style.setProperty("--bg-surface-3", theme.border);
  root.style.setProperty("--text-primary", theme.text);
  root.style.setProperty("--text-secondary", theme.muted);
  root.style.setProperty("--text-text-muted", theme.muted);
  root.style.setProperty("--brand-lime", theme.accent);            // legacy alias
  root.style.setProperty("--brand-lime-soft", theme.accentSoft);   // legacy alias
  root.style.setProperty("--brand-lime-dim", theme.accentDim);     // legacy alias
  root.style.setProperty("--brand-lime-glow", `rgba(${hexToRgb(theme.accent).split(" ").join(",")}, 0.4)`);
  root.style.setProperty("--brand-lime-rgb", hexToRgb(theme.accent));
  root.style.setProperty("--brand-indigo", theme.accent);
  root.style.setProperty("--brand-indigo-rgb", hexToRgb(theme.accent));
  root.style.setProperty("--border-subtle", `rgba(${hexToRgb(theme.accent).split(" ").join(",")}, 0.08)`);
  root.style.setProperty("--border-strong", `rgba(${hexToRgb(theme.accent).split(" ").join(",")}, 0.18)`);

  document.body.style.backgroundColor = theme.bg;
  document.body.style.color = theme.text;

  // Class + attribute toggles so CSS rules that select on theme work.
  root.classList.toggle("theme-light", id === "light");
  root.classList.toggle("theme-dark", id === "dark");
  root.setAttribute("data-theme", id);

  // Persist for SSR pre-paint script + future sessions.
  localStorage.setItem(STORAGE_KEY, id);
  localStorage.setItem("ss_theme", id); // legacy key, kept for back-compat
}

/**
 * Map the previous 11-theme ids onto the new 2-theme system. Anything
 * light-coded resolves to "light"; everything else to "dark".
 */
function normalizeThemeId(themeId: string): ThemeId {
  if (themeId === "light" || themeId === "nordic") return "light";
  return "dark";
}

/** Read the current theme without subscribing. */
export function currentTheme(): ThemeId {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

/** Flip between dark and light. */
export function toggleTheme(): ThemeId {
  const next: ThemeId = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
