"use client";

/**
 * SafeThumb
 * ---------
 * Drop-in <img> / <video> replacement for tile-grid thumbnails that avoids
 * two known regressions on dashboard visual pages (thumbnail-generator,
 * video-editor, ai-video, etc.):
 *
 *   1. The browser's stock "broken-image" icon flashing while the src is
 *      still loading (read by users as a dead placeholder card).
 *   2. A partially loaded / 404 image leaving a broken icon visible.
 *
 * Mirrors the known-good pattern from `RollingPreview.tsx` — tiles stay at
 * `opacity-0` until `onLoad` fires, then fade to `opacity-100`. On
 * `onError` the inner media is hidden and an optional `fallback` node is
 * rendered in its place (defaults to a muted surface colour).
 *
 * Use for any image/video that renders inside a repeating tile container
 * (preset galleries, creator-style picks, generated-result grids, etc.).
 */

import { useState, type CSSProperties, type ReactNode } from "react";

export interface SafeThumbProps {
  src: string;
  alt?: string;
  /** Rendering mode — defaults to "image". */
  kind?: "image" | "video";
  /** Classes applied to the inner <img>/<video> element. */
  className?: string;
  /** Inline style for the inner element. */
  style?: CSSProperties;
  /** Extra classes on the wrapper <div>. */
  wrapperClassName?: string;
  /** Inline style for the wrapper <div>. */
  wrapperStyle?: CSSProperties;
  /**
   * What to render when the media fails to load. If omitted, the wrapper
   * stays visible as a muted surface square (so the tile slot doesn't
   * collapse and cause layout shift). Pass `null` to hide the tile entirely.
   */
  fallback?: ReactNode;
  /** Video-only — autoplay-on-hover pattern used on ai-video tiles. */
  hoverPlay?: boolean;
  /** Video-only — show native controls. */
  controls?: boolean;
  /** Video-only — muted (required for autoplay). Defaults true. */
  muted?: boolean;
  /** Video-only — loop playback. Defaults true. */
  loop?: boolean;
  /** Video-only — playsInline. Defaults true. */
  playsInline?: boolean;
  /** Optional onClick forwarded to the wrapper. */
  onClick?: () => void;
}

export default function SafeThumb({
  src,
  alt = "",
  kind = "image",
  className = "w-full h-full object-cover",
  style,
  wrapperClassName = "",
  wrapperStyle,
  fallback,
  hoverPlay = false,
  controls = false,
  muted = true,
  loop = true,
  playsInline = true,
  onClick,
}: SafeThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // When the media fails, honour an explicit fallback first. If the caller
  // passed `null` they want the tile to vanish entirely. Otherwise fall
  // through to a muted placeholder so the grid layout stays intact.
  if (failed) {
    if (fallback === null) return null;
    return (
      <div
        className={`relative overflow-hidden bg-surface-light ${wrapperClassName}`}
        style={wrapperStyle}
        onClick={onClick}
      >
        {fallback}
      </div>
    );
  }

  const mediaOpacity = loaded ? "opacity-100" : "opacity-0";

  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={wrapperStyle}
      onClick={onClick}
    >
      {kind === "video" ? (
        <video
          src={src}
          muted={muted}
          loop={loop}
          playsInline={playsInline}
          controls={controls}
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onMouseEnter={
            hoverPlay
              ? (e) => {
                  const v = e.currentTarget;
                  void v.play().catch(() => {});
                }
              : undefined
          }
          onMouseLeave={
            hoverPlay
              ? (e) => {
                  e.currentTarget.pause();
                }
              : undefined
          }
          className={`${className} transition-opacity duration-500 ${mediaOpacity}`}
          style={style}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${className} transition-opacity duration-500 ${mediaOpacity}`}
          style={style}
        />
      )}
    </div>
  );
}
