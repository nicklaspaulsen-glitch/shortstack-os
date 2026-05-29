"use client";

/**
 * edit-library-panel.tsx — Selectable Edit Decision Library
 *
 * After the analyze + suggest pipeline runs, this panel displays every
 * edit decision grouped by category (music, zoom, effect, transition,
 * sfx, caption, broll, cut). Users can:
 *
 *  - Toggle individual decisions on/off
 *  - Swap the primary choice for an alternative
 *  - Bulk enable/disable entire categories
 *  - See director notes explaining each choice
 *  - Filter by category
 *  - Sort by timestamp or confidence
 *
 * The component is controlled: parent passes the EditLibrary and receives
 * onChange callbacks for toggles and swaps.
 */

import { useState, useMemo, useCallback } from "react";
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Circle,
  FunnelSimple,
  Lightning,
  MagnifyingGlass,
  MusicNote,
  Scissors,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  Swap,
  TextAa,
  VideoCamera,
  Warning,
} from "@phosphor-icons/react";
import type {
  EditLibrary,
  EditCategory,
  EditDecision,
  EditDecisionAlternative,
} from "@/lib/auto-edit-types";
import { EDIT_CATEGORIES } from "@/lib/auto-edit-types";

// ── Types ───────────────────────────────────────────────────────────

export interface EditLibraryPanelProps {
  library: EditLibrary;
  /** Called when a decision is toggled on/off. */
  onToggle: (decisionId: string, enabled: boolean) => void;
  /** Called when a decision's primary payload is swapped for an alternative. */
  onSwap: (decisionId: string, alternative: EditDecisionAlternative) => void;
  /** Called when an entire category is bulk-toggled. */
  onBulkToggle: (category: EditCategory, enabled: boolean) => void;
  /** Called when the user finalises their selections. */
  onApply: (enabledDecisionIds: string[]) => void;
  /** Whether the apply action is in progress. */
  applying?: boolean;
}

type SortMode = "time" | "confidence";

// ── Category metadata ───────────────────────────────────────────────

const CATEGORY_META: Record<
  EditCategory,
  { label: string; icon: typeof MusicNote; color: string }
> = {
  music: { label: "Music", icon: MusicNote, color: "text-purple-400" },
  zoom: { label: "Zooms", icon: MagnifyingGlass, color: "text-blue-400" },
  effect: { label: "Effects", icon: Sparkle, color: "text-amber-400" },
  transition: { label: "Transitions", icon: SlidersHorizontal, color: "text-teal-400" },
  sfx: { label: "Sound FX", icon: SpeakerHigh, color: "text-rose-400" },
  caption: { label: "Captions", icon: TextAa, color: "text-lime-400" },
  broll: { label: "B-Roll", icon: VideoCamera, color: "text-indigo-400" },
  cut: { label: "Cuts", icon: Scissors, color: "text-orange-400" },
};

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

function confidencePill(c: number): { bg: string; label: string } {
  if (c >= 0.8) return { bg: "bg-emerald-500/20 text-emerald-400", label: "High" };
  if (c >= 0.5) return { bg: "bg-amber-500/20 text-amber-400", label: "Med" };
  return { bg: "bg-rose-500/20 text-rose-400", label: "Low" };
}

// ── Decision row ────────────────────────────────────────────────────

function DecisionRow({
  decision,
  onToggle,
  onSwap,
}: {
  decision: EditDecision;
  onToggle: (id: string, enabled: boolean) => void;
  onSwap: (id: string, alt: EditDecisionAlternative) => void;
}) {
  const [showAlts, setShowAlts] = useState(false);
  const conf = confidencePill(decision.confidence);

  return (
    <div
      className={`group rounded-lg border transition-all duration-150 ${
        decision.enabled
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/5 bg-white/[0.01] opacity-60"
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Toggle */}
        <button
          onClick={() => onToggle(decision.id, !decision.enabled)}
          className="flex-shrink-0 transition-colors hover:text-[#D4FF00]"
          aria-label={decision.enabled ? "Disable" : "Enable"}
        >
          {decision.enabled ? (
            <CheckCircle weight="fill" className="h-5 w-5 text-[#D4FF00]" />
          ) : (
            <Circle className="h-5 w-5 text-white/30" />
          )}
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white/90">
              {decision.label}
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${conf.bg}`}>
              {conf.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-white/40">
            {decision.description}
          </p>
        </div>

        {/* Timestamp */}
        <span className="flex-shrink-0 font-mono text-xs text-white/30">
          {formatTimestamp(decision.timestamp_sec)}
        </span>

        {/* Alternatives toggle */}
        {decision.alternatives.length > 0 && (
          <button
            onClick={() => setShowAlts(!showAlts)}
            className="flex-shrink-0 rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            aria-label="Show alternatives"
          >
            <Swap className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Director note */}
      {decision.director_note && decision.enabled && (
        <div className="mx-3 mb-2 flex items-start gap-1.5 rounded bg-[#D4FF00]/5 px-2.5 py-1.5">
          <Lightning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#D4FF00]/60" />
          <span className="text-xs leading-relaxed text-[#D4FF00]/60">
            {decision.director_note}
          </span>
        </div>
      )}

      {/* Alternatives panel */}
      {showAlts && decision.alternatives.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/25">
            Swap to
          </p>
          <div className="flex flex-wrap gap-1.5">
            {decision.alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => {
                  onSwap(decision.id, alt);
                  setShowAlts(false);
                }}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/60 transition-all hover:border-[#D4FF00]/30 hover:bg-[#D4FF00]/5 hover:text-white/90"
              >
                {alt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category section ────────────────────────────────────────────────

function CategorySection({
  category,
  decisions,
  onToggle,
  onSwap,
  onBulkToggle,
}: {
  category: EditCategory;
  decisions: EditDecision[];
  onToggle: (id: string, enabled: boolean) => void;
  onSwap: (id: string, alt: EditDecisionAlternative) => void;
  onBulkToggle: (category: EditCategory, enabled: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const enabledCount = decisions.filter((d) => d.enabled).length;
  const allEnabled = enabledCount === decisions.length;

  if (decisions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {/* Category header */}
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-white/50 transition-colors hover:text-white/80"
        >
          {collapsed ? (
            <CaretRight weight="bold" className="h-3 w-3" />
          ) : (
            <CaretDown weight="bold" className="h-3 w-3" />
          )}
          <Icon weight="duotone" className={`h-4 w-4 ${meta.color}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {meta.label}
          </span>
        </button>

        <span className="text-[10px] text-white/25">
          {enabledCount}/{decisions.length}
        </span>

        <div className="flex-1" />

        {/* Bulk toggle */}
        <button
          onClick={() => onBulkToggle(category, !allEnabled)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-all ${
            allEnabled
              ? "bg-white/5 text-white/40 hover:bg-white/10"
              : "bg-[#D4FF00]/10 text-[#D4FF00]/70 hover:bg-[#D4FF00]/20"
          }`}
        >
          {allEnabled ? "Disable all" : "Enable all"}
        </button>
      </div>

      {/* Decision rows */}
      {!collapsed && (
        <div className="space-y-1 pl-1">
          {decisions.map((d) => (
            <DecisionRow
              key={d.id}
              decision={d}
              onToggle={onToggle}
              onSwap={onSwap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────

export function EditLibraryPanel({
  library,
  onToggle,
  onSwap,
  onBulkToggle,
  onApply,
  applying = false,
}: EditLibraryPanelProps) {
  const [activeFilter, setActiveFilter] = useState<EditCategory | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("time");

  const enabledCount = useMemo(() => {
    let count = 0;
    for (const cat of EDIT_CATEGORIES) {
      count += library.categories[cat].filter((d) => d.enabled).length;
    }
    return count;
  }, [library]);

  const filteredCategories = useMemo(() => {
    const cats = activeFilter === "all" ? [...EDIT_CATEGORIES] : [activeFilter];
    return cats.filter((cat) => library.categories[cat].length > 0);
  }, [activeFilter, library]);

  const sortedDecisions = useCallback(
    (decisions: EditDecision[]): EditDecision[] => {
      const sorted = [...decisions];
      if (sortMode === "confidence") {
        sorted.sort((a, b) => b.confidence - a.confidence);
      } else {
        sorted.sort((a, b) => a.timestamp_sec - b.timestamp_sec);
      }
      return sorted;
    },
    [sortMode],
  );

  const handleApply = useCallback(() => {
    const enabledIds: string[] = [];
    for (const cat of EDIT_CATEGORIES) {
      for (const d of library.categories[cat]) {
        if (d.enabled) enabledIds.push(d.id);
      }
    }
    onApply(enabledIds);
  }, [library, onApply]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/90">Edit Library</h3>
            <p className="mt-0.5 text-xs text-white/35">
              {library.total_decisions} decisions across {library.scene_count} scenes
            </p>
          </div>
          {library.director_grade && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#D4FF00]/10 px-2.5 py-1">
              <Lightning weight="fill" className="h-3.5 w-3.5 text-[#D4FF00]" />
              <span className="text-xs font-bold text-[#D4FF00]">
                Grade {library.director_grade}
              </span>
            </div>
          )}
        </div>

        {/* Director summary */}
        {library.director_summary && (
          <p className="mt-2 text-xs leading-relaxed text-white/30">
            {library.director_summary}
          </p>
        )}

        {/* Filter bar */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              activeFilter === "all"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:bg-white/5 hover:text-white/50"
            }`}
          >
            All ({library.total_decisions})
          </button>
          {EDIT_CATEGORIES.map((cat) => {
            const count = library.categories[cat].length;
            if (count === 0) return null;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  activeFilter === cat
                    ? "bg-white/10 text-white/80"
                    : "text-white/30 hover:bg-white/5 hover:text-white/50"
                }`}
              >
                <Icon weight="bold" className={`h-3 w-3 ${activeFilter === cat ? meta.color : ""}`} />
                {meta.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Sort toggle */}
        <div className="mt-2 flex items-center gap-2">
          <FunnelSimple className="h-3 w-3 text-white/20" />
          <button
            onClick={() => setSortMode(sortMode === "time" ? "confidence" : "time")}
            className="text-[10px] text-white/30 transition-colors hover:text-white/50"
          >
            Sort by: {sortMode === "time" ? "Timeline" : "Confidence"}
          </button>
        </div>
      </div>

      {/* Decision list */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {filteredCategories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            decisions={sortedDecisions(library.categories[cat])}
            onToggle={onToggle}
            onSwap={onSwap}
            onBulkToggle={onBulkToggle}
          />
        ))}

        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Warning className="mb-2 h-8 w-8 text-white/15" />
            <p className="text-sm text-white/30">No edit decisions in this category</p>
          </div>
        )}
      </div>

      {/* Footer — apply bar */}
      <div className="flex-shrink-0 border-t border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">
            {enabledCount} of {library.total_decisions} enabled
          </span>
          <button
            onClick={handleApply}
            disabled={applying || enabledCount === 0}
            className="rounded-lg bg-[#D4FF00] px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-[#D4FF00]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applying ? "Applying..." : `Apply ${enabledCount} edits`}
          </button>
        </div>
      </div>
    </div>
  );
}
