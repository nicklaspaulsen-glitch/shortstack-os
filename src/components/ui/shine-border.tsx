"use client";

/**
 * ShineBorder — animated gradient border that travels around the card perimeter.
 * Wraps any card content in a position:relative container with a conic-gradient
 * pseudo-element that rotates continuously, revealing a shimmering border.
 * Adapted from 21st.dev/r/serafimcloud/shine-border for ShortStack light theme.
 *
 * Usage:
 *   <ShineBorder>
 *     <MyCard />
 *   </ShineBorder>
 *
 *   <ShineBorder color={["#D4FF00", "#818CF8", "#38BDF8"]} borderWidth={2}>
 *     <MyFeaturedCard />
 *   </ShineBorder>
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ShineBorderProps {
  children: ReactNode;
  className?: string;
  /** Border width in px — defaults to 1.5 */
  borderWidth?: number;
  /** Border-radius token — defaults to 'xl' (12px) */
  borderRadius?: string;
  /** Gradient colors for the shine — defaults to blue brand scale */
  color?: string[];
  /** Animation speed in seconds — defaults to 4 */
  duration?: number;
  /** Inner card background — defaults to white */
  background?: string;
}

export function ShineBorder({
  children,
  className,
  borderWidth = 1.5,
  borderRadius = "12px",
  color = ["#D4FF00", "#93C5FD", "#DBEAFE", "#D4FF00"],
  duration = 4,
  background = "#FFFFFF",
}: ShineBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frame: number;
    let startTime: number | null = null;
    const period = duration * 1000;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const pct = ((timestamp - startTime) % period) / period;
      const angle = pct * 360;

      // Build the conic gradient for the rotating shine
      const gradient = `conic-gradient(from ${angle}deg at 50% 50%, ${color.join(", ")})`;
      el.style.backgroundImage = gradient;

      frame = requestAnimationFrame(tick);
    };

    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      frame = requestAnimationFrame(tick);
    } else {
      // Static gradient for reduced-motion users
      el.style.backgroundImage = `linear-gradient(135deg, ${color.join(", ")})`;
    }

    return () => cancelAnimationFrame(frame);
  }, [color, duration]);

  return (
    <div
      className={cn("relative flex", className)}
      style={{ borderRadius, padding: borderWidth }}
    >
      {/* Rotating gradient layer */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ borderRadius }}
      />

      {/* Inner content surface */}
      <div
        className="relative z-10 flex w-full flex-col"
        style={{
          borderRadius: `calc(${borderRadius} - ${borderWidth}px)`,
          background,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default ShineBorder;
