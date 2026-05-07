"use client";

import { motion } from "framer-motion";
import {
  PRISM_ACCENTS,
  PRISM_EASE,
  PRISM_DURATION,
  PRISM_STAGGER,
  PRISM_GLASS,
  PRISM_BORDERS,
} from "./constants";

/**
 * PrismStatStrip — horizontal strip of stat tiles with:
 *   - Rainbow top bar (gradient across all prism accent colors)
 *   - Per-tile bottom accent bar in the tile's accent color
 *   - Inline glass surface (not .glass CSS class)
 *   - Staggered entrance animation with cubic-bezier overshoot
 *   - Indigo-tinted borders and dividers
 *
 * Extracted from analytics/page.tsx + clients/page.tsx as the
 * canonical "prism split" design pattern.
 *
 * Usage:
 *   <PrismStatStrip tiles={[
 *     { label: "MRR", value: "$12,400", sub: "monthly recurring" },
 *     { label: "Active", value: "24", sub: "82% retention" },
 *   ]} />
 */

export interface PrismTile {
  label: string;
  value: string;
  sub?: string;
  /** Override the auto-assigned accent color for this tile */
  accent?: string;
}

interface PrismStatStripProps {
  tiles: PrismTile[];
  /** Custom accent palette — defaults to PRISM_ACCENTS */
  accents?: readonly string[];
  /** Number of columns on md+ breakpoint — defaults to tile count */
  columns?: number;
  className?: string;
}

export default function PrismStatStrip({
  tiles,
  accents = PRISM_ACCENTS,
  columns,
  className = "",
}: PrismStatStripProps) {
  const cols = columns ?? tiles.length;
  const gridClass =
    cols <= 2
      ? "grid-cols-2"
      : cols <= 3
        ? "grid-cols-2 md:grid-cols-3"
        : "grid-cols-2 md:grid-cols-4";

  // Build rainbow gradient from the accents actually used
  const usedAccents = tiles.map((t, i) => t.accent ?? accents[i % accents.length]);
  const rainbow = `linear-gradient(to right, ${usedAccents.join(", ")})`;

  return (
    <motion.div
      className={`relative border overflow-hidden ${className}`}
      style={{
        ...PRISM_GLASS,
        borderColor: PRISM_BORDERS.default,
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: PRISM_DURATION.panel, ease: [...PRISM_EASE] }}
    >
      {/* Rainbow top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: rainbow }}
      />

      <div className={`grid ${gridClass} md:divide-x divide-[rgba(255,255,255,0.07)]`}>
        {tiles.map((tile, i) => {
          const accent = tile.accent ?? accents[i % accents.length];
          return (
            <motion.div
              key={tile.label}
              className="relative px-6 py-4 flex flex-col gap-1 overflow-hidden"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: PRISM_DURATION.tile,
                delay: PRISM_STAGGER * i,
                ease: [...PRISM_EASE],
              }}
            >
              <span className="text-[11px] font-medium uppercase tracking-[1.2px] text-[#4A4A5A]">
                {tile.label}
              </span>
              <span
                className="text-[32px] font-semibold tracking-[-0.5px]"
                style={{ color: "#F0F0F4", fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
              >
                {tile.value}
              </span>
              {tile.sub && (
                <span className="text-xs text-[#7A7A8E]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{tile.sub}</span>
              )}
              {/* Bottom accent bar */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-70"
                style={{
                  background: `linear-gradient(to right, ${accent}, transparent)`,
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
