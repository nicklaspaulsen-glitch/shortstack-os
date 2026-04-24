/**
 * ShortStack brand mark — mandala refresh (2026).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BRAND GUIDE
 * ─────────────────────────────────────────────────────────────────────────
 * Concept: ancient-mandala-meets-modern-stack. A radial composition of
 *   8-fold and 16-fold symmetric elements radiating out from a central
 *   stacked-bars monogram. Evokes signal, resonance, and foundations —
 *   fitting for an agency operating system.
 *
 * Structure, center-out:
 *   1. Central stacked-bars monogram (3 gold bars, decreasing width —
 *      the original "short + stack" mark lives on at the heart).
 *   2. Inner ring: 8-point starburst of triangular rays.
 *   3. Mid ring: 16 stepped "gear-tooth" wedges.
 *   4. Outer ring: thin rim with 32 notches.
 *
 * Colours
 *   Primary gold   #C9A84C  — single source of truth for the brand.
 *                              "gold" variant uses a 3-stop gradient
 *                              (#E4C876 → #C9A84C → #8A6F2F) for depth.
 *   Mono variant   currentColor — inherits from surrounding text colour.
 *
 * Variants
 *   • Default app chrome / sidebar / marketing → <Logo variant="gold" />
 *   • Email signatures, print, embossed merch,
 *     dark-on-light or light-on-dark watermarks → <Logo variant="mono" />
 *   • Single-pixel favicons / 16px and below → the geometry simplifies
 *     cleanly; at very small sizes the mid-ring wedges merge visually
 *     into a gold disc, which is fine.
 *
 * ShortStack is the PARENT company. Trinity is the product — its logo
 * shares the same mandala geometry (see /trinity-logo.svg) so the
 * family reads consistently.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React from "react";

export const SHORTSTACK_GOLD = "#C9A84C" as const;

export interface LogoProps {
  /** Pixel size (width & height). Default 32. */
  size?: number;
  /** "gold" (default) renders the primary gold mark. "mono" uses currentColor. */
  variant?: "gold" | "mono";
  /** Optional className applied to the root <svg>. */
  className?: string;
  /** Accessible label override. Default "ShortStack". */
  title?: string;
  /** Hide the outer rim + notches + mid-ring wedges (keeps the central
   *  monogram + starburst only). Useful when the mark needs to feel
   *  lighter, e.g. inside a tight navbar. */
  compact?: boolean;
}

export default function Logo({
  size = 32,
  variant = "gold",
  className,
  title = "ShortStack",
  compact = false,
}: LogoProps) {
  const isGold = variant === "gold";
  const fill = isGold ? "url(#logo-gold)" : "currentColor";
  const solid = isGold ? SHORTSTACK_GOLD : "currentColor";
  // Unique id so multiple <Logo> instances on one page don't collide.
  const uid = React.useId().replace(/:/g, "");
  const goldId = `logo-gold-${uid}`;
  const coreId = `logo-core-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {isGold && (
        <defs>
          <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E4C876" />
            <stop offset="55%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#8A6F2F" />
          </linearGradient>
          <radialGradient id={coreId} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#1a1410" />
            <stop offset="100%" stopColor="#06080c" />
          </radialGradient>
        </defs>
      )}

      <g transform="translate(128 128)">
        {!compact && (
          <>
            {/* Outer rim */}
            <circle r={118} fill="none" stroke={solid} strokeOpacity={0.55} strokeWidth={1.2} />
            <circle r={108} fill="none" stroke={solid} strokeOpacity={0.35} strokeWidth={0.8} />
            {/* 32 outer notches */}
            <g opacity={0.75}>
              {NOTCH_ANGLES.map(a => (
                <rect
                  key={`n${a}`}
                  x={-1.2}
                  y={-118}
                  width={2.4}
                  height={6}
                  rx={0.6}
                  fill={solid}
                  transform={`rotate(${a})`}
                />
              ))}
            </g>
            {/* 16 mid-ring wedges */}
            <g>
              {WEDGE_ANGLES.map(a => (
                <path
                  key={`w${a}`}
                  d="M -6 -102 L 6 -102 L 8 -92 L 4 -86 L 4 -78 L -4 -78 L -4 -86 L -8 -92 Z"
                  fill={isGold ? `url(#${goldId})` : "currentColor"}
                  transform={`rotate(${a})`}
                />
              ))}
            </g>
            {/* Connecting ring */}
            <circle r={72} fill="none" stroke={solid} strokeOpacity={0.4} strokeWidth={1} />
          </>
        )}

        {/* Inner starburst — always visible */}
        <g>
          {RAY_ANGLES.map(a => (
            <path
              key={`r${a}`}
              d="M 0 -70 L 7 -44 L 0 -48 L -7 -44 Z"
              fill={isGold ? `url(#${goldId})` : "currentColor"}
              transform={`rotate(${a})`}
            />
          ))}
        </g>

        {/* Central hub */}
        <circle
          r={42}
          fill={isGold ? `url(#${coreId})` : "none"}
          stroke={solid}
          strokeOpacity={0.7}
          strokeWidth={1.5}
        />

        {/* Stacked-bars monogram */}
        <g transform="translate(-28 -22)">
          <rect x={0} y={30} width={56} height={11} rx={3} fill={fill} opacity={0.55} />
          <rect x={4} y={15} width={48} height={11} rx={3} fill={fill} opacity={0.8} />
          <rect x={8} y={0} width={40} height={11} rx={3} fill={fill} />
        </g>
      </g>
    </svg>
  );
}

// Pre-computed rotation angles — kept module-scoped so the arrays are
// allocated once instead of on every render.
const NOTCH_ANGLES = [
  0, 11.25, 22.5, 33.75, 45, 56.25, 67.5, 78.75,
  90, 101.25, 112.5, 123.75, 135, 146.25, 157.5, 168.75,
  180, 191.25, 202.5, 213.75, 225, 236.25, 247.5, 258.75,
  270, 281.25, 292.5, 303.75, 315, 326.25, 337.5, 348.75,
];
const WEDGE_ANGLES = [
  0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5,
  180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5,
];
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
