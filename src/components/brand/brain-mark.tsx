"use client";

/**
 * BrainMark — geometric brain / neural-network logo mark for ShortStack.
 *
 * Design: a 4-lobe symmetrical shape (two brain hemispheres + mirror)
 * built from smooth cubic bezier curves. At distance it reads as a brain;
 * up close it reveals the ShortStack double-S curve geometry.
 *
 * Uses a blue gradient (#2563EB → #60A5FA) matching the brand accent.
 * Supports sm/md/lg/xl sizes and an optional CSS drop-shadow glow.
 */

export type BrainMarkSize = "sm" | "md" | "lg" | "xl";

interface BrainMarkProps {
  /** Visual size. sm=28, md=48, lg=96, xl=192 */
  size?: BrainMarkSize;
  /** Adds a blue CSS drop-shadow for a glowing effect */
  glowing?: boolean;
  /** Additional className applied to the wrapping svg */
  className?: string;
}

const SIZE_PX: Record<BrainMarkSize, number> = {
  sm: 28,
  md: 48,
  lg: 96,
  xl: 192,
};

export default function BrainMark({
  size = "md",
  glowing = false,
  className = "",
}: BrainMarkProps) {
  const px = SIZE_PX[size];

  const glowFilter = glowing
    ? "drop-shadow(0 0 8px rgba(212,255,0,0.7)) drop-shadow(0 0 18px rgba(96,165,250,0.4))"
    : undefined;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ShortStack brain mark"
      style={glowing ? { filter: glowFilter } : undefined}
    >
      <defs>
        <linearGradient
          id="brain-grad"
          x1="4"
          y1="4"
          x2="44"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>

        {/* Soft inner highlight for depth */}
        <radialGradient
          id="brain-shine"
          cx="38%"
          cy="30%"
          r="40%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/*
        ──────────────────────────────────────────────────────────────
        BRAIN SHAPE — two mirrored hemispheres, each with two lobes
        The outer silhouette is one closed path built from C-curves.
        A central dividing groove runs vertically, and a horizontal
        mid-groove separates upper/lower lobes — both as thin strokes.
        ──────────────────────────────────────────────────────────────

        ViewBox: 0 0 48 48   Centre: (24, 24)

        Upper-left lobe:  C-curve bulge to top-left
        Upper-right lobe: C-curve bulge to top-right
        Lower-right lobe: C-curve bulge to bottom-right
        Lower-left lobe:  C-curve bulge to bottom-left

        Entry point: top-centre (24, 7) — start there and wind clockwise.
      */}

      {/* ── Main filled brain silhouette ── */}
      <path
        d="
          M 24 7
          C 18 7, 8 10, 8 18
          C 8 23, 12 26, 17 27
          C 15 29, 14 32, 15 35
          C 16 39, 20 41, 24 41
          C 28 41, 32 39, 33 35
          C 34 32, 33 29, 31 27
          C 36 26, 40 23, 40 18
          C 40 10, 30 7, 24 7
          Z
        "
        fill="url(#brain-grad)"
      />

      {/* ── Shine overlay for glassy depth ── */}
      <path
        d="
          M 24 7
          C 18 7, 8 10, 8 18
          C 8 23, 12 26, 17 27
          C 15 29, 14 32, 15 35
          C 16 39, 20 41, 24 41
          C 28 41, 32 39, 33 35
          C 34 32, 33 29, 31 27
          C 36 26, 40 23, 40 18
          C 40 10, 30 7, 24 7
          Z
        "
        fill="url(#brain-shine)"
      />

      {/* ── Central vertical groove (hemisphere divider) ── */}
      <path
        d="M 24 9 C 23 16, 23 23, 24 31 C 25 37, 24 39, 24 41"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.55"
        fill="none"
      />

      {/* ── Horizontal mid groove (upper/lower lobe divider) ── */}
      <path
        d="M 15 27 C 18 28, 21 28.5, 24 28.5 C 27 28.5, 30 28, 33 27"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.55"
        fill="none"
      />

      {/* ── Upper-left lobe detail crease ── */}
      <path
        d="M 12 15 C 14 13, 17 12, 20 13"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.38"
        fill="none"
      />

      {/* ── Upper-right lobe detail crease ── */}
      <path
        d="M 36 15 C 34 13, 31 12, 28 13"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.38"
        fill="none"
      />

      {/* ── Lower-left lobe detail crease ── */}
      <path
        d="M 13 33 C 15 35, 18 36, 21 35"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.38"
        fill="none"
      />

      {/* ── Lower-right lobe detail crease ── */}
      <path
        d="M 35 33 C 33 35, 30 36, 27 35"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.38"
        fill="none"
      />
    </svg>
  );
}
