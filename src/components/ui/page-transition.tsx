"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

/** Easing: out-expo-foundation from brand tokens */
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content in a Framer Motion animated container that
 * fades + slides in on route change. Uses `key={pathname}` so each
 * new route mounts a fresh animation. Respects reduced-motion.
 *
 * Usage in dashboard layout:
 * ```tsx
 * <PageTransition>
 *   {children}
 * </PageTransition>
 * ```
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
      initial={{ opacity: 0, y: 10, scale: 0.988 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: EASE }}
      style={{ transformOrigin: "top center" }}
    >
      {children}
    </motion.div>
  );
}
