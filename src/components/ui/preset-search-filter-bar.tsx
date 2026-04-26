"use client";

import { Search, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface PresetSearchFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Shared search + filter bar used across all preset library pages.
 * Live-filters with no submit button. Chips rendered from `filters` prop.
 */
export function PresetSearchFilterBar({
  query,
  onQueryChange,
  filters,
  activeFilter = "all",
  onFilterChange,
  placeholder = "Search presets...",
  className = "",
}: PresetSearchFilterBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="input w-full pl-9 pr-9 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      {filters && filters.length > 0 && onFilterChange && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={activeFilter === "all"}
            onClick={() => onFilterChange("all")}
          >
            All
          </FilterChip>
          {filters.map((f) => (
            <FilterChip
              key={f.value}
              active={activeFilter === f.value}
              onClick={() => onFilterChange(f.value)}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
        active
          ? "bg-gold/20 text-gold border border-gold/30"
          : "bg-surface-light/60 text-muted hover:text-foreground border border-transparent hover:border-border"
      }`}
    >
      {children}
    </button>
  );
}

export default PresetSearchFilterBar;
