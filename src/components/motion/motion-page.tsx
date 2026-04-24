"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps a dashboard page with a soft fade-up entrance.
 * Use as the outermost element of a page to add a page-transition feel
 * without touching any of the page's data fetching or business logic.
 */
export function MotionPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container — children use `variants={motionCardVariants}`
 * or just rely on automatic cascading.
 */
export function MotionStagger({
  children,
  className,
  staggerDelay = 0.06,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const motionCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
};

/**
 * Card with fade-up-in + hover lift. Drop-in replacement for a plain div
 * wrapping a dashboard card.
 */
export function MotionCard({
  children,
  className,
  style,
  delay = 0,
  liftOnHover = true,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  liftOnHover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={liftOnHover ? { y: -4 } : undefined}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
