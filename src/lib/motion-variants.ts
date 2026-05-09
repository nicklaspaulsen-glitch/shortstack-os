/**
 * Canonical Framer Motion variants for ShortStack OS.
 *
 * Brand motion spec (from tokens):
 *   standard  220ms  cubic-bezier(0.32, 0.72, 0, 1)
 *   hero      480ms  60ms sibling stagger
 *   route     320ms  cross-fade
 *   reduced   100ms  cap, transforms off
 *
 * Usage:
 *   <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
 *     <motion.div variants={fadeUp}>...</motion.div>
 *   </motion.div>
 */

import type { Variants } from "framer-motion";

/** Smooth ease-out — the default for all standard transitions. */
const EASE_EXPO = [0.32, 0.72, 0, 1] as const;

// ---------------------------------------------------------------------------
// Container variants (own no visible animation — only coordinate children)
// ---------------------------------------------------------------------------

/** Stagger container — children animate in sequence at 60ms intervals. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0,
    },
  },
};

/** Faster stagger (40ms) for denser grids — stat tiles, icon rows. */
export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

/** Hero stagger (80ms) for large editorial reveals — page heroes, splash. */
export const staggerContainerHero: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

// ---------------------------------------------------------------------------
// Child variants
// ---------------------------------------------------------------------------

/**
 * Fade + subtle upward rise.
 * Default for dashboard cards, list rows, and section content.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_EXPO },
  },
};

/**
 * Slower fade-up for hero content and editorial statements.
 */
export const fadeUpHero: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: EASE_EXPO },
  },
};

/**
 * Pure fade — no translation. Use when y-motion would fight the layout.
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: EASE_EXPO },
  },
};

/**
 * Scale + fade entrance. Use for modals, dialogs, popovers, and dropdowns.
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.22, ease: EASE_EXPO },
  },
};

/**
 * Scale from center for overlays that should "bloom" into view.
 */
export const scaleInCenter: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
};

/**
 * Slide from the left edge — sidebar panels, drawer reveals.
 */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
};

/**
 * Slide from the right edge — detail panels, secondary drawers.
 */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
};

/**
 * Horizontal tab-switch — outgoing tab slides out, incoming slides in.
 * Apply to the tab content wrapper and pass `custom={direction}` where
 * direction is 1 (→ next) or -1 (← prev).
 */
export const tabSwitch: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 24 : -24,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: EASE_EXPO },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
    transition: { duration: 0.18, ease: EASE_EXPO },
  }),
};

// ---------------------------------------------------------------------------
// Route-level transitions (for Next.js page wrappers)
// ---------------------------------------------------------------------------

/** Full-page cross-fade — use as `variants` on the top-most motion.div. */
export const routeTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.32, ease: EASE_EXPO },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: EASE_EXPO },
  },
};

// ---------------------------------------------------------------------------
// Reduced-motion overrides
// ---------------------------------------------------------------------------

/**
 * Returns a reduced-motion-safe variant — replaces transforms with a
 * 100ms opacity-only transition. Use when targeting prefers-reduced-motion
 * explicitly in component logic.
 */
export function reducedMotionVariant(base: Variants): Variants {
  const safe: Variants = {};
  for (const key of Object.keys(base)) {
    const state = base[key];
    if (typeof state === "object" && state !== null) {
      safe[key] = { ...state, x: 0, y: 0, scale: 1 };
      if ((safe[key] as Record<string, unknown>).transition) {
        (safe[key] as Record<string, unknown>).transition = {
          duration: 0.1,
        };
      }
    } else {
      safe[key] = state;
    }
  }
  return safe;
}
