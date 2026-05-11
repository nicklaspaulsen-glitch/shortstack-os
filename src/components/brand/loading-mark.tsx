"use client";

/**
 * LoadingMark — drop-in animated brand mark for loading states.
 *
 * Two visual modes:
 *  - Default: a Stack 3D mark slowed down to a 24s rotation, with a subtle
 *    breathing pulse on the lime-edged glow ring around it. Used for full-
 *    page loading surfaces (root /loading.tsx, route segments, etc.).
 *  - Reduced motion: a single centered lime dot pulse (no rotation, no
 *    transforms) so the page still feels alive without inducing motion
 *    sickness.
 *
 * Optional `label` prop renders a Bodoni Moda italic caption below the
 * mark. Set `label={null}` to hide the caption (useful for inline use
 * inside cards / suspense boundaries where copy would be redundant).
 */

import { useEffect, useState } from "react";
import BrainMark from "@/components/brand/brain-mark";

interface LoadingMarkProps {
  /** Override the default "loading…" caption. Pass null to hide. */
  label?: string | null;
  /** Visual size — sm = inline, md = section / page. Defaults to "md". */
  size?: "sm" | "md";
  /** Additional className applied to the root element. */
  className?: string;
}

function useReducedMotion(): boolean {
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

export default function LoadingMark({
  label = "loading…",
  size = "md",
  className = "",
}: LoadingMarkProps) {
  const reduceMotion = useReducedMotion();
  const brainSize = size === "sm" ? "sm" : "md";

  if (reduceMotion) {
    // Reduced-motion: dot pulse only. No rotation, no transforms.
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-lime opacity-50 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-lime" />
        </span>
        {label !== null && (
          <span className="font-editorial text-[13px] text-text-muted lowercase">
            {label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        {/* Breathing indigo halo behind the mark */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.4), transparent 70%)",
            animation: "limePulse 2.4s ease-in-out infinite",
          }}
        />
        <BrainMark size={brainSize} glowing />
      </div>
      {label !== null && (
        <span className="font-editorial text-[13px] text-text-muted lowercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
