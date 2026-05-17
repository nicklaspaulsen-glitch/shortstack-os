"use client";

/**
 * ScrollIndicator — Framer-style page scroll progress bar.
 *
 * Thin bar at the top of the viewport that fills left-to-right
 * as the user scrolls down the page. Uses Framer Motion's
 * useScroll + useSpring for physics-feel smoothing.
 *
 * Usage (in layout or page root):
 *   <ScrollIndicator />
 *
 * Props:
 *   color      — CSS color string (default: brand blue #3B82F6)
 *   height     — bar height in px (default: 2)
 *   zIndex     — stacking order (default: 100)
 *   smoothing  — spring config (default: { stiffness: 300, damping: 40 })
 */

import { useScroll, useSpring, motion } from "framer-motion";

interface ScrollIndicatorProps {
  color?: string;
  height?: number;
  zIndex?: number;
  smoothing?: { stiffness: number; damping: number };
}

export function ScrollIndicator({
  color = "#3B82F6",
  height = 2,
  zIndex = 100,
  smoothing = { stiffness: 300, damping: 40 },
}: ScrollIndicatorProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    ...smoothing,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      className="fixed top-0 left-0 right-0 origin-left pointer-events-none"
      style={{
        scaleX,
        height,
        zIndex,
        background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
        boxShadow: `0 0 8px ${color}88, 0 0 20px ${color}44`,
        transformOrigin: "0% 50%",
      }}
    />
  );
}
