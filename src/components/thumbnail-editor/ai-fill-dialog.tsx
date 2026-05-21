"use client";

// Prompt dialog used for AI Fill and Text-to-Layer. Shared because both
// flows ask for a text prompt and return an image; the difference is the
// endpoint and whether a selection is passed.

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

export interface AIModelOption {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: string;
}

export interface AIStyleOption {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: string;
}

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
  /** Optional model picker — only shown when `modelOptions` is provided */
  modelOptions?: AIModelOption[];
  modelChoice?: string;
  onModelChange?: (id: string) => void;
  /** Optional creator-style picker — only shown when `styleOptions` is provided */
  styleOptions?: AIStyleOption[];
  styleChoice?: string;
  onStyleChange?: (id: string) => void;
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
  modelOptions,
  modelChoice,
  onModelChange,
  styleOptions,
  styleChoice,
  onStyleChange,
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
          {/* Model selector — only rendered when modelOptions is provided */}
          {modelOptions && modelOptions.length > 0 && onModelChange && (
            <div>
              <div className="text-xs text-neutral-400 mb-1.5">Model</div>
              <div className="flex gap-1.5 flex-wrap">
                {modelOptions.map((m) => {
                  const active = modelChoice === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onModelChange(m.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-100"
                      style={{
                        background: active
                          ? "rgba(212,255,0,0.18)"
                          : "rgba(255,255,255,0.04)",
                        borderColor: active
                          ? "#D4FF00"
                          : "rgba(212, 255, 0,0.18)",
                        color: active ? "#93C5FD" : "#A8A8B2",
                      }}
                    >
                      {m.label}
                      {m.badge && (
                        <span
                          className="px-1 py-px rounded text-[9px] font-bold leading-none"
                          style={{
                            background: m.badgeColor
                              ? `${m.badgeColor}22`
                              : "rgba(212,255,0,0.14)",
                            color: m.badgeColor ?? "#D4FF00",
                          }}
                        >
                          {m.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Creator style picker — only rendered when styleOptions is provided */}
          {styleOptions && styleOptions.length > 0 && onStyleChange && (
            <div>
              <div className="text-xs text-neutral-400 mb-1.5">Creator Style</div>
              <div className="flex gap-1.5 flex-wrap">
                {styleOptions.map((s) => {
                  const active = styleChoice === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onStyleChange(s.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-100"
                      style={{
                        background: active
                          ? "rgba(212,255,0,0.18)"
                          : "rgba(255,255,255,0.04)",
                        borderColor: active
                          ? "#D4FF00"
                          : "rgba(212, 255, 0,0.18)",
                        color: active ? "#93C5FD" : "#A8A8B2",
                      }}
                    >
                      {s.label}
                      {s.badge && (
                        <span
                          className="px-1 py-px rounded text-[9px] font-bold leading-none"
                          style={{
                            background: s.badgeColor
                              ? `${s.badgeColor}22`
                              : "rgba(212,255,0,0.14)",
                            color: s.badgeColor ?? "#D4FF00",
                          }}
                        >
                          {s.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500"
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
