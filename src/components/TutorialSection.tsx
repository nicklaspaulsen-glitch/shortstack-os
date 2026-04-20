"use client";

/**
 * TutorialSection
 * ---------------
 * A clean "How to use it" card grid that sits below a tool's main input.
 * Supports optional lucide icons, step screenshots, and video walkthrough
 * modals. Can persist its open/closed state to localStorage when
 * `collapsible` is enabled.
 */

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { ChevronDown, ChevronUp, Play, X } from "lucide-react";

// Lucide icons are React components that accept SVG props plus some lucide
// specific props. This loose type keeps us compatible with both the classic
// LucideIcon type and newer shapes.
type LucideIconLike = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface TutorialStep {
  number: number;
  title: string;
  description: string;
  icon?: LucideIconLike;
  screenshot?: string;
  videoEmbed?: string;
}

export interface TutorialSectionProps {
  title?: string;
  subtitle?: string;
  steps: TutorialStep[];
  columns?: 1 | 2 | 3 | 4;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const COLUMN_CLASS: Record<NonNullable<TutorialSectionProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

function storageKey(title: string): string {
  return `ss-tutorial-open:${title}`;
}

export default function TutorialSection({
  title = "How to use it",
  subtitle,
  steps,
  columns = 3,
  collapsible = false,
  defaultOpen = true,
}: TutorialSectionProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [videoOpen, setVideoOpen] = useState<string | null>(null);

  // Restore persisted collapsed state (only when collapsible).
  useEffect(() => {
    if (!collapsible) return;
    try {
      const raw = localStorage.getItem(storageKey(title));
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* localStorage unavailable — keep defaultOpen */
    }
  }, [collapsible, title]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(title), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!steps || steps.length === 0) return null;

  const gridClass = COLUMN_CLASS[columns];

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-header mb-0 flex items-center gap-2">{title}</h2>
          {subtitle && <p className="text-[10px] text-muted mt-1">{subtitle}</p>}
        </div>
        {collapsible && (
          <button
            onClick={toggle}
            className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface-light flex-shrink-0"
            aria-expanded={open}
            aria-controls="tutorial-section-grid"
          >
            {open ? (
              <>
                Hide <ChevronUp size={12} />
              </>
            ) : (
              <>
                Show <ChevronDown size={12} />
              </>
            )}
          </button>
        )}
      </div>

      {open && (
        <div id="tutorial-section-grid" className={`mt-4 grid gap-3 ${gridClass}`}>
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface-light/40 hover:border-gold/30 transition-all"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/15 text-gold text-[11px] font-bold flex items-center justify-center border border-gold/30">
                    {step.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {Icon && <Icon size={12} className="text-gold flex-shrink-0" />}
                      <h3 className="text-[11px] font-semibold text-foreground truncate">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {step.screenshot && !step.videoEmbed && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.screenshot}
                    alt={step.title}
                    loading="lazy"
                    className="w-full rounded-lg border border-border/60 object-cover aspect-video"
                  />
                )}

                {step.videoEmbed && (
                  <button
                    onClick={() => setVideoOpen(step.videoEmbed || null)}
                    className="relative w-full rounded-lg overflow-hidden border border-border/60 group/video"
                  >
                    {step.screenshot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={step.screenshot}
                        alt={step.title}
                        loading="lazy"
                        className="w-full object-cover aspect-video"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-gradient-to-br from-surface-light to-surface" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/video:bg-black/50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gold/90 flex items-center justify-center">
                        <Play size={14} className="text-black ml-0.5" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {videoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setVideoOpen(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoOpen(null)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-colors"
              aria-label="Close video"
            >
              <X size={16} />
            </button>
            <iframe
              src={videoOpen}
              title="Tutorial video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </section>
  );
}
