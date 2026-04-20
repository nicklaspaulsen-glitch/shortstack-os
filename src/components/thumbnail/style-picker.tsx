"use client";

import { useMemo, useState } from "react";
import {
  THUMBNAIL_STYLES,
  STYLE_CATEGORIES,
  type ThumbnailStyle,
  type StyleCategory,
} from "@/lib/thumbnail-styles";

// Drop-in style picker. Shows a search box + category chips on top, then a
// gradient card grid below. Each card = one style preset. Clicking a card
// calls onSelect(styleId). Use it alongside the thumbnail generator form.
//
// Minimal external deps — just React + Tailwind. The parent owns state.

export interface StylePickerProps {
  selectedId?: string;
  onSelect: (style: ThumbnailStyle) => void;
  /** Optional: limit to a specific set of categories. */
  restrictTo?: StyleCategory[];
}

export function StylePicker({ selectedId, onSelect, restrictTo }: StylePickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<StyleCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THUMBNAIL_STYLES.filter((style) => {
      if (restrictTo && !restrictTo.includes(style.category)) return false;
      if (activeCategory !== "all" && style.category !== activeCategory) return false;
      if (!q) return true;
      return (
        style.name.toLowerCase().includes(q) ||
        style.description.toLowerCase().includes(q) ||
        style.category.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory, restrictTo]);

  const visibleCategories = useMemo(() => {
    if (!restrictTo) return STYLE_CATEGORIES;
    return STYLE_CATEGORIES.filter((c) => restrictTo.includes(c.id));
  }, [restrictTo]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder={`Search ${THUMBNAIL_STYLES.length} styles…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
        />
        <span className="text-xs text-white/50">{filtered.length} shown</span>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`rounded-full px-3 py-1 text-xs transition ${
            activeCategory === "all"
              ? "bg-white text-black"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          All
        </button>
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              activeCategory === cat.id
                ? "bg-white text-black"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((style) => {
          const isSelected = selectedId === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(style)}
              className={`group relative aspect-[4/3] overflow-hidden rounded-lg border text-left transition ${
                isSelected
                  ? "border-white ring-2 ring-white/60"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{
                background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
              }}
              title={style.description}
            >
              {/* Reference image overlay if provided */}
              {style.referenceImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={style.referenceImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                  loading="lazy"
                />
              ) : null}

              {/* Label */}
              <div className="relative flex h-full flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2">
                <div className="text-xs font-semibold text-white drop-shadow">{style.name}</div>
                <div className="line-clamp-2 text-[10px] text-white/70">
                  {style.description}
                </div>
              </div>

              {/* Premium badge */}
              {style.premium ? (
                <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
                  PRO
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
          No styles match that search.
        </div>
      ) : null}
    </div>
  );
}
