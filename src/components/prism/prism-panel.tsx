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
  PRISM_SHADOWS,
} from "./constants";

/**
 * PrismPanel — the prism split glass container.
 *
 * Sharp corners (zero border-radius), white-tinted glass,
 * blue accent bar, 3D perspective tilt on hover.
 *
 * Reference: _design-previews/93-prism-dashboard.html
 */

interface PrismPanelProps {
  children: ReactNode;
  /** Show the prismatic gradient top bar (2px) */
  rainbow?: boolean;
  /** Show ambient glow circles */
  glow?: boolean;
  /** Use stronger glass surface for hero-level panels */
  strong?: boolean;
  /** Border intensity */
  border?: "subtle" | "default" | "strong";
  /** Custom className for outer wrapper */
  className?: string;
  /** Entrance animation delay (seconds) */
  delay?: number;
  /** Custom padding override */
  padding?: string;
  /** Enable 3D tilt on hover */
  tilt?: boolean;
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
  tilt = false,
}: PrismPanelProps) {
  const glass = strong ? PRISM_GLASS_STRONG : PRISM_GLASS;

  return (
    <motion.div
      className={`relative border overflow-hidden ${padding} ${className}`}
      style={{
        ...glass,
        borderColor: PRISM_BORDERS[border],
        boxShadow: PRISM_SHADOWS.card,
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: PRISM_DURATION.panel,
        delay,
        ease: [...PRISM_EASE],
      }}
      whileHover={
        tilt
          ? {
              y: -4,
              transition: { duration: 0.35, ease: [...PRISM_EASE] },
            }
          : undefined
      }
    >
      {/* Prismatic top bar */}
      {rainbow && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: PRISM_RAINBOW_GRADIENT }}
        />
      )}

      {/* Ambient glow — red top-right, violet bottom-left */}
      {glow && (
        <>
          <div
            className="pointer-events-none absolute -right-20 -top-20 w-56 h-56 blur-3xl"
            style={{ background: "#2563EB", opacity: 0.04, borderRadius: "50%" }}
          />
          <div
            className="pointer-events-none absolute -left-10 -bottom-10 w-40 h-40 blur-2xl"
            style={{ background: "#8B5CF6", opacity: 0.03, borderRadius: "50%" }}
          />
        </>
      )}

      <div className="relative">{children}</div>
    </motion.div>
  );
}
