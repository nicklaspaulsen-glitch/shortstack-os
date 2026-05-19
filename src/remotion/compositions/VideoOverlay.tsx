/**
 * Remotion composition: VideoOverlay
 *
 * Layers branded animated overlays on top of any source video URL.
 * Used both for browser preview (@remotion/player) and server-side
 * export (@remotion/renderer on a self-hosted worker).
 *
 * Overlay layers (bottom → top):
 *   1. Source video (full-bleed, object-cover)
 *   2. Optional intro card (frames 0 → 29)
 *   3. Title text — slides in from bottom at frame 20
 *   4. Caption / lower-third — appears at frame 30
 *   5. Optional brand logo — top-right, fades in at frame 5
 *   6. Optional outro card (last 30 frames)
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
  Img,
} from "remotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoOverlayProps {
  /** URL of the source AI-generated video */
  videoUrl?: string;
  /** Short title overlay — defaults to an empty string (no overlay) */
  title?: string;
  /** Caption / lower-third text — defaults to empty string */
  captionText?: string;
  /** Brand accent color hex — default: #3B82F6 */
  brandColor?: string;
  /** Logo image URL — if omitted, no logo is shown */
  logoUrl?: string;
  /** Show a branded 30-frame intro card before the video */
  showIntro?: boolean;
  /** Show a branded 30-frame outro card at the end */
  showOutro?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated lower-third title pill */
function TitleOverlay({
  text,
  brandColor,
  startFrame,
}: {
  text: string;
  brandColor: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterFrame = Math.max(0, frame - startFrame);
  const exitStart = durationInFrames - 45;
  const exitFrame = Math.max(0, frame - exitStart);

  const enterY = spring({ frame: enterFrame, fps, config: { damping: 18, stiffness: 120 } });
  const exitY = spring({ frame: exitFrame, fps, config: { damping: 18, stiffness: 120 } });

  const translateY = interpolate(enterY, [0, 1], [40, 0]) - interpolate(exitY, [0, 1], [0, 40]);
  const opacity = clamp(
    interpolate(enterFrame, [0, 8], [0, 1]) - interpolate(exitFrame, [0, 6], [0, 1]),
    0,
    1,
  );

  if (frame < startFrame) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-start",
        padding: "0 5% 8%",
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          opacity,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${brandColor}44`,
          borderLeft: `3px solid ${brandColor}`,
          borderRadius: 6,
          padding: "8px 14px",
          maxWidth: "85%",
        }}
      >
        <p
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#F0F0F4",
            lineHeight: 1.35,
            margin: 0,
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
}

/** Animated caption / lower-third bar */
function CaptionOverlay({
  text,
  brandColor,
  startFrame,
}: {
  text: string;
  brandColor: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterFrame = Math.max(0, frame - startFrame);
  const exitStart = durationInFrames - 30;
  const exitFrame = Math.max(0, frame - exitStart);

  const opacity = clamp(
    interpolate(enterFrame, [0, 10], [0, 1]) - interpolate(exitFrame, [0, 8], [0, 1]),
    0,
    1,
  );

  if (frame < startFrame) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 0 4%",
      }}
    >
      <div
        style={{
          opacity,
          background: `linear-gradient(90deg, ${brandColor}22 0%, ${brandColor}11 100%)`,
          padding: "5px 16px",
          maxWidth: "90%",
        }}
      >
        <p
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 11,
            fontWeight: 400,
            color: "rgba(240,240,244,0.75)",
            letterSpacing: "0.02em",
            margin: 0,
            textAlign: "center",
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
}

/** Brand logo — top-right corner with fade-in */
function LogoBadge({
  logoUrl,
  startFrame,
}: {
  logoUrl: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const enterFrame = Math.max(0, frame - startFrame);
  const opacity = interpolate(enterFrame, [0, 12], [0, 0.85], {
    extrapolateRight: "clamp",
  });

  if (frame < startFrame) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "5% 5%",
      }}
    >
      <div style={{ opacity }}>
        <Img
          src={logoUrl}
          style={{
            height: 28,
            width: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/** Full-screen intro card (first 30 frames) */
function IntroCard({ brandColor }: { brandColor: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const INTRO_DURATION = 30;
  const exitProgress = spring({
    frame: Math.max(0, frame - (INTRO_DURATION - 12)),
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  const opacity = interpolate(
    frame < INTRO_DURATION - 12 ? frame : INTRO_DURATION,
    [0, 6, INTRO_DURATION],
    [0, 1, 0],
    { extrapolateRight: "clamp" },
  );
  const scale = interpolate(exitProgress, [0, 1], [1, 1.04]);

  if (frame >= INTRO_DURATION) return null;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #020711 0%, #0D1120 60%, ${brandColor}18 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          background: brandColor,
          boxShadow: `0 0 16px ${brandColor}99`,
        }}
      />
    </AbsoluteFill>
  );
}

/** Full-screen outro card (last 30 frames) */
function OutroCard({
  brandColor,
}: {
  brandColor: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const OUTRO_START = durationInFrames - 30;
  const outroFrame = frame - OUTRO_START;

  const enterProgress = spring({
    frame: Math.max(0, outroFrame),
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 0.92], {
    extrapolateRight: "clamp",
  });

  if (frame < OUTRO_START) return null;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #020711 0%, #0D1120 70%, ${brandColor}14 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          background: brandColor,
          boxShadow: `0 0 20px ${brandColor}bb`,
          transform: `scaleX(${interpolate(outroFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" })})`,
        }}
      />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export const VideoOverlay: React.FC<VideoOverlayProps> = ({
  videoUrl = "",
  title = "",
  captionText = "",
  brandColor = "#3B82F6",
  logoUrl,
  showIntro = false,
  showOutro = false,
}) => {
  const INTRO_FRAMES = showIntro ? 30 : 0;
  const contentStart = INTRO_FRAMES;
  const titleStart = contentStart + 20;
  const captionStart = contentStart + 30;
  const logoStart = contentStart + 5;

  return (
    <AbsoluteFill style={{ background: "#020711", overflow: "hidden" }}>
      {/* Source video — only render when a URL is provided */}
      {videoUrl && (
        <AbsoluteFill>
          <Video
            src={videoUrl}
            startFrom={0}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Intro card overlays the video for first INTRO_FRAMES */}
      {showIntro && <IntroCard brandColor={brandColor} />}

      {/* Title overlay */}
      {title && (
        <TitleOverlay text={title} brandColor={brandColor} startFrame={titleStart} />
      )}

      {/* Caption */}
      {captionText && (
        <CaptionOverlay text={captionText} brandColor={brandColor} startFrame={captionStart} />
      )}

      {/* Logo */}
      {logoUrl && (
        <LogoBadge logoUrl={logoUrl} startFrame={logoStart} />
      )}

      {/* Outro */}
      {showOutro && <OutroCard brandColor={brandColor} />}
    </AbsoluteFill>
  );
};
