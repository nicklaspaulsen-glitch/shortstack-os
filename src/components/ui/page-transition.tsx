"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

/** Premium expo-out easing — snappy, confident page entrances (impeccable ref) */
const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content in a Framer Motion animated container that
 * fades + slides + blur-reveals in on route change. Uses `key={pathname}`
 * so each new route mounts a fresh animation. Respects reduced-motion.
 *
 * Motion design: premium expo-out easing with a subtle blur-reveal
 * entrance — element materialises from soft focus into sharp clarity,
 * inspired by the impeccable motion-design reference.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={{ opacity: 0, y: 12, scale: 0.985, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: EASE_PREMIUM }}
      style={{ transformOrigin: "top center" }}
    >
      {children}
    </motion.div>
  );
}
