"use client";

// Prompt dialog used for AI Fill and Text-to-Layer. Shared because both
// flows ask for a text prompt and return an image; the difference is the
// endpoint and whether a selection is passed.

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

interface AIFillDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  placeholder?: string;
  submitLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void | Promise<void>;
  presetSuggestions?: string[];
}

export default function AIFillDialog({
  open,
  title,
  subtitle,
  placeholder = "Describe what should appear in the selected area",
  submitLabel = "Generate",
  busy = false,
  onClose,
  onSubmit,
  presetSuggestions,
}: AIFillDialogProps) {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!open) setPrompt("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">
                {title}
              </div>
              {subtitle && (
                <div className="text-xs text-neutral-400">{subtitle}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
          />
          {presetSuggestions && presetSuggestions.length > 0 && (
            <div>
              <div className="text-xs text-neutral-400 mb-1">Try:</div>
              <div className="flex flex-wrap gap-1">
                {presetSuggestions.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded hover:bg-neutral-700 text-neutral-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || prompt.trim().length === 0}
            onClick={() => onSubmit(prompt.trim())}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-gradient-to-r from-purple-600 to-pink-500 text-white disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
