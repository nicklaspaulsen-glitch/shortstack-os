"use client";

/**
 * MandalaMark — wraps the production ShortStack logo
 * (`public/icons/shortstack-logo.svg`) in a 3D-feeling continuous
 * rotation. No three.js, no R3F, no canvas — pure CSS transform on
 * the existing flat SVG, so it ships in zero extra JS bundle.
 *
 * The "3D" illusion comes from:
 *   - perspective on the parent (so rotateY actually shears the image
 *     instead of producing a 2D mirror flip)
 *   - a subtle drop-shadow that strengthens at the broadside angle
 *     (the "edge-on" frames where the disc faces the viewer head-on)
 *     and softens at the side-on angle, simulating ambient occlusion.
 *   - ease-out-back timing so the spin starts fast and decelerates
 *     into a held pose every 9.5 seconds, mimicking a coin landing.
 *
 * Apr 28: built in response to the user request "do a cool effect
 * with the flat one instead" — the abstract Stack3D mark was being
 * replaced with a real-logo 3D render via an external AI tool, but
 * this is the in-browser path that works today with zero deps.
 *
 * Sizes:  sm=32px (sidebar)  md=64px (page hero)  lg=128px (login)
 *         xl=240px (404, marketing)
 *
 * Honors prefers-reduced-motion → static logo, no spin.
 */

import { useEffect, useState } from "react";

export type MandalaMarkSize = "sm" | "md" | "lg" | "xl";

export interface MandalaMarkProps {
  size?: MandalaMarkSize;
  /** Spin animation. Default true. */
  spinning?: boolean;
  className?: string;
  /** Override the logo URL — useful for white-label tenants. */
  logoUrl?: string;
}

const SIZE_PX: Record<MandalaMarkSize, number> = {
  sm: 32,
  md: 64,
  lg: 128,
  xl: 240,
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export default function MandalaMark({
  size = "md",
  spinning = true,
  className = "",
  logoUrl = "/icons/shortstack-logo.svg",
}: MandalaMarkProps) {
  const px = SIZE_PX[size];
  const reduce = usePrefersReducedMotion();
  const animate = spinning && !reduce;

  return (
    <span
      className={`mandala-mark inline-flex items-center justify-center ${className}`}
      style={{
        width: px,
        height: px,
        perspective: `${px * 6}px`,
      }}
      aria-hidden="true"
    >
      <span
        className={animate ? "mandala-mark-spinner" : ""}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          willChange: animate ? "transform, filter" : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={px}
          height={px}
          className="block w-full h-full object-contain"
          style={{
            // Drop-shadow gives the edge-on pose visual weight.
            filter: animate
              ? "drop-shadow(0 4px 12px rgba(79,70,229,0.25))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,0.10))",
          }}
        />
      </span>
    </span>
  );
}
