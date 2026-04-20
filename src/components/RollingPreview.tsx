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
 *
 * When `fetchRemote` is true and `tool` is provided, the component queries
 * the public `preview_content` table for real curated viral assets and falls
 * back to the caller-supplied static list when the DB returns fewer than 6
 * rows (or errors out). Thumbnails are served directly from ytimg.com —
 * no rehosting.
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RollingPreviewItem {
  id: string;
  /**
   * Image src. Omit when using `variant="text"` — provide `text` instead.
   */
  src?: string;
  alt?: string;
  tag?: string;
  /**
   * Text body rendered as a "fake screenshot" card (only used when the
   * component is rendered with `variant="text"`). Short — 1-3 lines.
   */
  text?: string;
  /**
   * Optional headline shown above the body text (text variant only).
   */
  title?: string;
  /**
   * Optional CSS gradient for the tile background (text variant only).
   * Falls back to a rotating curated palette based on card index.
   */
  gradient?: string;
}

export interface RollingPreviewProps {
  items: RollingPreviewItem[];
  direction?: "left" | "right";
  speed?: "slow" | "medium" | "fast";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
  rows?: 1 | 2 | 3;
  opacity?: number;
  className?: string;
  /**
   * "image" (default) renders each item as <img src>. "text" renders each
   * item as a gradient card with `title`/`text` instead — useful for
   * copy-focused tools (copywriter, script-lab) where there's no image.
   */
  variant?: "image" | "text";
  /**
   * When true, the component queries the `preview_content` table for real
   * curated viral assets scoped to `tool`. Falls back to `items` when the
   * DB returns <6 rows or errors. Defaults to false.
   */
  fetchRemote?: boolean;
  /**
   * Which tool bucket to query — one of "thumbnails", "video_editor",
   * "ai_video", "carousel", "ads". Required when `fetchRemote` is true.
   */
  tool?: string;
  /**
   * Optional — filter remote rows by kind ("thumbnail" | "video_clip").
   * Defaults to "thumbnail" because marquees render best with stills.
   */
  remoteKind?: "thumbnail" | "video_clip";
  /**
   * Minimum remote rows required before replacing the static fallback.
   * Defaults to 6 to guarantee a filled row at any speed/aspect ratio.
   */
  minRemoteRows?: number;
}

// Curated gradient palette used as a fallback for text-card tiles when the
// item itself doesn't specify a gradient. Mirrors the app's gold / dark
// surface palette with just enough variety to feel like different outputs.
const TEXT_CARD_GRADIENTS = [
  "linear-gradient(135deg, #1f1b0e 0%, #2a2413 50%, #3a3018 100%)",
  "linear-gradient(135deg, #0e1a1f 0%, #13262a 50%, #18343a 100%)",
  "linear-gradient(135deg, #1f0e1a 0%, #2a1326 50%, #3a1834 100%)",
  "linear-gradient(135deg, #1a1f0e 0%, #262a13 50%, #343a18 100%)",
  "linear-gradient(135deg, #0e0f1f 0%, #13152a 50%, #181b3a 100%)",
  "linear-gradient(135deg, #1f140e 0%, #2a1d13 50%, #3a2718 100%)",
];

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
  variant = "image",
  fetchRemote = false,
  tool,
  remoteKind = "thumbnail",
  minRemoteRows = 6,
}: RollingPreviewProps) {
  // Remote items (from preview_content) — only used when fetchRemote=true.
  const [remoteItems, setRemoteItems] = useState<RollingPreviewItem[] | null>(null);

  useEffect(() => {
    if (!fetchRemote || !tool) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("preview_content")
          .select("id, media_url, title, tag, kind")
          .eq("tool", tool)
          .eq("kind", remoteKind)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(60);
        if (cancelled || error || !data) return;
        type Row = { id: string; media_url: string | null; title: string | null; tag: string | null };
        const rows = data as Row[];
        const mapped: RollingPreviewItem[] = rows
          .filter((r): r is Row & { media_url: string } => typeof r.media_url === "string" && r.media_url.length > 0)
          .map((r) => ({
            id: String(r.id),
            src: r.media_url,
            alt: r.title || "preview",
            tag: r.tag || undefined,
          }));
        if (mapped.length >= minRemoteRows) setRemoteItems(mapped);
      } catch {
        /* swallow — fall back to static items */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRemote, tool, remoteKind, minRemoteRows]);

  const sourceItems = remoteItems && remoteItems.length >= minRemoteRows ? remoteItems : items;

  // Duplicate the list to make the CSS loop seamless. Memoised so React
  // doesn't rebuild the DOM each render.
  const looped = useMemo(() => {
    if (!sourceItems || sourceItems.length === 0) return [];
    return [...sourceItems, ...sourceItems];
  }, [sourceItems]);

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
            {looped.map((item, i) => {
              const tileKey = `${row.key}-${item.id}-${i}`;
              if (variant === "text") {
                const gradient =
                  item.gradient ||
                  TEXT_CARD_GRADIENTS[i % TEXT_CARD_GRADIENTS.length];
                return (
                  <div
                    key={tileKey}
                    className={`rolling-preview-tile group relative flex-shrink-0 ${tileWidth} ${aspectClass} rounded-lg overflow-hidden border border-border pointer-events-auto`}
                    style={{ background: gradient }}
                  >
                    <div className="absolute inset-0 flex flex-col justify-center p-3 text-left">
                      {item.tag && (
                        <span className="text-[9px] uppercase tracking-widest text-gold/80 font-semibold mb-1.5">
                          {item.tag}
                        </span>
                      )}
                      {item.title && (
                        <h4 className="text-[11px] font-semibold text-white leading-tight mb-1 line-clamp-2">
                          {item.title}
                        </h4>
                      )}
                      {item.text && (
                        <p className="text-[10px] text-white/75 leading-snug line-clamp-4">
                          {item.text}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={tileKey}
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
              );
            })}
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
