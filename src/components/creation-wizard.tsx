"use client";

/**
 * Generic step-by-step creation wizard.
 * Used by video editor + thumbnail generator to guide newbies through creation.
 *
 * Caller defines steps (id, title, description, field type, options).
 * Wizard handles navigation, progress, preview, and submit.
 *
 * Choice-card rendering note: option `emoji` values are mapped to Lucide
 * icons via `@/lib/ui/emoji-icon-map` and rendered in a gold-tinted 40x40
 * square at the top-left of each card. Raw emoji are never rendered — the
 * fallback is <Sparkles/>. See also <EmojiIcon/> for the helper.
 */

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Sparkles, X, Zap, Image as ImageIcon, Type, Palette, Film, Music, Wand2, RefreshCw } from "lucide-react";
import { mergeNonEmpty } from "@/lib/merge-patch";
import { EmojiIcon } from "@/lib/ui/emoji-icon-map";

/* ── Types ───────────────────────────────────────────────────────────── */

type FieldType =
  | "text"
  | "textarea"
  | "choice-cards"      // grid of clickable preset cards
  | "color-picker"
  | "toggle"
  | "slider"
  | "number"
  | "image-upload"
  | "dropdown"
  | "chip-select";      // multi-select chips

export interface WizardOption {
  value: string;
  label: string;
  description?: string;
  emoji?: string;
  preview?: string; // gradient/color hint for cards
  icon?: React.ReactNode;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  field: {
    type: FieldType;
    key: string;              // flat key to store value
    placeholder?: string;
    options?: WizardOption[];
    min?: number;
    max?: number;
    step?: number;
    optional?: boolean;
  };
  /* Optional AI helper (button appears inline) */
  aiHelper?: {
    label: string;
    onClick: (data: Record<string, unknown>) => Promise<Partial<Record<string, unknown>>>;
  };
  /* Preview shown on right side — React node using current data */
  preview?: (data: Record<string, unknown>) => React.ReactNode;
}

/* ── Cinematic variant (fullscreen, large type, directional slide) ──── */

/**
 * CinematicWizard — fullscreen step-by-step flow.
 * One question per screen, large typography, left/right slide transitions.
 * Used by website builder for Higgsfield-style creation UX.
 */
export function CinematicWizard({
  open,
  title,
  steps,
  initialData = {},
  onClose,
  onComplete,
  submitLabel = "Create",
  icon,
  sidePanel,
}: CreationWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // direction: 1 = forward (slide right→left), -1 = back (slide left→right)
  const slideDirRef = useRef<1 | -1>(1);
  // Force re-render so AnimatePresence picks up updated custom value
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIdx(0);
      setData(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const currentStep = steps[stepIdx];
  const isLastStep = stepIdx === steps.length - 1;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  function setValue(key: string, val: unknown) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  function canAdvance(): boolean {
    if (currentStep.field.optional) return true;
    const v = data[currentStep.field.key];
    if (currentStep.field.type === "chip-select") return Array.isArray(v) && v.length > 0;
    if (currentStep.field.type === "toggle") return true;
    return !!v;
  }

  function goNext() {
    if (!canAdvance()) return;
    slideDirRef.current = 1;
    setRenderKey(k => k + 1);
    setStepIdx(s => Math.min(steps.length - 1, s + 1));
  }

  function goBack() {
    slideDirRef.current = -1;
    setRenderKey(k => k + 1);
    setStepIdx(s => Math.max(0, s - 1));
  }

  async function runAiHelper() {
    if (!currentStep.aiHelper) return;
    setAiLoading(true);
    try {
      const patch = await currentStep.aiHelper.onClick(data);
      setData(prev => ({ ...prev, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== null && v !== "")) }));
    } catch (err) {
      console.error("[CinematicWizard] AI helper failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      await onComplete(data);
    } finally {
      setSubmitting(false);
    }
  }

  const dir = slideDirRef.current;

  return (
    <div className="fixed inset-0 z-50 bg-[#020711] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 sm:px-10 pt-5 pb-4 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-[#D4FF00] opacity-70">{icon}</div>}
          <span className="text-xs font-medium text-white/35 tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/25">
            {stepIdx + 1} <span className="text-white/15">of</span> {steps.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-white/[0.04] shrink-0">
        <motion.div
          className="h-full bg-[#D4FF00]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>

      {/* Main content — centered in viewport, optional split layout with side panel */}
      <div className={`flex-1 flex overflow-y-auto py-10 ${sidePanel ? "px-6 sm:px-10" : "items-center justify-center px-6 sm:px-16 md:px-24"}`}>
        <div className={sidePanel ? "flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 items-start max-w-[1400px] mx-auto" : "w-full max-w-2xl"}>
          {/* Left: question + field */}
          <div className={sidePanel ? "lg:col-span-2 flex flex-col justify-center min-h-[400px]" : ""}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`cinematic-${stepIdx}-${renderKey}`}
                initial={{ opacity: 0, x: dir * 64 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -dir * 48 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              >
                {/* Question */}
                <div className="mb-8">
                  {currentStep.icon && (
                    <div className="inline-flex w-11 h-11 rounded-xl bg-[rgba(212,255,0,0.1)] items-center justify-center text-[#D4FF00] mb-5">
                      {currentStep.icon}
                    </div>
                  )}
                  <h2 className={`font-bold text-white tracking-tight leading-tight mb-3 ${sidePanel ? "text-xl sm:text-2xl" : "text-[2rem] sm:text-[2.5rem]"}`}>
                    {currentStep.title}
                  </h2>
                  {currentStep.description && (
                    <p className="text-[15px] text-white/40 leading-relaxed max-w-lg">
                      {currentStep.description}
                    </p>
                  )}
                </div>

                {/* Field */}
                <FieldRenderer
                  field={currentStep.field}
                  value={data[currentStep.field.key]}
                  onChange={v => setValue(currentStep.field.key, v)}
                />

                {/* AI helper */}
                {currentStep.aiHelper && (
                  <div className="mt-5 relative group">
                    <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D4FF00] via-[#E8FF4D] to-[#AACC00] opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
                    <button
                      onClick={runAiHelper}
                      disabled={aiLoading}
                      className="relative w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-[#0D1827] border border-[rgba(212,255,0,0.25)] text-white text-sm font-medium hover:bg-[rgba(212,255,0,0.1)] hover:border-[rgba(212,255,0,0.45)] transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <><RefreshCw size={14} className="animate-spin" /> Thinking...</>
                      ) : (
                        <><Sparkles size={14} className="text-indigo-300" /> {currentStep.aiHelper.label}</>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: persistent live preview panel */}
          {sidePanel && (
            <div className="hidden lg:block lg:col-span-3 sticky top-10">
              {sidePanel(data, stepIdx)}
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 sm:px-10 py-5 border-t border-white/[0.05] shrink-0">
        {/* Back */}
        <button
          onClick={goBack}
          disabled={stepIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-white/35 hover:text-white/80 disabled:opacity-20 transition-colors"
        >
          <ChevronLeft size={14} /> Back
        </button>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === stepIdx
                  ? "w-5 h-[5px] bg-[#D4FF00]"
                  : i < stepIdx
                  ? "w-[5px] h-[5px] bg-[#D4FF00]/40"
                  : "w-[5px] h-[5px] bg-white/[0.10]"
              }`}
            />
          ))}
        </div>

        {/* Continue / Generate */}
        {!isLastStep ? (
          <button
            onClick={goNext}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D4FF00] text-[#020711] text-sm font-semibold hover:bg-[#D4FF00] disabled:opacity-35 transition-colors shadow-lg shadow-[rgba(212,255,0,0.18)]"
          >
            Continue <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={!canAdvance() || submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D4FF00] text-[#020711] text-sm font-semibold hover:bg-[#D4FF00] disabled:opacity-35 transition-colors shadow-lg shadow-[rgba(212,255,0,0.18)]"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {submitting ? "Creating..." : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export interface CreationWizardProps {
  open: boolean;
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  initialData?: Record<string, unknown>;
  onClose: () => void;
  onComplete: (data: Record<string, unknown>) => Promise<void> | void;
  submitLabel?: string;
  icon?: React.ReactNode;
  /** Persistent side panel shown alongside wizard steps (CinematicWizard only).
   *  Receives current wizard data so the preview can update in real-time. */
  sidePanel?: (data: Record<string, unknown>, stepIdx: number) => React.ReactNode;
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function CreationWizard({
  open,
  title,
  subtitle,
  steps,
  initialData = {},
  onClose,
  onComplete,
  submitLabel = "Create",
  icon,
}: CreationWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStepIdx(0);
      setData(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const currentStep = steps[stepIdx];
  const isLastStep = stepIdx === steps.length - 1;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  function setValue(key: string, val: unknown) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  function canAdvance(): boolean {
    if (currentStep.field.optional) return true;
    const v = data[currentStep.field.key];
    if (currentStep.field.type === "chip-select") return Array.isArray(v) && v.length > 0;
    if (currentStep.field.type === "toggle") return true;
    return !!v;
  }

  async function runAiHelper() {
    if (!currentStep.aiHelper) return;
    setAiLoading(true);
    try {
      const patch = await currentStep.aiHelper.onClick(data);
      // mergeNonEmpty skips undefined/null/"" — prevents AI helpers from
      // wiping existing user input when the API fails or returns partial data.
      setData(prev => mergeNonEmpty(prev, patch));
    } catch (err) {
      console.error("[CreationWizard] AI helper failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      await onComplete(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-surface border border-border-subtle shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-border-subtle bg-gradient-to-br from-[rgba(212,255,0,0.08)] via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(212,255,0,0.08)] flex items-center justify-center text-[#D4FF00]">
              {icon || <Sparkles size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
              {subtitle && <p className="text-[11px] text-text-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-light text-text-muted hover:text-text-primary transition-colors">
              <X size={14} />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-text-muted mb-1.5">
              <span>Step {stepIdx + 1} of {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-light overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#D4FF00] to-[#AACC00]"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Step nav rail */}
        <div className="flex gap-1 px-6 pt-3 overflow-x-auto scrollbar-none border-b border-border-subtle">
          {steps.map((s, i) => {
            const isDone = i < stepIdx;
            const isCurrent = i === stepIdx;
            return (
              <button
                key={s.id}
                onClick={() => i <= stepIdx && setStepIdx(i)}
                disabled={i > stepIdx}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-[10px] font-medium shrink-0 transition-all ${
                  isCurrent
                    ? "bg-[rgba(212,255,0,0.08)] text-[#D4FF00] border-b-2 border-[#D4FF00]"
                    : isDone
                    ? "text-text-muted hover:text-text-primary cursor-pointer"
                    : "text-text-muted/50 cursor-not-allowed"
                }`}
              >
                {isDone ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                    isCurrent ? "border-[#D4FF00] bg-[#D4FF00] text-[#020711]" : "border-muted/30"
                  }`}>{i + 1}</span>
                )}
                <span className="whitespace-nowrap">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: input */}
          <div className="flex-1 p-6 overflow-y-auto min-w-0">
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`wizard-step-${stepIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="max-w-xl mx-auto"
            >
              <div className="flex items-start gap-3 mb-5">
                {currentStep.icon && (
                  <div className="w-9 h-9 rounded-xl bg-[rgba(212,255,0,0.08)] flex items-center justify-center text-[#D4FF00] shrink-0">
                    {currentStep.icon}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-text-primary">{currentStep.title}</h3>
                  {currentStep.description && (
                    <p className="text-xs text-text-muted mt-0.5">{currentStep.description}</p>
                  )}
                </div>
                {currentStep.field.optional && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light text-text-muted border border-border-subtle">
                    Optional
                  </span>
                )}
              </div>

              {/* Field renderer */}
              <div className="space-y-3">
                <FieldRenderer
                  field={currentStep.field}
                  value={data[currentStep.field.key]}
                  onChange={v => setValue(currentStep.field.key, v)}
                />

                {currentStep.aiHelper && (
                  <div className="relative group">
                    {/* Glow halo */}
                    <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-[#D4FF00] via-[#E8FF4D] to-[#AACC00] opacity-60 blur group-hover:opacity-90 transition-opacity animate-pulse-slow" />
                    <button
                      onClick={runAiHelper}
                      disabled={aiLoading}
                      className="relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-[#D4FF00] to-[#AACC00] text-white text-xs font-bold shadow-lg shadow-[rgba(212,255,0,0.3)] hover:shadow-[rgba(212,255,0,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Thinking...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} className="animate-pulse" />
                          <span className="tracking-wide">{currentStep.aiHelper.label}</span>
                          <span className="ml-1 text-[9px] uppercase bg-black/20 px-1.5 py-0.5 rounded-full font-semibold">Recommended</span>
                        </>
                      )}
                    </button>
                    <p className="text-[9px] text-center text-text-muted mt-1.5">or fill it in manually above</p>
                  </div>
                )}
              </div>
            </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: live preview */}
          {currentStep.preview && (
            <div className="w-72 md:w-80 shrink-0 border-l border-border-subtle bg-surface-light/40 p-5 overflow-y-auto hidden md:block">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-3 font-semibold">
                <Sparkles size={9} className="text-[#D4FF00]" /> Live Preview
              </div>
              <div className="space-y-2">
                {currentStep.preview(data)}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-border-subtle bg-surface-light/30">
          <button
            onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
            disabled={stepIdx === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={12} /> Back
          </button>

          {currentStep.field.optional && (
            <button
              onClick={() => {
                if (isLastStep) handleComplete();
                else setStepIdx(stepIdx + 1);
              }}
              className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Skip
            </button>
          )}

          <div className="flex-1" />

          {!isLastStep ? (
            <button
              onClick={() => setStepIdx(stepIdx + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4FF00] to-[#AACC00] text-white text-xs font-semibold hover:shadow-lg hover:shadow-[rgba(212,255,0,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canAdvance() || submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4FF00] to-[#AACC00] text-white text-xs font-semibold hover:shadow-lg hover:shadow-[rgba(212,255,0,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {submitting ? "Creating..." : submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Field Renderer ──────────────────────────────────────────────────── */

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: WizardStep["field"];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={(value as string) || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[#D4FF00] focus:ring-2 focus:ring-[rgba(212,255,0,0.2)] transition-all"
          autoFocus
        />
      );

    case "textarea":
      return (
        <textarea
          value={(value as string) || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[#D4FF00] focus:ring-2 focus:ring-[rgba(212,255,0,0.2)] transition-all resize-none"
          autoFocus
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={(value as number) ?? 0}
          onChange={e => onChange(Number(e.target.value))}
          min={field.min}
          max={field.max}
          step={field.step}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[#D4FF00] focus:ring-2 focus:ring-[rgba(212,255,0,0.2)] transition-all"
          autoFocus
        />
      );

    case "slider":
      return (
        <div className="space-y-2">
          <input
            type="range"
            value={(value as number) ?? field.min ?? 0}
            onChange={e => onChange(Number(e.target.value))}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            className="w-full accent-[#D4FF00]"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>{field.min ?? 0}</span>
            <span className="text-[#D4FF00] font-bold">{String(value ?? field.min ?? 0)}</span>
            <span>{field.max ?? 100}</span>
          </div>
        </div>
      );

    case "toggle":
      return (
        <button
          onClick={() => onChange(!value)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            value ? "bg-[rgba(212,255,0,0.08)] border-[rgba(212,255,0,0.25)] text-[#D4FF00]" : "bg-surface-light border-border-subtle text-text-muted"
          }`}
        >
          <span className="text-sm">{value ? "Yes, enabled" : "No, disabled"}</span>
          <div className={`w-10 h-5 rounded-full relative transition-all ${value ? "bg-[#D4FF00]" : "bg-surface-light border border-border-subtle"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </button>
      );

    case "color-picker":
      return (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={(value as string) || "#D4FF00"}
            onChange={e => onChange(e.target.value)}
            className="w-16 h-16 rounded-xl cursor-pointer border border-border-subtle bg-surface-light"
          />
          <input
            type="text"
            value={(value as string) || "#D4FF00"}
            onChange={e => onChange(e.target.value)}
            placeholder="#D4FF00"
            className="flex-1 px-3 py-2 rounded-lg bg-surface-light border border-border-subtle text-sm font-mono focus:outline-none focus:border-[#D4FF00]"
          />
        </div>
      );

    case "dropdown":
      return (
        <select
          value={(value as string) || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[#D4FF00]"
        >
          <option value="" disabled>{field.placeholder || "Choose..."}</option>
          {(field.options || []).map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.emoji ? `${opt.emoji} ` : ""}{opt.label}
            </option>
          ))}
        </select>
      );

    case "choice-cards":
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(field.options || []).map(opt => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={`group relative text-left p-3.5 rounded-xl border bg-surface-light/50 backdrop-blur-sm transition-all duration-200 hover:translate-y-[-2px] ${
                  selected
                    ? "border-[rgba(212,255,0,0.7)] bg-[rgba(212,255,0,0.08)] shadow-[0_4px_20px_-4px_rgba(212,255,0,0.35)] ring-1 ring-[rgba(212,255,0,0.4)]"
                    : "border-border-subtle hover:border-[rgba(212,255,0,0.4)] hover:shadow-md"
                }`}
              >
                {/* subtle gold-gradient border glow on hover, only when unselected */}
                {!selected && (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[rgba(212,255,0,0.08)] via-transparent to-transparent"
                    aria-hidden
                  />
                )}
                {opt.preview && (
                  <div className={`relative h-14 rounded-lg mb-2.5 ${opt.preview}`} />
                )}
                <div className="relative flex items-start gap-2.5">
                  {/* 40×40 gold-tinted square with a lucide icon (or Sparkles fallback) */}
                  {(opt.emoji || opt.icon) && (
                    <div
                      className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                        selected
                          ? "bg-[rgba(212,255,0,0.12)] text-[#D4FF00]"
                          : "bg-[rgba(212,255,0,0.08)] text-[rgba(212,255,0,0.7)] group-hover:bg-[rgba(212,255,0,0.08)] group-hover:text-[#D4FF00]"
                      }`}
                    >
                      {opt.icon ? opt.icon : <EmojiIcon emoji={opt.emoji} size={18} strokeWidth={1.75} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] leading-snug font-medium text-text-primary tracking-tight truncate">
                      {opt.label}
                    </p>
                    {opt.description && (
                      <p className="text-[10px] text-text-muted line-clamp-2 mt-1 leading-snug">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </div>
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#D4FF00] flex items-center justify-center shadow-sm shadow-[rgba(212,255,0,0.3)]">
                    <Check size={9} className="text-black" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      );

    case "chip-select":
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(opt => {
            const arr = (value as string[]) || [];
            const selected = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  const next = selected
                    ? arr.filter(v => v !== opt.value)
                    : [...arr, opt.value];
                  onChange(next);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] border transition-all ${
                  selected
                    ? "bg-[rgba(212,255,0,0.08)] border-[rgba(212,255,0,0.25)] text-[#D4FF00]"
                    : "bg-surface-light border-border-subtle text-text-muted hover:text-text-primary"
                }`}
              >
                {opt.emoji && <EmojiIcon emoji={opt.emoji} size={11} strokeWidth={1.75} />}
                {opt.label}
                {selected && <Check size={10} />}
              </button>
            );
          })}
        </div>
      );

    case "image-upload":
      return (
        <div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => onChange(reader.result as string);
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
            id="wizard-upload"
          />
          <label
            htmlFor="wizard-upload"
            className="block border-2 border-dashed border-border-subtle/60 rounded-xl p-6 text-center cursor-pointer hover:border-[rgba(212,255,0,0.4)] hover:bg-surface-light/50 transition-all"
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value as string} alt="Upload" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <>
                <ImageIcon size={28} className="mx-auto mb-2 text-text-muted" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-[10px] text-text-muted mt-1">PNG, JPG, WEBP</p>
              </>
            )}
          </label>
        </div>
      );
  }
}

/* ── Exported icon helpers (use in step configs) ─────────────────────── */
export const WizardIcons = {
  Type,
  ImageIcon,
  Palette,
  Film,
  Music,
  Wand2,
  Sparkles,
  Zap,
};
