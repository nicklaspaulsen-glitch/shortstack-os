"use client";

/**
 * TrinityWebSearch — lazy panel stub for the in-orb web search drawer.
 *
 * Wired up so the shell can lazy-load the panel when the user clicks a
 * "search the web" quick-action suggestion in the future. For now the
 * live implementation is handled server-side inside /api/trinity-assistant
 * (Trinity already calls a web search tool when it decides to), so this
 * component just renders a compact inline notice that web search is
 * available through the normal chat input. Keeping the file in place so
 * future drawer work plugs in without touching the orb shell.
 */

import { Globe } from "lucide-react";

interface Props {
  onDismiss?: () => void;
}

export default function TrinityWebSearch({ onDismiss }: Props) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-surface-light border border-border max-w-2xl mx-auto">
      <div className="flex items-start gap-2.5">
        <Globe size={14} className="text-gold mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium mb-0.5">Web search is built in</p>
          <p className="text-[10px] text-muted">
            Just ask Trinity — &ldquo;search the web for…&rdquo; triggers a live search and
            cites sources inline. No separate drawer needed.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[10px] text-muted hover:text-gold transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
