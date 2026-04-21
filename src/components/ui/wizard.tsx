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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
        value
          ? "bg-gold/15 text-gold border-gold/30 shadow-sm shadow-gold/10"
          : "bg-surface-light text-muted border-border hover:text-foreground hover:border-gold/30"
      } ${className}`}
      title={value ? "Click to return to the guided wizard" : "Click for full control"}
    >
      <SlidersHorizontal size={11} />
      <span>{label}</span>
      <span
        className={`relative inline-block w-7 h-3.5 rounded-full transition-colors ${
          value ? "bg-gold" : "bg-border"
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
 * Defaults to false (guided). On first visit we store the preference lazily
 * so SSR is stable. `pageKey` must be unique per page (e.g. "thumbnail").
 */
export function useAdvancedMode(pageKey: string): [boolean, (v: boolean) => void] {
  const storageKey = `ss-wizard-advanced-${pageKey}`;
  const [val, setVal] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "1") setVal(true);
    } catch {}
  }, [storageKey]);
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
      className={`w-full bg-surface border border-border rounded-2xl overflow-hidden shadow-card ${className}`}
      data-wizard-root
    >
      {/* Progress bar */}
      <div className="relative px-4 md:px-6 pt-4 pb-3 border-b border-border bg-gradient-to-br from-gold/[0.06] via-transparent to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <Wand2 size={12} className="text-gold" />
            <span className="font-semibold text-foreground">Guided Mode</span>
            <span className="text-muted">·</span>
            <span>{current.title}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
            Step {idx + 1} of {steps.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-amber-400 transition-all duration-500 ease-out"
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
                    ? "bg-gold text-black shadow-sm shadow-gold/30"
                    : done
                    ? "bg-gold/15 text-gold hover:bg-gold/25"
                    : "bg-surface-light text-muted/70 cursor-not-allowed"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    active
                      ? "bg-black/20 text-black"
                      : done
                      ? "bg-gold text-black"
                      : "bg-border text-muted"
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
        <div className="border-b border-border bg-surface-light/40 px-4 md:px-6 py-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
            <Sparkles size={10} className="text-gold" /> Live Preview
          </div>
          {preview}
        </div>
      )}

      {/* Step header + body */}
      <div className="px-4 md:px-8 py-6 min-h-[22rem]" key={current.id}>
        <div className="max-w-3xl mx-auto wizard-step-enter">
          <div className="flex items-start gap-3 mb-5">
            {current.icon && (
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold shrink-0">
                {current.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">
                {current.title}
              </h2>
              {current.description && (
                <p className="text-xs md:text-sm text-muted mt-1 leading-relaxed">
                  {current.description}
                </p>
              )}
            </div>
            {current.optional && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light text-muted border border-border shrink-0 mt-1">
                Optional
              </span>
            )}
          </div>
          <div className="space-y-3">{current.component}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-t border-border bg-surface-light/30">
        <button
          type="button"
          onClick={handleBack}
          disabled={idx === 0 || disabled}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={13} /> Back
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        )}

        {current.optional && !isLast && (
          <button
            type="button"
            onClick={() => setIdx(idx + 1)}
            disabled={disabled}
            className="px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            Skip
          </button>
        )}

        <div className="flex-1" />

        {showShortcuts && (
          <span className="hidden md:inline text-[9px] text-muted/70 mr-2">
            Press <kbd className="px-1.5 py-0.5 rounded bg-surface-light border border-border font-mono text-[9px]">Enter</kbd> for next
          </span>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance || disabled}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isLast
              ? "bg-gradient-to-r from-gold to-amber-500 text-black shadow-lg shadow-gold/30 hover:shadow-gold/50 hover:scale-[1.02] active:scale-[0.99]"
              : "bg-gradient-to-r from-gold to-amber-500 text-black shadow shadow-gold/25 hover:shadow-gold/40"
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

      {/* Animation keyframes — scoped to the step body */}
      <style jsx>{`
        .wizard-step-enter {
          animation: wizard-slide 0.28s ease-out;
        }
        @keyframes wizard-slide {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Wizard;
