"use client";
import { Moon, Sun } from "@phosphor-icons/react";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type ThemeId } from "@/components/theme-provider";

/**
 * ThemeToggle — pill button that flips between dark and light. Persists
 * via the ThemeProvider (writes localStorage `ss-theme`). Two visual
 * variants:
 *   - "icon"  small icon-only button for the topbar
 *   - "pill"  labeled pill for settings pages
 */

export interface ThemeToggleProps {
  variant?: "icon" | "pill";
  className?: string;
}

export default function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeId>("light");

  // Sync local state with the html attribute on mount + when the user
  // changes themes from another tab.
  useEffect(() => {
    setTheme(currentTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ss-theme" && (e.newValue === "dark" || e.newValue === "light")) {
        applyTheme(e.newValue);
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleToggle(): void {
    const next: ThemeId = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Switch to light" : "Switch to dark";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-light px-3 py-1.5 text-xs text-text-primary/80 transition-colors hover:border-accent/40 hover:text-text-primary ${className}`}
        aria-label={label}
        title={label}
      >
        <Icon size={13} />
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-light hover:text-text-primary ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon size={15} />
    </button>
  );
}
