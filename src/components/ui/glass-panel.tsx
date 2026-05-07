"use client";

import { motion, HTMLMotionProps, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "md" | "strong" | "indigo" | "elevated";
  tilt?: boolean;
  ambient?: boolean;
  /** Enable hover-lift interaction (translateY + shadow deepen). */
  hover?: boolean;
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
  elevated: "glass-elevated",
} as const;

const SHADOWS = {
  none: "",
  glass: "shadow-glass",
  "glass-indigo": "shadow-glass-indigo",
  lift: "shadow-lift",
} as const;

/** Easing curve: out-expo-foundation from brand tokens */
const EASE_OUT_EXPO: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function GlassPanel({
  children,
  variant = "default",
  tilt = false,
  ambient = false,
  hover = false,
  shadow = "glass",
  className = "",
  index = 0,
  ...props
}: GlassPanelProps) {
  const reducedMotion = useReducedMotion();
  const staggerDelay = reducedMotion ? 0 : index * 0.06;

  return (
    <motion.div
      className={`relative ${VARIANTS[variant]} ${SHADOWS[shadow]} ${tilt ? "tilt-3d" : ""} ${hover ? "hover-lift" : ""} ${ambient ? "ambient-radial" : ""} ${className}`.trim()}
      initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reducedMotion ? 0 : 0.44,
        ease: EASE_OUT_EXPO,
        delay: staggerDelay,
      }}
      {...(hover && !reducedMotion ? {
        whileHover: { y: -2, transition: { duration: 0.22, ease: EASE_OUT_EXPO } },
      } : {})}
      {...props}
    >
      {children}
    </motion.div>
  );
}
