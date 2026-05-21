"use client";

/**
 * TrinitySuggestions — the quick-action chip row shown below the input
 * while the thread is empty. Lazy-loaded so readers with an active
 * thread never ship this code.
 */

interface Props {
  suggestions: string[];
  onPick: (s: string) => void;
}

export default function TrinitySuggestions({ suggestions, onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-2xl mx-auto">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="text-[11px] px-3 py-1.5 rounded-full border border-border-subtle bg-surface-light text-text-muted hover:text-[#2563EB] hover:border-[rgba(212,255,0,0.3)] hover:bg-[rgba(212,255,0,0.04)] transition-all"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
