"use client";

// Photoshop-style history list. Newest entry sits at the top; clicking
// an entry jumps back to that snapshot (future entries stay available for
// redo). Entries older than the 50-snapshot cap are pruned by the
// reducer, not the UI.

import { useMemo } from "react";
import { Clock, Undo2, Redo2 } from "lucide-react";
import type { HistoryEntry, HistoryState } from "@/lib/thumbnail-editor/types";
import { flattenHistory } from "@/lib/thumbnail-editor/reducer";

interface HistoryPanelProps {
  history: HistoryState;
  onJump: (entryId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function HistoryPanel({
  history,
  onJump,
  onUndo,
  onRedo,
}: HistoryPanelProps) {
  const entries = useMemo(() => flattenHistory(history), [history]);
  const presentId = history.present.id;

  return (
    <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col text-neutral-200 text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          <span className="font-semibold text-neutral-100">History</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={history.past.length === 0}
            className="p-1 rounded hover:bg-neutral-800 disabled:opacity-30"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={history.future.length === 0}
            className="p-1 rounded hover:bg-neutral-800 disabled:opacity-30"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <div className="p-3 text-neutral-500 text-center">
            No history yet.
          </div>
        )}
        {entries.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            isPresent={entry.id === presentId}
            // An entry is "future" (redo-able) if the user has already
            // undone past it. We dim those rows slightly.
            isFuture={history.future.some((e) => e.id === entry.id)}
            onJump={() => onJump(entry.id)}
          />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-neutral-800 text-[10px] text-neutral-500 flex justify-between">
        <span>{history.past.length + 1 + history.future.length} entries</span>
        <span>max 50</span>
      </div>
    </div>
  );
}

interface HistoryRowProps {
  entry: HistoryEntry;
  isPresent: boolean;
  isFuture: boolean;
  onJump: () => void;
}

function HistoryRow({ entry, isPresent, isFuture, onJump }: HistoryRowProps) {
  return (
    <button
      type="button"
      onClick={onJump}
      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 border-l-2 ${
        isPresent
          ? "bg-blue-600/20 border-blue-500 text-neutral-100"
          : isFuture
            ? "border-transparent text-neutral-500 hover:bg-neutral-800/60"
            : "border-transparent text-neutral-300 hover:bg-neutral-800/60"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
      <span className="flex-1 truncate">{entry.label}</span>
      <span className="text-[10px] text-neutral-500">
        {formatTime(entry.timestamp)}
      </span>
    </button>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
