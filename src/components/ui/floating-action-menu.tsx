"use client";

/**
 * FloatingActionMenu — Framer Motion spring-animated FAB with staggered actions.
 * Click the + button to reveal contextual quick-actions in a radial/vertical stack.
 * Adapted from 21st.dev/r/serafimcloud/floating-action-menu for ShortStack.
 *
 * Usage:
 *   <FloatingActionMenu
 *     actions={[
 *       { icon: <Plus />, label: "New lead", onClick: () => router.push("/dashboard/leads/new") },
 *       { icon: <Zap />,  label: "Quick task", onClick: () => setTaskOpen(true) },
 *     ]}
 *   />
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FABAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** Optional badge — shows a small count indicator */
  badge?: number;
  disabled?: boolean;
}

interface FloatingActionMenuProps {
  actions: FABAction[];
  /** Trigger button color — defaults to brand accent */
  accentColor?: string;
  /** Position — defaults to bottom-right */
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  /** Direction actions expand — defaults to up */
  direction?: "up" | "left";
  className?: string;
}

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 };

const POSITION_CLASSES = {
  "bottom-right": "fixed bottom-6 right-6 z-50",
  "bottom-left": "fixed bottom-6 left-6 z-50",
  "bottom-center": "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
};

export function FloatingActionMenu({
  actions,
  accentColor = "#2563EB",
  position = "bottom-right",
  direction = "up",
  className,
}: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const toggle = () => setOpen((v) => !v);

  const itemVariants = {
    hidden: (i: number) => ({
      opacity: 0,
      y: direction === "up" ? 12 : 0,
      x: direction === "left" ? 12 : 0,
      scale: 0.82,
      transition: { ...SPRING, delay: reducedMotion ? 0 : i * 0.03 },
    }),
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        ...SPRING,
        delay: reducedMotion ? 0 : (actions.length - 1 - i) * 0.04,
      },
    }),
    exit: (i: number) => ({
      opacity: 0,
      y: direction === "up" ? 8 : 0,
      x: direction === "left" ? 8 : 0,
      scale: 0.88,
      transition: {
        duration: reducedMotion ? 0 : 0.18,
        delay: reducedMotion ? 0 : i * 0.025,
      },
    }),
  };

  return (
    <div className={cn(POSITION_CLASSES[position], "flex flex-col-reverse items-end gap-3", className)}>
      {/* Trigger FAB */}
      <motion.button
        onClick={toggle}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        style={{ backgroundColor: accentColor }}
        whileHover={reducedMotion ? undefined : { scale: 1.07, boxShadow: "0 8px 28px rgba(59,130,246,0.40)" }}
        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
        transition={SPRING}
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
        >
          {open ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </motion.div>

        {/* Ping ring on first render if there are pending actions */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: accentColor }}
            />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white border-2"
              style={{ borderColor: accentColor }}
            />
          </span>
        )}
      </motion.button>

      {/* Action items */}
      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.div
            key={action.label}
            custom={i}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-3"
          >
            {/* Label tooltip */}
            <motion.span
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ delay: reducedMotion ? 0 : (actions.length - 1 - i) * 0.04 + 0.08, duration: 0.18 }}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-text-primary border border-[rgba(99,146,255,0.20)]"
              style={{
                background: "rgba(9,13,24,0.92)",
                backdropFilter: "blur(12px) saturate(150%)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.40)",
              }}
            >
              {action.label}
            </motion.span>

            {/* Action button */}
            <button
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              disabled={action.disabled}
              aria-label={action.label}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-full",
                "shadow-[0_2px_16px_rgba(0,0,0,0.40)] border border-[rgba(99,146,255,0.18)]",
                "text-text-secondary cursor-pointer select-none",
                "transition-all duration-150 ease-out",
                "hover:shadow-[0_4px_20px_rgba(59,130,246,0.20)] hover:border-[rgba(59,130,246,0.30)] hover:text-[#60A5FA]",
                "active:scale-95",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
              style={{ background: "rgba(9,13,24,0.92)", backdropFilter: "blur(12px) saturate(150%)" }}
            >
              <span className="h-5 w-5">{action.icon}</span>
              {action.badge !== undefined && action.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {action.badge > 9 ? "9+" : action.badge}
                </span>
              )}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Backdrop overlay to close on click-outside */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[-1]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default FloatingActionMenu;
