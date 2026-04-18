"use client";
import { useEffect, useRef, useState } from "react";

interface AutoSaveOptions<T> {
  /** The value to save (usually an object of form state) */
  value: T;
  /** Function that performs the save — return a Promise */
  save: (value: T) => Promise<void>;
  /** Milliseconds to debounce (default 800) */
  delay?: number;
  /** Skip saving if this returns true (e.g., empty form) */
  skip?: (value: T) => boolean;
  /** Disabled flag */
  enabled?: boolean;
}

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave<T>({ value, save, delay = 800, skip, enabled = true }: AutoSaveOptions<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<string>("");
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    // Skip the initial render so we don't save unchanged data
    if (firstRunRef.current) {
      firstRunRef.current = false;
      lastValueRef.current = JSON.stringify(value);
      return;
    }
    // Skip if value hasn't actually changed (e.g., setState with same value)
    const serialized = JSON.stringify(value);
    if (serialized === lastValueRef.current) return;
    lastValueRef.current = serialized;

    if (skip?.(value)) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        await save(value);
        setStatus("saved");
        setLastSavedAt(new Date());
        setError(null);
        // Auto-clear "saved" indicator after 2s
        setTimeout(() => setStatus(s => s === "saved" ? "idle" : s), 2000);
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Save failed");
      }
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, enabled, save, delay, skip]);

  return { status, lastSavedAt, error };
}
