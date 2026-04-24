"use client";

/* ────────────────────────────────────────────────────────────────
 * useTimelineHistory — in-memory undo/redo stack, 50-entry cap.
 *
 * Design:
 *   • We keep a stack of project snapshots plus an `index` pointer.
 *   • push()  → drop any redo-tail, append, trim to MAX_HISTORY.
 *   • undo()  → move pointer back one, return that snapshot.
 *   • redo()  → move pointer forward one, return that snapshot.
 *   • A consumer that mutates state should also push on mouseup /
 *     commit, not on every pixel while dragging.  We expose
 *     `pushDebounced` for that — coalesces rapid pushes into one.
 *
 * The hook is structural state only — it does NOT apply snapshots to
 * the caller.  Instead, undo/redo return the target snapshot and the
 * caller wires it into their `setProject`.  This keeps the hook
 * agnostic to how the caller stores state (useState, reducer, etc.).
 * ────────────────────────────────────────────────────────────────*/

import { useCallback, useRef, useState } from "react";
import type { TimelineHistoryEntry, TimelineProject } from "./types";

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 350;

export interface UseTimelineHistory {
  canUndo: boolean;
  canRedo: boolean;
  /** Append a snapshot.  De-dupes if the last pushed project is deep-equal. */
  push(project: TimelineProject): void;
  /** Like push() but coalesces rapid sequential calls into one entry. */
  pushDebounced(project: TimelineProject): void;
  /** Flush any pending debounced push immediately.  Call before undo/redo. */
  flush(): void;
  undo(): TimelineProject | null;
  redo(): TimelineProject | null;
  reset(initial: TimelineProject): void;
}

/** Cheap equality — JSON stringify.  Timeline projects are small (<10KB). */
function sameProject(a: TimelineProject, b: TimelineProject): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useTimelineHistory(initial: TimelineProject): UseTimelineHistory {
  const [stack, setStack] = useState<TimelineHistoryEntry[]>(() => [
    { project: initial, ts: Date.now() },
  ]);
  const [index, setIndex] = useState(0);
  const pendingRef = useRef<{ project: TimelineProject; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = useCallback((project: TimelineProject) => {
    setStack((prev) => {
      const currentIdx = indexRef.current;
      const current = prev[currentIdx];
      if (current && sameProject(current.project, project)) return prev;
      // Drop any redo tail after our index.
      const trimmed = prev.slice(0, currentIdx + 1);
      const next = [...trimmed, { project, ts: Date.now() }];
      // Trim from the oldest side if we exceed MAX_HISTORY.
      const overflow = next.length - MAX_HISTORY;
      if (overflow > 0) {
        next.splice(0, overflow);
      }
      const newIdx = next.length - 1;
      indexRef.current = newIdx;
      setIndex(newIdx);
      return next;
    });
  }, []);

  // Keep index in a ref so our commit closure can read the latest value
  // without re-creating the callback on every index change.
  const indexRef = useRef(index);
  indexRef.current = index;

  const push = useCallback((project: TimelineProject) => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    commit(project);
  }, [commit]);

  const pushDebounced = useCallback((project: TimelineProject) => {
    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    pendingRef.current = {
      project,
      timer: setTimeout(() => {
        if (pendingRef.current) {
          commit(pendingRef.current.project);
          pendingRef.current = null;
        }
      }, DEBOUNCE_MS),
    };
  }, [commit]);

  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    clearTimeout(pendingRef.current.timer);
    const p = pendingRef.current.project;
    pendingRef.current = null;
    commit(p);
  }, [commit]);

  const undo = useCallback((): TimelineProject | null => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      commit(pendingRef.current.project);
      pendingRef.current = null;
    }
    const idx = indexRef.current;
    if (idx <= 0) return null;
    const newIdx = idx - 1;
    indexRef.current = newIdx;
    setIndex(newIdx);
    return stack[newIdx]?.project ?? null;
  }, [stack, commit]);

  const redo = useCallback((): TimelineProject | null => {
    const idx = indexRef.current;
    if (idx >= stack.length - 1) return null;
    const newIdx = idx + 1;
    indexRef.current = newIdx;
    setIndex(newIdx);
    return stack[newIdx]?.project ?? null;
  }, [stack]);

  const reset = useCallback((next: TimelineProject) => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    indexRef.current = 0;
    setIndex(0);
    setStack([{ project: next, ts: Date.now() }]);
  }, []);

  return {
    canUndo: index > 0,
    canRedo: index < stack.length - 1,
    push,
    pushDebounced,
    flush,
    undo,
    redo,
    reset,
  };
}
