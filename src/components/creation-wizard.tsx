"use client";

/**
 * Generic step-by-step creation wizard.
 * Used by video editor + thumbnail generator to guide newbies through creation.
 *
 * Caller defines steps (id, title, description, field type, options).
 * Wizard handles navigation, progress, preview, and submit.
 */

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Sparkles, X, Zap, Image as ImageIcon, Type, Palette, Film, Music, Wand2, RefreshCw } from "lucide-react";

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
      // Only merge keys that have truthy values — prevents AI helpers from
      // wiping existing user input when the API fails or returns undefined.
      setData(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(patch || {})) {
          if (v !== undefined && v !== null && v !== "") {
            next[k] = v;
          }
        }
        return next;
      });
    } catch (err) {
      console.error("AI helper failed:", err);
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 fade-in" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-border bg-gradient-to-br from-gold/[0.08] via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
              {icon || <Sparkles size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
              <span>Step {stepIdx + 1} of {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-light overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-amber-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step nav rail */}
        <div className="flex gap-1 px-6 pt-3 overflow-x-auto scrollbar-none border-b border-border">
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
                    ? "bg-gold/15 text-gold border-b-2 border-gold"
                    : isDone
                    ? "text-muted hover:text-foreground cursor-pointer"
                    : "text-muted/50 cursor-not-allowed"
                }`}
              >
                {isDone ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                    isCurrent ? "border-gold bg-gold text-black" : "border-muted/30"
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
            <div className="max-w-xl mx-auto">
              <div className="flex items-start gap-3 mb-5">
                {currentStep.icon && (
                  <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold shrink-0">
                    {currentStep.icon}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{currentStep.title}</h3>
                  {currentStep.description && (
                    <p className="text-xs text-muted mt-0.5">{currentStep.description}</p>
                  )}
                </div>
                {currentStep.field.optional && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light text-muted border border-border">
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
                    <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-gold via-amber-400 to-gold opacity-60 blur group-hover:opacity-90 transition-opacity animate-pulse-slow" />
                    <button
                      onClick={runAiHelper}
                      disabled={aiLoading}
                      className="relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-bold shadow-lg shadow-gold/30 hover:shadow-gold/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100"
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
                    <p className="text-[9px] text-center text-muted mt-1.5">or fill it in manually above</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          {currentStep.preview && (
            <div className="w-72 md:w-80 shrink-0 border-l border-border bg-surface-light/40 p-5 overflow-y-auto hidden md:block">
              <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider mb-3 font-semibold">
                <Sparkles size={9} className="text-gold" /> Live Preview
              </div>
              <div className="space-y-2">
                {currentStep.preview(data)}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-border bg-surface-light/30">
          <button
            onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
            disabled={stepIdx === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={12} /> Back
          </button>

          {currentStep.field.optional && (
            <button
              onClick={() => {
                if (isLastStep) handleComplete();
                else setStepIdx(stepIdx + 1);
              }}
              className="px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
            >
              Skip
            </button>
          )}

          <div className="flex-1" />

          {!isLastStep ? (
            <button
              onClick={() => setStepIdx(stepIdx + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canAdvance() || submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
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
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
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
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
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
            className="w-full accent-gold"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>{field.min ?? 0}</span>
            <span className="text-gold font-bold">{String(value ?? field.min ?? 0)}</span>
            <span>{field.max ?? 100}</span>
          </div>
        </div>
      );

    case "toggle":
      return (
        <button
          onClick={() => onChange(!value)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            value ? "bg-gold/15 border-gold/30 text-gold" : "bg-surface-light border-border text-muted"
          }`}
        >
          <span className="text-sm">{value ? "Yes, enabled" : "No, disabled"}</span>
          <div className={`w-10 h-5 rounded-full relative transition-all ${value ? "bg-gold" : "bg-surface-light border border-border"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </button>
      );

    case "color-picker":
      return (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={(value as string) || "#C9A84C"}
            onChange={e => onChange(e.target.value)}
            className="w-16 h-16 rounded-xl cursor-pointer border border-border bg-surface-light"
          />
          <input
            type="text"
            value={(value as string) || "#C9A84C"}
            onChange={e => onChange(e.target.value)}
            placeholder="#C9A84C"
            className="flex-1 px-3 py-2 rounded-lg bg-surface-light border border-border text-sm font-mono focus:outline-none focus:border-gold/50"
          />
        </div>
      );

    case "dropdown":
      return (
        <select
          value={(value as string) || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50"
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(field.options || []).map(opt => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={`relative text-left p-3 rounded-xl border transition-all hover-lift ${
                  selected ? "border-gold bg-gold/10 shadow-lg shadow-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                {opt.preview && (
                  <div className={`h-14 rounded-lg mb-2 ${opt.preview}`} />
                )}
                <div className="flex items-start gap-1.5">
                  {opt.emoji && <span className="text-sm">{opt.emoji}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{opt.label}</p>
                    {opt.description && (
                      <p className="text-[9px] text-muted line-clamp-2 mt-0.5">{opt.description}</p>
                    )}
                  </div>
                </div>
                {selected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                    <Check size={9} className="text-black" />
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
                    ? "bg-gold/15 border-gold/30 text-gold"
                    : "bg-surface-light border-border text-muted hover:text-foreground"
                }`}
              >
                {opt.emoji && <span>{opt.emoji}</span>}
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
            className="block border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-gold/40 hover:bg-surface-light/50 transition-all"
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value as string} alt="Upload" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <>
                <ImageIcon size={28} className="mx-auto mb-2 text-muted" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-[10px] text-muted mt-1">PNG, JPG, WEBP</p>
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
