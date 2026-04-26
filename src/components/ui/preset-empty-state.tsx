"use client";

import { RotateCcw } from "lucide-react";

interface PresetEmptyStateProps {
  onReset: () => void;
  label?: string;
}

/**
 * Illustrated empty card shown when no presets match the current filters.
 * Renders a category-themed SVG + "Reset filters" CTA.
 */
export function PresetEmptyState({ onReset, label = "presets" }: PresetEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4 animate-fade-in">
      {/* Illustrated SVG — search with sparkles */}
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted opacity-70"
      >
        <defs>
          <radialGradient id="pe-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pe-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E4C876" />
            <stop offset="100%" stopColor="#8A7430" />
          </linearGradient>
          <linearGradient id="pe-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {/* Glow backdrop */}
        <circle cx="70" cy="70" r="65" fill="url(#pe-glow)" />

        {/* Magnifying glass */}
        <circle
          cx="60"
          cy="60"
          r="30"
          fill="none"
          stroke="url(#pe-gold)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="60"
          r="20"
          fill="rgba(201,168,76,0.06)"
        />
        <line
          x1="82"
          y1="82"
          x2="108"
          y2="108"
          stroke="url(#pe-gold)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* X inside lens */}
        <line x1="52" y1="52" x2="68" y2="68" stroke="url(#pe-blue)" strokeWidth="3" strokeLinecap="round" />
        <line x1="68" y1="52" x2="52" y2="68" stroke="url(#pe-blue)" strokeWidth="3" strokeLinecap="round" />

        {/* Sparkles */}
        <path d="M110 35 L112 41 L118 43 L112 45 L110 51 L108 45 L102 43 L108 41 Z" fill="url(#pe-gold)" opacity="0.8" />
        <path d="M25 90 L26.5 94 L30.5 96 L26.5 98 L25 102 L23.5 98 L19.5 96 L23.5 94 Z" fill="url(#pe-blue)" opacity="0.6" />
        <circle cx="118" cy="75" r="2.5" fill="url(#pe-gold)" opacity="0.5" />
        <circle cx="28" cy="40" r="2" fill="url(#pe-blue)" opacity="0.4" />
      </svg>

      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-foreground">No {label} match</p>
        <p className="text-[11px] text-muted max-w-[240px] leading-relaxed">
          Try adjusting your search or filters to find what you&apos;re looking for.
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-light px-4 py-2 text-sm text-muted hover:text-foreground hover:border-gold/30 transition-all"
      >
        <RotateCcw size={13} />
        Reset filters
      </button>
    </div>
  );
}

export default PresetEmptyState;
