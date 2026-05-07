"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  PRISM_EASE,
  PRISM_DURATION,
  PRISM_GLASS,
  PRISM_BORDERS,
} from "./constants";

/**
 * PrismSection — collapsible accordion section in prism style.
 *
 * Extracted from analytics/page.tsx Accordion component. Use for
 * expandable dashboard sections with the prism glass surface.
 */

interface PrismSectionProps {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function PrismSection({
  label,
  icon,
  badge,
  expanded,
  onToggle,
  children,
}: PrismSectionProps) {
  return (
    <div
      className="border overflow-hidden"
      style={{
        ...PRISM_GLASS,
        borderColor: PRISM_BORDERS.default,
      }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-6 py-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#4A4A5A]">{icon}</span>
          <span className="font-display text-sm font-semibold text-[#F0F0F4] tracking-[-0.01em]">
            {label}
          </span>
          {badge}
        </div>
        {expanded ? (
          <ChevronDown size={13} className="text-[#4F4D58]" />
        ) : (
          <ChevronRight size={13} className="text-[#4F4D58]" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: PRISM_DURATION.section, ease: [...PRISM_EASE] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-6 pb-6 border-t border-[rgba(255,255,255,0.04)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
