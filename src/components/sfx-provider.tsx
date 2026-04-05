"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { sfxClick, sfxPop, sfxWhoosh, sfxSuccess, sfxError, sfxNotification } from "@/lib/sfx";

interface SFXContextType {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
}

const SFXContext = createContext<SFXContextType>({
  enabled: true, setEnabled: () => {}, volume: 0.5, setVolume: () => {},
});

export const useSFX = () => useContext(SFXContext);

export default function SFXProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    const saved = localStorage.getItem("sfx_enabled");
    if (saved === "false") setEnabled(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("sfx_enabled", String(enabled));
  }, [enabled]);

  // Global click listener for SFX
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const el = target.closest("button, a, [role='button'], [class*='btn-'], [class*='card-hover']");
      if (!el) return;

      const classes = el.className || "";
      const tag = el.tagName.toLowerCase();

      // Primary buttons — pop sound
      if (classes.includes("btn-primary")) {
        sfxPop();
        return;
      }

      // Secondary buttons — click
      if (classes.includes("btn-secondary") || classes.includes("btn-danger")) {
        sfxClick();
        return;
      }

      // Navigation links — whoosh
      if (tag === "a" && (el as HTMLAnchorElement).href?.includes("/dashboard")) {
        sfxWhoosh();
        return;
      }

      // Card hovers — subtle click
      if (classes.includes("card-hover")) {
        sfxClick();
        return;
      }

      // Toggle/checkbox — pop
      if (target.closest("input[type='checkbox']") || classes.includes("toggle")) {
        sfxPop();
        return;
      }

      // Default button — light click
      if (tag === "button") {
        sfxClick();
        return;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [enabled]);

  // Listen for toast events to play success/error sounds
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            const text = node.textContent || "";
            if (node.getAttribute("role") === "status" || node.closest("[role='status']")) {
              if (text.includes("success") || text.includes("Success") || text.includes("✓")) {
                sfxSuccess();
              } else if (text.includes("error") || text.includes("Error") || text.includes("Failed")) {
                sfxError();
              } else {
                sfxNotification();
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <SFXContext.Provider value={{ enabled, setEnabled, volume, setVolume }}>
      {children}
    </SFXContext.Provider>
  );
}
