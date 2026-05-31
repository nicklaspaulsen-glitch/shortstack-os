"use client";
import { MagnifyingGlass } from "@phosphor-icons/react";


/**
 * GlobalSearch — header trigger button only.
 *
 * All search logic (Cmd+K, live DB search, keyboard nav) now lives
 * exclusively in CommandPalette. This component is a pure UI button
 * that fires the "open-command-palette" custom event.
 *
 * Removing the duplicate Cmd+K listener here eliminates the bug where
 * both modals opened simultaneously on Ctrl+K.
 */
export default function GlobalSearch() {
  function openPalette() {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }

  return (
    <button
      onClick={openPalette}
      aria-label="Open search (Ctrl+K)"
      className="flex items-center gap-2 bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-muted hover:border-[rgba(212,255,0,0.25)] transition-colors"
    >
      <MagnifyingGlass size={14} />
      <span>Search...</span>
      <kbd className="text-xs bg-surface-light px-1.5 py-0.5 rounded">Ctrl+K</kbd>
    </button>
  );
}
