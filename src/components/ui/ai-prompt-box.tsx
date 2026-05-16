"use client";

/**
 * AIPromptBox — premium AI prompt input surface.
 * Full-featured AI input with:
 *   - Auto-growing textarea
 *   - Suggested prompts chips
 *   - Model/mode selector (optional)
 *   - Animated thinking indicator
 *   - Keyboard shortcut (Cmd/Ctrl+Enter)
 *   - Glassy surface with subtle motion
 * Adapted from 21st.dev/r/buildui/ai-prompt-box for ShortStack.
 */

import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp, Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIPromptBoxProps {
  /** Called when the user submits the prompt */
  onSubmit: (prompt: string) => Promise<void> | void;
  /** Called on every keystroke — use for controlled parent state sync */
  onChange?: (value: string) => void;
  /** Optional suggestion chips shown below the input */
  suggestions?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether AI is currently processing */
  loading?: boolean;
  /** Initial value */
  defaultValue?: string;
  /** Min rows for the textarea */
  minRows?: number;
  /** Max rows before scrolling */
  maxRows?: number;
  /** Optional label for screen readers */
  label?: string;
  className?: string;
  /** Optional model badge text */
  modelLabel?: string;
}

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 };

export function AIPromptBox({
  onSubmit,
  onChange,
  suggestions = [],
  placeholder = "Ask AI anything…",
  loading = false,
  defaultValue = "",
  minRows = 1,
  maxRows = 6,
  label = "AI prompt",
  className,
  modelLabel,
}: AIPromptBoxProps) {
  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = useReducedMotion();

  const busy = loading || isSubmitting;

  // Auto-resize textarea
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineH = parseInt(getComputedStyle(el).lineHeight || "24");
    const min = lineH * minRows;
    const max = lineH * maxRows;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, min), max)}px`;
  };

  useEffect(resizeTextarea, [value, minRows, maxRows]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    onChange?.(v);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
    // Shift+Enter = newline (default) — no special handling needed
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue("");
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const applySuggestion = (s: string) => {
    setValue(s);
    textareaRef.current?.focus();
  };

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {/* Main input surface */}
      <motion.form
        onSubmit={handleSubmit}
        animate={
          reducedMotion
            ? undefined
            : isFocused
            ? { boxShadow: "0 0 0 2px rgba(59,130,246,0.25), 0 4px 24px rgba(59,130,246,0.12)" }
            : { boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.07)" }
        }
        transition={{ duration: 0.2 }}
        className="relative flex flex-col rounded-2xl bg-white overflow-hidden"
        style={{
          boxShadow: isFocused
            ? "0 0 0 2px rgba(59,130,246,0.25), 0 4px 24px rgba(59,130,246,0.12)"
            : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.07)",
        }}
      >
        {/* Subtle top gradient on focus */}
        <AnimatePresence>
          {isFocused && !reducedMotion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, #2563EB 40%, #93C5FD 60%, transparent)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Textarea */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          {/* Sparkle icon */}
          <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
            <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
          </div>

          <label htmlFor="ai-prompt-textarea" className="sr-only">
            {label}
          </label>
          <textarea
            id="ai-prompt-textarea"
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={busy}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent text-sm text-text-primary",
              "placeholder:text-text-muted leading-6",
              "focus:outline-none",
              "disabled:opacity-50",
              "scrollbar-thin scrollbar-thumb-[rgba(0,0,0,0.12)] scrollbar-track-transparent"
            )}
            style={{ minHeight: 24, maxHeight: 24 * maxRows }}
          />

          {/* Clear button */}
          <AnimatePresence>
            {value && !busy && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={reducedMotion ? { duration: 0 } : SPRING}
                onClick={() => { setValue(""); textareaRef.current?.focus(); }}
                aria-label="Clear prompt"
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(0,0,0,0.07)] text-text-muted transition-colors hover:bg-[rgba(0,0,0,0.12)] hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Model badge */}
            {modelLabel && (
              <span className="rounded-full border border-[rgba(59,130,246,0.20)] bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#2563EB]">
                {modelLabel}
              </span>
            )}
            {/* Keyboard hint */}
            <span className="text-[11px] text-text-muted hidden sm:block select-none">
              {typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl"}+↵ to send
            </span>
          </div>

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={!value.trim() || busy}
            aria-label="Send prompt"
            whileHover={reducedMotion || !value.trim() || busy ? undefined : { scale: 1.06 }}
            whileTap={reducedMotion || !value.trim() || busy ? undefined : { scale: 0.94 }}
            transition={SPRING}
            className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
              "transition-all duration-200",
              value.trim() && !busy
                ? "bg-[#2563EB] text-white shadow-[0_2px_8px_rgba(59,130,246,0.30)]"
                : "bg-[rgba(0,0,0,0.07)] text-text-muted",
              "disabled:pointer-events-none"
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </motion.button>
        </div>
      </motion.form>

      {/* Suggestion chips */}
      {suggestions.length > 0 && !value && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="flex flex-wrap gap-2"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applySuggestion(s)}
              className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-3 py-1.5 text-xs text-text-secondary transition-all duration-150 hover:border-[rgba(59,130,246,0.25)] hover:bg-blue-50 hover:text-[#2563EB] active:scale-[0.97]"
            >
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default AIPromptBox;
