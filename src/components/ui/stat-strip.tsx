"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * StatStrip — compositional stat display that breaks the "identical card grid"
 * anti-pattern. One focal metric gets visual dominance; supporting metrics
 * display in a compact divider-separated strip.
 *
 * Replaces the common `.map((stat) => <PrismPanel>` pattern with hierarchy.
 *
 * Usage:
 *   <StatStrip
 *     focal={{ label: "Pipeline Value", value: "$42,500" }}
 *     support={[
 *       { label: "Won", value: "$12,000", sub: "3 deals" },
 *       { label: "Lost", value: "$5,200", color: "text-rose-700" },
 *       { label: "Win Rate", value: "68%", sub: "+4% vs last mo." },
 *     ]}
 *   />
 */

export interface StatStripItem {
  label: string;
  value: string | number;
  /** Small subtext below value — e.g. "3 deals", "+12% vs last mo." */
  sub?: string;
  /** If false, sub text renders in rose color (for negative indicators) */
  subOk?: boolean;
  /** Optional tailwind text color class for the value — e.g. "text-indigo-700" */
  color?: string;
  /** Optional icon rendered beside the label */
  icon?: ReactNode;
}

interface StatStripProps {
  /** Primary metric — displayed large with visual dominance */
  focal: StatStripItem;
  /** Secondary metrics — displayed in a compact strip with dividers */
  support: StatStripItem[];
  /** Optional className on the outer wrapper */
  className?: string;
  /** Motion stagger base delay (default 0.08) */
  baseDelay?: number;
}

export default function StatStrip({
  focal,
  support,
  className = "",
  baseDelay = 0.08,
}: StatStripProps) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-stretch gap-0 ${className}`}
    >
      {/* Focal stat — larger treatment */}
      <motion.div
        className="py-2 pr-6 md:pr-8 shrink-0"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.38,
          delay: baseDelay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="flex items-center gap-1.5">
          {focal.icon && (
            <span className="text-[#6B7280]">{focal.icon}</span>
          )}
          <p className="text-xs text-[#52525B] uppercase tracking-widest font-normal">
            {focal.label}
          </p>
        </div>
        <p
          className={`font-display text-3xl font-bold tracking-[-0.04em] mt-1 ${focal.color ?? "text-text-primary"}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {focal.value}
        </p>
        {focal.sub && (
          <p
            className="text-[10px] mt-0.5"
            style={{
              color:
                focal.subOk === false ? "#D4FF00" : "#52525B",
            }}
          >
            {focal.sub}
          </p>
        )}
      </motion.div>

      {/* Divider */}
      <div className="hidden md:block w-px self-stretch bg-[rgba(0,0,0,0.08)] mx-0" />
      <div className="block md:hidden h-px w-full bg-[rgba(0,0,0,0.08)] my-3" />

      {/* Support stats strip */}
      <div className="flex flex-1 flex-wrap">
        {support.map((stat, i) => (
          <motion.div
            key={stat.label}
            className={`flex-1 min-w-[100px] py-2 ${
              i > 0
                ? "pl-5 border-l border-[rgba(0,0,0,0.08)]"
                : "md:pl-6"
            } ${i < support.length - 1 ? "pr-5" : ""}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.38,
              delay: baseDelay + 0.12 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="flex items-center gap-1">
              {stat.icon && (
                <span className="text-text-muted">{stat.icon}</span>
              )}
              <p className="text-[10px] text-[#52525B] uppercase tracking-widest font-normal">
                {stat.label}
              </p>
            </div>
            <p
              className={`font-display text-xl font-semibold tracking-[-0.03em] mt-1 ${stat.color ?? "text-text-primary"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {stat.value}
            </p>
            {stat.sub && (
              <p
                className="text-[10px] mt-0.5"
                style={{
                  color:
                    stat.subOk === false ? "#D4FF00" : "#52525B",
                }}
              >
                {stat.sub}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
