"use client";

/**
 * RemotionOverlayPlayer
 *
 * Wraps @remotion/player's <Player> to preview the VideoOverlay composition
 * in the browser. Accepts the same props as the VideoOverlay composition.
 *
 * Usage:
 *   import RemotionOverlayPlayer from "@/components/video-editor/remotion-overlay-player";
 *
 *   <RemotionOverlayPlayer
 *     videoUrl="https://..."
 *     title="Product launch"
 *     aspectRatio="9:16"
 *     brandColor="#3B82F6"
 *     durationSeconds={5}
 *   />
 *
 * Note: @remotion/player is lazily imported on first render to keep the
 * initial bundle size small (Remotion is ~200kb gzipped).
 */

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { VideoOverlayProps } from "@/remotion/compositions/VideoOverlay";

// Lazily import the Remotion Player — avoids SSR issues and keeps initial
// JS bundle lean. The `ssr: false` flag is required because the Player uses
// browser-only APIs (ResizeObserver, requestAnimationFrame, canvas).
const Player = dynamic(
  () => import("@remotion/player").then((mod) => ({ default: mod.Player })),
  { ssr: false },
);

// Import composition lazily as well so it only loads when the player renders.
const VideoOverlayComp = dynamic(
  () =>
    import("@/remotion/compositions/VideoOverlay").then((mod) => ({
      default: mod.VideoOverlay,
    })),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Dimension helpers
// ---------------------------------------------------------------------------

const ASPECT_DIMENSIONS: Record<
  string,
  { compositionWidth: number; compositionHeight: number; compositionId: string }
> = {
  "9:16": {
    compositionWidth: 1080,
    compositionHeight: 1920,
    compositionId: "VideoOverlay",
  },
  "16:9": {
    compositionWidth: 1920,
    compositionHeight: 1080,
    compositionId: "VideoOverlayLandscape",
  },
  "1:1": {
    compositionWidth: 1080,
    compositionHeight: 1080,
    compositionId: "VideoOverlaySquare",
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RemotionOverlayPlayerProps extends VideoOverlayProps {
  /** Aspect ratio of the source video (determines composition dimensions) */
  aspectRatio?: "9:16" | "16:9" | "1:1";
  /** Video duration in seconds — default 5 */
  durationSeconds?: number;
  /** Render height of the player element in pixels — default 320 */
  playerHeight?: number;
  /** Whether to autoplay on mount */
  autoPlay?: boolean;
  /** Whether to show the Remotion player controls */
  controls?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RemotionOverlayPlayer({
  videoUrl,
  title = "",
  captionText = "",
  brandColor = "#3B82F6",
  logoUrl,
  showIntro = false,
  showOutro = false,
  aspectRatio = "9:16",
  durationSeconds = 5,
  playerHeight = 320,
  autoPlay = false,
  controls = true,
}: RemotionOverlayPlayerProps) {
  const dims = ASPECT_DIMENSIONS[aspectRatio] ?? ASPECT_DIMENSIONS["9:16"];
  const durationInFrames = Math.max(30, Math.round(durationSeconds * 30));

  // Memoize props to avoid unnecessary re-renders inside the Player
  const inputProps = useMemo<VideoOverlayProps>(
    () => ({
      videoUrl,
      title,
      captionText,
      brandColor,
      logoUrl,
      showIntro,
      showOutro,
    }),
    [videoUrl, title, captionText, brandColor, logoUrl, showIntro, showOutro],
  );

  if (!videoUrl) return null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: aspectRatio === "9:16" ? `${Math.round(playerHeight * (9 / 16))}px` : "100%",
        margin: "0 auto",
      }}
    >
      <Player
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={VideoOverlayComp as any}
        durationInFrames={durationInFrames}
        fps={30}
        compositionWidth={dims.compositionWidth}
        compositionHeight={dims.compositionHeight}
        style={{ width: "100%", borderRadius: 8, overflow: "hidden" }}
        controls={controls}
        autoPlay={autoPlay}
        loop
        inputProps={inputProps}
        spaceKeyToPlayOrPause
        clickToPlay
      />
    </div>
  );
}
