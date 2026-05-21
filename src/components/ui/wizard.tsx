"use client";

/**
 * Wizard — in-page multi-step guided flow.
 *
 * This is the "4-year-old friendly" surface that wraps the existing advanced
 * UIs on the dashboard creation pages (thumbnail generator, video editor,
 * copywriter, etc). One question per screen, huge gold primary button, live
 * preview slot, keyboard nav, and a sibling <AdvancedToggle> so power users
 * can flip back to the full control panel.
 *
 * Unlike the older <CreationWizard> modal, this renders inline as the primary
 * page body. Steps are arbitrary React nodes — the caller owns state.
 *
 * Typical usage:
 *
 *   const [advanced, setAdvanced] = useAdvancedMode("thumbnail-generator");
 *   const [step, setStep] = useState(0);
 *
 *   return (
 *     <>
 *       <AdvancedToggle value={advanced} onChange={setAdvanced} />
 *       {!advanced ? (
 *         <Wizard
 *           steps={[
 *             { id: "topic", title: "What's your video about?",
 *               description: "One sentence is enough.",
 *               component: <TopicStep ... />, canProceed: !!topic },
 *             ...
 *           ]}
 *           activeIdx={step}
 *           onStepChange={setStep}
 *           onFinish={handleGenerate}
 *           finishLabel="Generate thumbnail"
 *         />
 *       ) : (
 *         <>{existingAdvancedUI}</>
 *       )}
 *     </>
 *   );
 */

import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────────────── */

export interface WizardStepDef {
  /** Stable id — used in the URL hash & keyboard shortcuts. */
  id: string;
  /** Short title shown in the progress rail (3-4 words max). */
  title: string;
  /** One-line description under the step header. */
  description?: string;
  /** The step body — any React. The caller owns all state. */
  component: React.ReactNode;
  /**
   * Whether the Next button is enabled on this step.
   * Defaults to true. Set to false to block advance until required input is
   * provided (e.g. `canProceed: prompt.trim().length > 0`).
   */
  canProceed?: boolean;
  /** Skip button appears when true. */
  optional?: boolean;
  /** Optional icon shown in the step header. */
  icon?: React.ReactNode;
}

export interface WizardProps {
  steps: WizardStepDef[];
  /** Called when the user clicks the final primary button. */
  onFinish: () => void | Promise<void>;
  /** Label on the final primary button. Defaults to "Finish". */
  finishLabel?: string;
  /** Optional cancel / reset button in the footer. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Controlled active step index. Omit for internal state. */
  activeIdx?: number;
  /** Called every time the step changes (controlled mode). */
  onStepChange?: (i: number) => void;
  /** Optional slot rendered above the step content (e.g. a live preview). */
  preview?: React.ReactNode;
  /** Show on-screen keyboard shortcut hints. Defaults to true. */
  showShortcuts?: boolean;
  /** Loading state — disables primary actions, shows spinner. */
  busy?: boolean;
  /** Extra className for the outer container. */
  className?: string;
}

/* ── Advanced toggle ────────────────────────────────────────────────── */

export interface AdvancedToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Label shown next to the switch. Defaults to "Advanced mode". */
  label?: string;
  className?: string;
}

/**
 * Small pill-style toggle that lets power users flip the creation page from
 * Guided Mode (the wizard) to Advanced Mode (the existing full form).
 *
 * Visual contract:
 *   - Sits in the top-right of a <PageHero> over a dark gradient background
 *   - Uses opaque / backdrop-blurred surfaces so the hero's radial glows
 *     do not bleed through the pill (previous 15% gold made the pill look
 *     orange/amber/clipped on sunset & purple heroes).
 *   - Always shrink-0 so a tight parent flex row can't truncate it.
 *   - `relative z-20` puts it above the hero's z-10 content layer and above
 *     the glow layer so it never visually merges with the gradient.
 */
export function AdvancedToggle({
  value,
  onChange,
  label = "Advanced mode",
  className = "",
}: AdvancedToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      data-advanced-toggle
      className={`relative z-20 shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-semibold border backdrop-blur-sm transition-all whitespace-nowrap ${
        value
          ? "bg-[#D4FF00] text-[#020711] border-[#D4FF00] shadow-sm shadow-[rgba(212,255,0,0.18)] hover:shadow-[rgba(212,255,0,0.4)]"
          : "bg-black/30 text-white border-border-subtle hover:bg-black/40 hover:border-border-subtle"
      } ${className}`}
      title={value ? "Click to return to the guided wizard" : "Click for full control"}
    >
      <SlidersHorizontal size={11} />
      <span>{label}</span>
      <span
        className={`relative inline-block w-7 h-3.5 rounded-full transition-colors ${
          value ? "bg-black/30" : "bg-black/15"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Convenience hook — advanced-mode preference, persisted per page key.
 *
 * Defaults to false (guided). `pageKey` must be unique per page
 * (e.g. "thumbnail").
 *
 * The previous implementation initialised `false` at first render and then
 * read localStorage in a `useEffect`. That meant on every page load — even
 * when the user had Advanced mode saved as ON — the toggle would render in
 * the OFF position for ~16 ms, then visibly slide to ON once the effect
 * fired. From the user's POV the thumb looked like it was *swiping in the
 * wrong direction on load* (you expect the toggle to already be in its
 * persisted position; instead it animated INTO that position).
 *
 * Fix: read localStorage synchronously in the useState lazy initializer so
 * the first client-side render already has the persisted value. SSR still
 * renders `false` (no localStorage on the server) — that produces a
 * hydration warning the first paint after navigation, which Next.js
 * auto-reconciles. Acceptable trade-off for a non-security pref.
 */
export function useAdvancedMode(pageKey: string): [boolean, (v: boolean) => void] {
  const storageKey = `ss-wizard-advanced-${pageKey}`;
  const [val, setVal] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const setAndPersist = useCallback(
    (next: boolean) => {
      setVal(next);
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
    },
    [storageKey]
  );
  return [val, setAndPersist];
}

/* ── Wizard component ────────────────────────────────────────────────── */

export function Wizard({
  steps,
  onFinish,
  finishLabel = "Finish",
  onCancel,
  cancelLabel = "Cancel",
  activeIdx,
  onStepChange,
  preview,
  showShortcuts = true,
  busy = false,
  className = "",
}: WizardProps) {
  const [internalIdx, setInternalIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const controlled = typeof activeIdx === "number";
  const idx = controlled ? Math.min(Math.max(activeIdx!, 0), steps.length - 1) : internalIdx;

  const setIdx = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), steps.length - 1);
      if (!controlled) setInternalIdx(clamped);
      onStepChange?.(clamped);
    },
    [controlled, onStepChange, steps.length]
  );

  const current = steps[idx];
  const isLast = idx === steps.length - 1;
  const canProceed = current?.canProceed !== false; // default true
  const canAdvance = canProceed || current?.optional === true;
  const disabled = busy || finishing;

  const handleNext = useCallback(async () => {
    if (disabled) return;
    if (isLast) {
      if (!canAdvance) return;
      setFinishing(true);
      try {
        await onFinish();
      } finally {
        setFinishing(false);
      }
      return;
    }
    if (canAdvance) setIdx(idx + 1);
  }, [disabled, isLast, canAdvance, onFinish, setIdx, idx]);

  const handleBack = useCallback(() => {
    if (disabled || idx === 0) return;
    setIdx(idx - 1);
  }, [disabled, idx, setIdx]);

  /* Keyboard: Enter = next, Esc = cancel (if handler present). */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      if (e.key === "Enter" && !isEditable && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, onCancel]);

  if (steps.length === 0) return null;
  if (!current) return null;

  const progress = ((idx + 1) / steps.length) * 100;

  return (
    <div
      className={`w-full bg-surface border border-border-subtle overflow-hidden shadow-card ${className}`}
      data-wizard-root
    >
      {/* Progress bar */}
      <div className="relative px-4 md:px-6 pt-4 pb-3 border-b border-border-subtle bg-gradient-to-br from-[rgba(212,255,0,0.06)] via-transparent to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <Wand2 size={12} className="text-[#D4FF00]" />
            <span className="font-semibold text-text-primary">Guided Mode</span>
            <span className="text-text-muted">·</span>
            <span>{current.title}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4FF00] bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.2)] px-2 py-0.5 rounded-full">
            Step {idx + 1} of {steps.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4FF00] to-amber-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Dot rail */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {steps.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            const reachable = i <= idx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => reachable && !disabled && setIdx(i)}
                disabled={!reachable || disabled}
                className={`group flex items-center gap-1.5 text-[10px] font-medium shrink-0 px-2 py-1 rounded-full transition-colors ${
                  active
                    ? "bg-[#D4FF00] text-[#020711] shadow-sm shadow-[rgba(212,255,0,0.18)]"
                    : done
                    ? "bg-[rgba(212,255,0,0.08)] text-[#D4FF00] hover:bg-[rgba(212,255,0,0.12)]"
                    : "bg-surface-light text-text-muted/70 cursor-not-allowed"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    active
                      ? "bg-black/20 text-text-primary"
                      : done
                      ? "bg-[#D4FF00] text-[#020711]"
                      : "bg-border text-text-muted"
                  }`}
                >
                  {done ? <Check size={8} /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional preview slot */}
      {preview && (
        <div className="border-b border-border-subtle bg-surface-light/40 px-4 md:px-6 py-3">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">
            <Sparkles size={10} className="text-[#D4FF00]" /> Live Preview
          </div>
          {preview}
        </div>
      )}

      {/* Step header + body — AnimatePresence waits for exit before entering next */}
      <div className="px-4 md:px-8 py-6 min-h-[22rem] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-start gap-3 mb-5">
              {current.icon && (
                <div className="w-10 h-10 rounded-xl bg-[rgba(212,255,0,0.08)] flex items-center justify-center text-[#D4FF00] shrink-0">
                  {current.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-text-primary leading-tight">
                  {current.title}
                </h2>
                {current.description && (
                  <p className="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
                    {current.description}
                  </p>
                )}
              </div>
              {current.optional && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light text-text-muted border border-border-subtle shrink-0 mt-1">
                  Optional
                </span>
              )}
            </div>
            <div className="space-y-3">{current.component}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-t border-border-subtle bg-surface-light/30">
        <button
          type="button"
          onClick={handleBack}
          disabled={idx === 0 || disabled}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={13} /> Back
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        )}

        {current.optional && !isLast && (
          <button
            type="button"
            onClick={() => setIdx(idx + 1)}
            disabled={disabled}
            className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            Skip
          </button>
        )}

        <div className="flex-1" />

        {showShortcuts && (
          <span className="hidden md:inline text-[9px] text-text-muted/70 mr-2">
            Press <kbd className="px-1.5 py-0.5 rounded bg-surface-light border border-border-subtle font-mono text-[9px]">Enter</kbd> for next
          </span>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance || disabled}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isLast
              ? "bg-gradient-to-r from-[#D4FF00] to-amber-500 text-white shadow-lg shadow-[rgba(212,255,0,0.18)] hover:shadow-[rgba(212,255,0,0.4)] hover:scale-[1.02] active:scale-[0.99]"
              : "bg-gradient-to-r from-[#D4FF00] to-amber-500 text-white shadow shadow-[rgba(212,255,0,0.12)] hover:shadow-[rgba(212,255,0,0.25)]"
          }`}
        >
          {finishing ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Working…</span>
            </>
          ) : isLast ? (
            <>
              <Sparkles size={14} />
              <span>{finishLabel}</span>
            </>
          ) : (
            <>
              <span>Next</span>
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>

    </div>
  );
}

export default Wizard;
