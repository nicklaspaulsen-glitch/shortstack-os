/**
 * ShortStack brand mark — geometric stack (2026 refresh).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BRAND GUIDE
 * ─────────────────────────────────────────────────────────────────────────
 * Concept: three gold bars of decreasing width stacked with a slight
 *   horizontal offset. Evokes "short + stack" directly, signalling an
 *   agency operating system built on a clean foundation. Geometric and
 *   confident — no shimmer, no gradient orbs, no decorative swirls.
 *
 * Colours
 *   Primary gold   #C9A84C  — the single source of truth for the brand.
 *                              Solid fill (no gradient). Works on both
 *                              dark (#06080c) and light (#FAFAF7) bgs.
 *   Mono variant   currentColor — inherits from surrounding text colour.
 *
 * Which variant to use when
 *   • Default app chrome / sidebar / marketing → <Logo variant="gold" />
 *   • Email signatures, print, embossed merch,
 *     dark-on-light or light-on-dark watermarks → <Logo variant="mono" />
 *   • Single-pixel favicons / 32px and below → use the SVG directly
 *     (the bars already scale down cleanly).
 *
 * ShortStack is the PARENT company. "Trinity" is the product, and has
 * its own logo (see /trinity-logo.svg and src/lib/brand-config.ts). Do
 * NOT mix the two marks — use this component only for surfaces that
 * represent ShortStack-the-company (founder page, "by ShortStack"
 * subtext, parent-brand email footers, Electron app shell, etc.).
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
}

export default function Logo({
  size = 32,
  variant = "gold",
  className,
  title = "ShortStack",
}: LogoProps) {
  const fill = variant === "gold" ? SHORTSTACK_GOLD : "currentColor";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {/* Bottom bar — widest */}
      <rect x="10" y="42" width="44" height="10" rx="3" fill={fill} opacity="0.55" />
      {/* Middle bar — offset right */}
      <rect x="14" y="27" width="38" height="10" rx="3" fill={fill} opacity="0.78" />
      {/* Top bar — narrowest, full opacity */}
      <rect x="18" y="12" width="32" height="10" rx="3" fill={fill} />
    </svg>
  );
}
