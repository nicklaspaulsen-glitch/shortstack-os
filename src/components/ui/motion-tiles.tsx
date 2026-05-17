"use client";

/**
 * MotionTiles — Framer-style staggered reveal tile grid.
 *
 * Each tile animates in with a fade + rise when the grid
 * enters the viewport (IntersectionObserver). Tiles stagger
 * with a configurable delay between each.
 *
 * Usage:
 *   <MotionTiles items={tiles} />
 *
 * Or compose raw tiles:
 *   <MotionTileGrid>
 *     <MotionTile delay={0}><YourContent /></MotionTile>
 *     <MotionTile delay={0.08}><YourContent /></MotionTile>
 *   </MotionTileGrid>
 */

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

// ---------------------------------------------------------------------------
// Tile variants
// ---------------------------------------------------------------------------

const TILE_VARIANTS = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

// ---------------------------------------------------------------------------
// MotionTile — single animated tile
// ---------------------------------------------------------------------------

interface MotionTileProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  /** If true the tile controls its own in-view trigger. If false (default),
   *  parent must call useInView and pass `inView` prop. */
  standalone?: boolean;
}

export function MotionTile({
  children,
  delay = 0,
  className = "",
  style,
  standalone = false,
}: MotionTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  const shouldAnimate = standalone ? inView : inView;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={TILE_VARIANTS}
      custom={delay}
      initial="hidden"
      animate={shouldAnimate ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MotionTiles — data-driven version
// ---------------------------------------------------------------------------

export interface TileData {
  id: string;
  /** Large number or emoji shown at top */
  headline?: string;
  /** Main label */
  label: string;
  /** Supporting copy */
  description?: string;
  /** Icon element */
  icon?: ReactNode;
  /** Optional accent hex */
  color?: string;
  /** Span multiple columns */
  colSpan?: 1 | 2;
  /** Span multiple rows */
  rowSpan?: 1 | 2;
}

interface MotionTilesProps {
  items: TileData[];
  /** Gap between tiles in Tailwind units (default: 4 = 1rem) */
  gap?: number;
  /** Stagger delay between tiles in seconds (default: 0.07) */
  stagger?: number;
  className?: string;
}

export function MotionTiles({
  items,
  gap = 4,
  stagger = 0.07,
  className = "",
}: MotionTilesProps) {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-4 gap-${gap} ${className}`}
    >
      {items.map((item, i) => {
        const colClass = item.colSpan === 2 ? "col-span-2" : "col-span-1";
        const rowClass = item.rowSpan === 2 ? "row-span-2" : "row-span-1";

        return (
          <MotionTile
            key={item.id}
            delay={i * stagger}
            standalone
            className={`${colClass} ${rowClass}`}
          >
            <div
              className="h-full min-h-[120px] rounded-2xl p-5 flex flex-col gap-2.5"
              style={{
                background: "rgba(19,24,39,0.70)",
                border: "1px solid rgba(99,146,255,0.11)",
                backdropFilter: "blur(12px)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 20px rgba(0,0,0,0.28)",
              }}
            >
              {/* Icon */}
              {item.icon && (
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{
                    background: item.color
                      ? `${item.color}18`
                      : "rgba(59,130,246,0.14)",
                    color: item.color ?? "#3B82F6",
                  }}
                >
                  {item.icon}
                </span>
              )}

              {/* Headline number / stat */}
              {item.headline && (
                <p
                  className="text-2xl font-extrabold font-display"
                  style={{ color: item.color ?? "#3B82F6" }}
                >
                  {item.headline}
                </p>
              )}

              {/* Label + description */}
              <div className="flex flex-col gap-1 mt-auto">
                <p className="text-sm font-semibold text-white leading-snug">
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </MotionTile>
        );
      })}
    </div>
  );
}
