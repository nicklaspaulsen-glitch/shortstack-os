"use client";

/**
 * ChoiceCards — shared primitive for "pick one (or many) of these cards" UIs.
 *
 * Replaces the duplicated inline grids-of-buttons pattern used across onboarding,
 * wizards, preset pickers, and brand/template selection flows. Each card shows
 * an optional icon, a title, and an optional description.
 *
 * Supports:
 *   - Single or multi-select
 *   - Keyboard arrow nav + Space/Enter to toggle
 *   - Disabled items (dimmed, not focusable)
 *   - Optional badge (e.g. "Popular")
 *   - 2/3/4 column grids at md+ breakpoint
 *   - sm | md | lg sizing
 */

import { useCallback, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

export interface ChoiceCardItem {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string;
}

export interface ChoiceCardsProps {
  items: ChoiceCardItem[];
  value: string | string[] | null;
  onChange: (v: string | string[]) => void;
  multi?: boolean;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

const SIZE_CARD: Record<"sm" | "md" | "lg", string> = {
  sm: "p-2.5 rounded-lg",
  md: "p-3.5 rounded-xl",
  lg: "p-4 rounded-2xl",
};

const SIZE_ICON: Record<"sm" | "md" | "lg", string> = {
  sm: "w-7 h-7 rounded-md",
  md: "w-9 h-9 rounded-lg",
  lg: "w-10 h-10 rounded-xl",
};

const SIZE_TITLE: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
};

const SIZE_DESC: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[11px]",
};

export default function ChoiceCards({
  items,
  value,
  onChange,
  multi = false,
  columns = 3,
  size = "md",
  className = "",
  ariaLabel,
}: ChoiceCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set<string>(
    multi
      ? Array.isArray(value)
        ? value
        : value
          ? [value]
          : []
      : value && typeof value === "string"
        ? [value]
        : [],
  );

  const toggle = useCallback(
    (id: string) => {
      if (multi) {
        const current = Array.isArray(value) ? value : [];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id];
        onChange(next);
      } else {
        onChange(id);
      }
    },
    [multi, onChange, value],
  );

  const focusable = items.filter((i) => !i.disabled);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      const total = focusable.length;
      if (total === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = (idx + 1) % total;
        const el = containerRef.current?.querySelectorAll<HTMLButtonElement>(
          '[data-choice-card="true"]',
        )[next];
        el?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (idx - 1 + total) % total;
        const el = containerRef.current?.querySelectorAll<HTMLButtonElement>(
          '[data-choice-card="true"]',
        )[prev];
        el?.focus();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const item = focusable[idx];
        if (item) toggle(item.id);
      }
    },
    [focusable, toggle],
  );

  return (
    <div
      ref={containerRef}
      role={multi ? "group" : "radiogroup"}
      aria-label={ariaLabel}
      className={`grid ${GRID_COLS[columns]} gap-2.5 ${className}`}
    >
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        const focusIdx = focusable.findIndex((f) => f.id === item.id);
        return (
          <button
            key={item.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={selected}
            aria-pressed={multi ? selected : undefined}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            data-choice-card="true"
            tabIndex={item.disabled ? -1 : focusIdx === 0 || selected ? 0 : -1}
            onClick={() => !item.disabled && toggle(item.id)}
            onKeyDown={(e) => !item.disabled && onKeyDown(e, focusIdx)}
            className={`relative text-left border transition-all outline-none ${SIZE_CARD[size]} ${
              item.disabled
                ? "opacity-50 cursor-not-allowed border-border bg-surface-light"
                : selected
                  ? "border-gold bg-gold/10 ring-2 ring-gold/30"
                  : "border-border bg-surface-light hover:border-gold/30 focus-visible:border-gold/50 focus-visible:ring-2 focus-visible:ring-gold/20"
            }`}
          >
            {item.badge && (
              <span className="absolute top-2 right-2 text-[8px] px-1.5 py-0.5 bg-gold/10 text-gold rounded-full font-semibold uppercase tracking-wider">
                {item.badge}
              </span>
            )}
            {item.icon && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`${SIZE_ICON[size]} flex items-center justify-center shrink-0 ${
                    selected ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"
                  }`}
                >
                  {item.icon}
                </div>
                {selected && !item.badge && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <Check size={11} className="text-black" />
                  </span>
                )}
              </div>
            )}
            <p
              className={`${SIZE_TITLE[size]} font-semibold text-foreground mb-0.5`}
            >
              {item.title}
            </p>
            {item.description && (
              <p className={`${SIZE_DESC[size]} text-muted leading-snug`}>
                {item.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
