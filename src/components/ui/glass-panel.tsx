"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "md" | "strong" | "indigo";
  tilt?: boolean;
  ambient?: boolean;
  shadow?: "none" | "glass" | "glass-indigo" | "lift";
  className?: string;
  /** Stagger index for entrance animation delay. */
  index?: number;
}

const VARIANTS = {
  default: "glass",
  md: "glass-md",
  strong: "glass-strong",
  indigo: "glass-indigo",
} as const;

const SHADOWS = {
  none: "",
  glass: "shadow-glass",
  "glass-indigo": "shadow-glass-indigo",
  lift: "shadow-lift",
} as const;

export function GlassPanel({
  children,
  variant = "default",
  tilt = false,
  ambient = false,
  shadow = "glass",
  className = "",
  index = 0,
  ...props
}: GlassPanelProps) {
  return (
    <motion.div
      className={`relative rounded-2xl ${VARIANTS[variant]} ${SHADOWS[shadow]} ${tilt ? "tilt-3d" : ""} ${ambient ? "ambient-radial" : ""} ${className}`.trim()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1], delay: index * 0.06 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
