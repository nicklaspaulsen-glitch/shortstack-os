"use client";

/**
 * RollingPreview
 * --------------
 * A marquee-style scrolling band of example outputs used as a subtle
 * background for tool landing states (matches + beats Pikzels-style previews).
 *
 * Pure CSS animation (no JS scroll handler) so it stays smooth.
 * Respects prefers-reduced-motion automatically via the media query in
 * the inline <style jsx> block.
 */

import { useMemo } from "react";

export interface RollingPreviewItem {
  id: string;
  src: string;
  alt?: string;
  tag?: string;
}

export interface RollingPreviewProps {
  items: RollingPreviewItem[];
  direction?: "left" | "right";
  speed?: "slow" | "medium" | "fast";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
  rows?: 1 | 2 | 3;
  opacity?: number;
  className?: string;
}

const ASPECT_CLASS: Record<NonNullable<RollingPreviewProps["aspectRatio"]>, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
};

const SPEED_SECONDS: Record<NonNullable<RollingPreviewProps["speed"]>, number> = {
  slow: 90,
  medium: 60,
  fast: 35,
};

const TILE_WIDTH: Record<NonNullable<RollingPreviewProps["aspectRatio"]>, string> = {
  "16:9": "w-64",
  "9:16": "w-36",
  "1:1": "w-44",
  "4:5": "w-40",
};

export default function RollingPreview({
  items,
  direction = "left",
  speed = "medium",
  aspectRatio = "16:9",
  rows = 2,
  opacity = 0.3,
  className = "",
}: RollingPreviewProps) {
  // Duplicate the list to make the CSS loop seamless. Memoised so React
  // doesn't rebuild the DOM each render.
  const looped = useMemo(() => {
    if (!items || items.length === 0) return [];
    return [...items, ...items];
  }, [items]);

  if (!looped.length) return null;

  const durationSec = SPEED_SECONDS[speed];
  const aspectClass = ASPECT_CLASS[aspectRatio];
  const tileWidth = TILE_WIDTH[aspectRatio];
  const clampedOpacity = Math.max(0, Math.min(1, opacity));

  const rowsArr: Array<{ key: string; dir: "left" | "right" }> = [];
  for (let i = 0; i < rows; i++) {
    // Stack rows alternating direction for visual interest.
    const rowDir: "left" | "right" =
      i % 2 === 0 ? direction : direction === "left" ? "right" : "left";
    rowsArr.push({ key: `row-${i}`, dir: rowDir });
  }

  return (
    <div
      className={`rolling-preview-root relative w-full overflow-hidden pointer-events-none select-none ${className}`}
      style={{ opacity: clampedOpacity }}
      aria-hidden="true"
    >
      {rowsArr.map((row, rowIdx) => (
        <div
          key={row.key}
          className={`rolling-preview-row relative overflow-hidden ${rowIdx > 0 ? "mt-3" : ""}`}
        >
          <div
            className={`rolling-preview-track flex gap-3 w-max ${
              row.dir === "left" ? "rolling-preview-anim-left" : "rolling-preview-anim-right"
            }`}
            style={{ animationDuration: `${durationSec}s` }}
          >
            {looped.map((item, i) => (
              <div
                key={`${row.key}-${item.id}-${i}`}
                className={`rolling-preview-tile group relative flex-shrink-0 ${tileWidth} ${aspectClass} rounded-lg overflow-hidden border border-border bg-surface pointer-events-auto`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={item.alt || "preview"}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {item.tag && (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-black/70 text-gold border border-gold/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes rolling-preview-left {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes rolling-preview-right {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }
        .rolling-preview-anim-left {
          animation-name: rolling-preview-left;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .rolling-preview-anim-right {
          animation-name: rolling-preview-right;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .rolling-preview-anim-left,
          .rolling-preview-anim-right {
            animation: none !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </div>
  );
}
