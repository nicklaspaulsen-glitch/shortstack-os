"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  X,
  Check,
  ChevronRight,
  Loader2,
  Edit3,
  Sparkles,
  SkipForward,
  Save,
  Download,
} from "lucide-react";

export interface WalkthroughStepSetting {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "color" | "toggle" | "slider";
  value: unknown;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  /** What's happening during this step (shown while in_progress) */
  progressText?: string;
  /** Preview content to show after step completes (React node) */
  preview?: ReactNode;
  /** Settings the user can tweak at this step (form-like fields) */
  editableSettings?: WalkthroughStepSetting[];
  /** Called when user tweaks a setting — parent updates config and re-runs this step */
  onSettingChange?: (key: string, value: unknown) => void;
  /** Called when user approves the step */
  onApprove?: () => void;
  /** Called when user skips the step */
  onSkip?: () => void;
}

export type WalkthroughStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

interface WalkthroughProps {
  open: boolean;
  title: string;
  subtitle?: string;
  steps: WalkthroughStep[];
  currentStepIndex: number;
  stepStatus: WalkthroughStepStatus;
  onClose: () => void;
  onCancel?: () => void;
  onFinish?: () => void;
  onJumpToStep?: (stepIndex: number) => void;
  onSave?: () => void;
  onExport?: () => void;
  /** React node shown when all steps complete (the final video/thumbnail result) */
  finalOutput?: ReactNode;
}

const PROGRESS_DOTS = [".", "..", "..."];

export default function CreationWalkthrough({
  open,
  title,
  subtitle,
  steps,
  currentStepIndex,
  stepStatus,
  onClose,
  onCancel,
  onFinish,
  onJumpToStep,
  onSave,
  onExport,
  finalOutput,
}: WalkthroughProps) {
  const [dotIndex, setDotIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Animate the progress dots while a step is in progress
  useEffect(() => {
    if (stepStatus !== "in_progress") return;
    const t = setInterval(() => {
      setDotIndex((i) => (i + 1) % PROGRESS_DOTS.length);
    }, 400);
    return () => clearInterval(t);
  }, [stepStatus]);

  // Reset the "tweak settings" drawer whenever the step changes
  useEffect(() => {
    setShowSettings(false);
  }, [currentStepIndex]);

  const safeIndex = useMemo(() => {
    if (currentStepIndex < 0) return 0;
    if (currentStepIndex >= steps.length) return Math.max(0, steps.length - 1);
    return currentStepIndex;
  }, [currentStepIndex, steps.length]);

  const current = steps[safeIndex];
  const isComplete =
    currentStepIndex >= steps.length - 1 && stepStatus === "completed";
  const progressPct = steps.length
    ? Math.min(
        100,
        Math.round(
          ((safeIndex + (stepStatus === "completed" ? 1 : 0)) / steps.length) *
            100,
        ),
      )
    : 0;

  if (!open || !current) return null;

  function renderStatusIndicator(i: number) {
    if (i < currentStepIndex) {
      return (
        <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <Check size={11} className="text-emerald-400" />
        </span>
      );
    }
    if (i === currentStepIndex) {
      if (stepStatus === "in_progress") {
        return (
          <span className="w-5 h-5 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center shrink-0">
            <Loader2 size={11} className="text-gold animate-spin" />
          </span>
        );
      }
      if (stepStatus === "completed") {
        return (
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Check size={11} className="text-emerald-400" />
          </span>
        );
      }
      if (stepStatus === "failed") {
        return (
          <span className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 text-[10px] text-red-400 font-bold">
            !
          </span>
        );
      }
      return (
        <span className="w-5 h-5 rounded-full border border-gold/40 bg-gold/5 flex items-center justify-center shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-full border border-border bg-surface-light/40 flex items-center justify-center shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-muted/40" />
      </span>
    );
  }

  function renderSettingField(setting: WalkthroughStepSetting) {
    const handle = (v: unknown) => {
      current?.onSettingChange?.(setting.key, v);
    };
    switch (setting.type) {
      case "text":
        return (
          <input
            type="text"
            className="input text-xs w-full"
            value={String(setting.value ?? "")}
            onChange={(e) => handle(e.target.value)}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className="input text-xs w-full"
            value={Number(setting.value ?? 0)}
            min={setting.min}
            max={setting.max}
            step={setting.step ?? 1}
            onChange={(e) => handle(Number(e.target.value))}
          />
        );
      case "select":
        return (
          <select
            className="input text-xs w-full"
            value={String(setting.value ?? "")}
            onChange={(e) => handle(e.target.value)}
          >
            {(setting.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case "color":
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-9 h-9 rounded-lg border border-border bg-transparent cursor-pointer"
              value={String(setting.value ?? "#ffffff")}
              onChange={(e) => handle(e.target.value)}
            />
            <input
              type="text"
              className="input text-xs flex-1 font-mono"
              value={String(setting.value ?? "")}
              onChange={(e) => handle(e.target.value)}
            />
          </div>
        );
      case "toggle":
        return (
          <button
            type="button"
            onClick={() => handle(!setting.value)}
            className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${
              setting.value ? "bg-gold" : "bg-surface-light border border-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                setting.value ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        );
      case "slider":
        return (
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="flex-1 accent-gold"
              value={Number(setting.value ?? 0)}
              min={setting.min ?? 0}
              max={setting.max ?? 100}
              step={setting.step ?? 1}
              onChange={(e) => handle(Number(e.target.value))}
            />
            <span className="text-[10px] font-mono text-gold min-w-[34px] text-right">
              {String(setting.value ?? 0)}
            </span>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-light/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center">
              <Sparkles size={16} className="text-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              {subtitle && (
                <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 shrink-0 border-r border-border bg-surface-light/20 overflow-y-auto">
            <ul className="py-3">
              {steps.map((s, i) => {
                const isActive = i === currentStepIndex;
                const isClickable = onJumpToStep && i < currentStepIndex;
                const textCls =
                  i < currentStepIndex
                    ? "text-foreground"
                    : isActive && stepStatus === "in_progress"
                      ? "text-gold font-semibold"
                      : isActive
                        ? "text-foreground font-semibold"
                        : "text-muted";
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => isClickable && onJumpToStep?.(i)}
                      className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-gold/5 border-l-2 border-gold"
                          : "border-l-2 border-transparent"
                      } ${
                        isClickable
                          ? "hover:bg-surface-light/60 cursor-pointer"
                          : ""
                      }`}
                    >
                      {renderStatusIndicator(i)}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs ${textCls}`}>
                          <span className="text-[10px] text-muted mr-1.5">
                            {i + 1}
                          </span>
                          {s.title}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5 truncate">
                          {s.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isComplete ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Check size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">All done!</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Every step completed. Review the result below.
                    </p>
                  </div>
                </div>

                {finalOutput && (
                  <div className="card-static p-4">{finalOutput}</div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {onSave && (
                    <button
                      onClick={onSave}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <Save size={13} /> Save
                    </button>
                  )}
                  {onExport && (
                    <button
                      onClick={onExport}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Download size={13} /> Export
                    </button>
                  )}
                  {onFinish && (
                    <button
                      onClick={onFinish}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      Finish
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Step title + description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {current.icon && (
                      <span className="text-gold">{current.icon}</span>
                    )}
                    <h3 className="text-base font-semibold">{current.title}</h3>
                  </div>
                  <p className="text-xs text-muted">{current.description}</p>
                </div>

                {/* In-progress indicator */}
                {stepStatus === "in_progress" && (
                  <div className="card-static border-gold/20 bg-gold/5 flex items-center gap-3">
                    <Loader2 size={16} className="text-gold animate-spin" />
                    <div className="flex-1">
                      <div className="text-xs text-gold font-medium">
                        {current.progressText ?? "Working on it"}
                        <span className="inline-block w-5">
                          {PROGRESS_DOTS[dotIndex]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Failure */}
                {stepStatus === "failed" && (
                  <div className="card-static border-red-500/30 bg-red-500/5">
                    <div className="text-xs text-red-400 font-medium">
                      This step failed. You can tweak settings and retry, or
                      skip it.
                    </div>
                  </div>
                )}

                {/* Preview */}
                {current.preview && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted mb-1.5 font-semibold">
                      Preview
                    </div>
                    <div className="rounded-xl border border-border bg-surface-light/30 p-4">
                      {current.preview}
                    </div>
                  </div>
                )}

                {/* Editable settings */}
                {current.editableSettings &&
                  current.editableSettings.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSettings((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] text-gold hover:text-gold/80 font-medium"
                      >
                        <Edit3 size={12} />
                        {showSettings
                          ? "Hide settings"
                          : "Tweak settings and re-run"}
                        <ChevronRight
                          size={12}
                          className={`transition-transform ${
                            showSettings ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {showSettings && (
                        <div className="mt-3 rounded-xl border border-border bg-surface-light/30 p-4 space-y-3">
                          {current.editableSettings.map((s) => (
                            <div
                              key={s.key}
                              className="grid grid-cols-[140px_1fr] gap-3 items-center"
                            >
                              <label className="text-[11px] text-muted">
                                {s.label}
                              </label>
                              <div>{renderSettingField(s)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {onCancel && (
                      <button
                        onClick={onCancel}
                        className="btn-ghost text-xs flex items-center gap-1.5"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {current.onSkip && (
                      <button
                        onClick={current.onSkip}
                        disabled={stepStatus === "in_progress"}
                        className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <SkipForward size={12} /> Skip
                      </button>
                    )}
                    {current.onApprove && (
                      <button
                        onClick={current.onApprove}
                        disabled={
                          stepStatus === "in_progress" ||
                          stepStatus === "failed"
                        }
                        className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={12} />
                        {safeIndex >= steps.length - 1
                          ? "Finish"
                          : "Approve & Continue"}
                        {safeIndex < steps.length - 1 && (
                          <ChevronRight size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: progress bar */}
        <div className="border-t border-border bg-surface-light/30 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-surface-light/60 rounded-full overflow-hidden border border-border/60">
              <div
                className="h-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted font-mono tabular-nums whitespace-nowrap">
              Step {Math.min(currentStepIndex + 1, steps.length)} of{" "}
              {steps.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
