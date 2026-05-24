"use client";
import { Crosshair, Eye } from "@phosphor-icons/react";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ss_dashboard_focus_mode";

export function useFocusMode() {
  const [focus, setFocus] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === "1") setFocus(true);
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, focus ? "1" : "0");
    } catch {}
  }, [focus]);

  return { focus, setFocus, toggle: () => setFocus(f => !f) };
}

export function FocusModeToggle({ focus, onToggle }: { focus: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={focus ? "Exit focus mode" : "Enter focus mode"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
        focus
          ? "bg-[rgba(212,255,0,0.08)] border-[rgba(212,255,0,0.3)] text-[#D4FF00] shadow-[0_0_18px_-4px_rgba(212,255,0,0.4)]"
          : "bg-surface border-border-subtle text-text-muted hover:border-[rgba(212,255,0,0.2)] hover:text-text-primary"
      }`}
    >
      {focus ? <Crosshair size={12} /> : <Eye size={12} />}
      {focus ? "Crosshair Mode" : "Crosshair"}
    </button>
  );
}

export function CommandPaletteHint() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  function openPalette() {
    // Dispatch the same shortcut the palette listens for
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  return (
    <button
      onClick={openPalette}
      title="Quick search"
      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-surface text-[11px] text-text-muted hover:border-[rgba(212,255,0,0.2)] hover:text-text-primary transition-all"
    >
      <kbd className="text-[9px] font-mono bg-surface-light px-1 py-0.5 rounded border border-border-subtle/50">
        {isMac ? "⌘" : "Ctrl"}
      </kbd>
      <kbd className="text-[9px] font-mono bg-surface-light px-1 py-0.5 rounded border border-border-subtle/50">K</kbd>
      <span className="text-[10px]">Quick Search</span>
    </button>
  );
}
