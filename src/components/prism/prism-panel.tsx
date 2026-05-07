"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  PRISM_EASE,
  PRISM_DURATION,
  PRISM_GLASS,
  PRISM_GLASS_STRONG,
  PRISM_BORDERS,
  PRISM_RAINBOW_GRADIENT,
} from "./constants";

/**
 * PrismPanel — glass container with the prism design language.
 *
 * Replaces the nearly-invisible `.glass` CSS class with the real
 * prism surface: inline glass background, indigo-tinted borders,
 * optional rainbow top bar, optional ambient glow circles.
 *
 * Usage:
 *   <PrismPanel rainbow glow>
 *     <h2>Revenue Overview</h2>
 *     <Chart ... />
 *   </PrismPanel>
 */

interface PrismPanelProps {
  children: ReactNode;
  /** Show the signature rainbow gradient top bar (2px) */
  rainbow?: boolean;
  /** Show ambient glow circles (indigo top-right, emerald bottom-left) */
  glow?: boolean;
  /** Use stronger glass surface for hero-level panels */
  strong?: boolean;
  /** Border intensity: "subtle" | "default" | "strong" */
  border?: "subtle" | "default" | "strong";
  /** Custom className for outer wrapper */
  className?: string;
  /** Entrance animation delay (seconds) */
  delay?: number;
  /** Custom padding override */
  padding?: string;
}

export default function PrismPanel({
  children,
  rainbow = false,
  glow = false,
  strong = false,
  border = "default",
  className = "",
  delay = 0,
  padding = "px-6 py-5",
}: PrismPanelProps) {
  const glass = strong ? PRISM_GLASS_STRONG : PRISM_GLASS;

  return (
    <motion.div
      className={`relative rounded-2xl border overflow-hidden ${padding} ${className}`}
      style={{
        ...glass,
        borderColor: PRISM_BORDERS[border],
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: PRISM_DURATION.panel,
        delay,
        ease: [...PRISM_EASE],
      }}
    >
      {/* Rainbow top bar */}
      {rainbow && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: PRISM_RAINBOW_GRADIENT }}
        />
      )}

      {/* Ambient glow */}
      {glow && (
        <>
          <div className="pointer-events-none absolute -right-20 -top-20 w-56 h-56 rounded-full bg-[#6366F1] opacity-[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-[#10B981] opacity-[0.04] blur-2xl" />
        </>
      )}

      <div className="relative">{children}</div>
    </motion.div>
  );
}
