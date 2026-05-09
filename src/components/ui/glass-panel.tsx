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

/** Foundation easing — smooth, standard interactions */
const EASE_FOUNDATION: [number, number, number, number] = [0.32, 0.72, 0, 1];
/** Premium easing — snappy, confident for hero/feature moments (impeccable ref) */
const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
  const isElevated = variant === "elevated";

  return (
    <motion.div
      className={`relative ${VARIANTS[variant]} ${SHADOWS[shadow]} ${tilt ? "tilt-3d" : ""} ${hover ? "hover-lift focus-scale" : ""} ${ambient ? "ambient-radial" : ""} ${className}`.trim()}
      // Blur-reveal entrance for elevated panels, fade+slide for others
      initial={reducedMotion ? false : {
        opacity: 0,
        y: isElevated ? 18 : 14,
        scale: isElevated ? 0.97 : 0.985,
        filter: isElevated ? "blur(6px)" : "blur(0px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={{
        duration: reducedMotion ? 0 : isElevated ? 0.5 : 0.44,
        ease: isElevated ? EASE_PREMIUM : EASE_FOUNDATION,
        delay: staggerDelay,
      }}
      {...(hover && !reducedMotion ? {
        whileHover: {
          y: -2,
          transition: { duration: 0.3, ease: EASE_PREMIUM },
        },
      } : {})}
      {...props}
    >
      {children}
    </motion.div>
  );
}
