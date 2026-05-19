/**
 * Remotion Root — registers all compositions for both browser preview
 * (@remotion/player) and server-side rendering (@remotion/renderer).
 *
 * To add a new composition:
 *   1. Import the component below
 *   2. Add a <Composition> entry with a unique `id`
 *
 * Reference: https://www.remotion.dev/docs/composition
 */

import { Composition } from "remotion";
import { VideoOverlay } from "./compositions/VideoOverlay";

// Default composition dimensions — updated per use case via Player props or
// renderMedia `compositionWidth` / `compositionHeight` overrides.
const DEFAULTS = {
  fps: 30,
  durationInFrames: 150, // 5 seconds
  width: 1080,
  height: 1920, // 9:16 vertical (TikTok / Reels)
} as const;

export function RemotionRoot() {
  return (
    <>
      {/* Vertical short-form (9:16) */}
      <Composition
        id="VideoOverlay"
        component={VideoOverlay}
        fps={DEFAULTS.fps}
        durationInFrames={DEFAULTS.durationInFrames}
        width={DEFAULTS.width}
        height={DEFAULTS.height}
        defaultProps={{
          videoUrl: "",
          title: "",
          captionText: "",
          brandColor: "#3B82F6",
          showIntro: true,
          showOutro: true,
        }}
      />

      {/* Landscape (16:9) variant */}
      <Composition
        id="VideoOverlayLandscape"
        component={VideoOverlay}
        fps={DEFAULTS.fps}
        durationInFrames={DEFAULTS.durationInFrames}
        width={1920}
        height={1080}
        defaultProps={{
          videoUrl: "",
          title: "",
          captionText: "",
          brandColor: "#3B82F6",
          showIntro: false,
          showOutro: false,
        }}
      />

      {/* Square (1:1) variant */}
      <Composition
        id="VideoOverlaySquare"
        component={VideoOverlay}
        fps={DEFAULTS.fps}
        durationInFrames={DEFAULTS.durationInFrames}
        width={1080}
        height={1080}
        defaultProps={{
          videoUrl: "",
          title: "",
          captionText: "",
          brandColor: "#3B82F6",
          showIntro: false,
          showOutro: false,
        }}
      />
    </>
  );
}
