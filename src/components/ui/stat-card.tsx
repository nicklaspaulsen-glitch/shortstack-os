"use client";

import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { tokens, themeTokens } from "@/lib/brand/tokens";

/**
 * StatCard — number-display tile used across the dashboard.
 *
 * Foundation rebuild (Apr 27): OLED surface + lime-tinted border, multi-layer
 * shadow system (hard, mid, glow), Satoshi-display value, optional sparkline,
 * bento size variants. The original `label`, `value`, `change`, `changeType`,
 * `icon`, and `premium` props are preserved unchanged so the ~100 dashboard
 * pages don't have to be rewritten. New optional props extend the API:
 *   - `size`: "bento-1x1" | "bento-2x1" | "bento-2x2"
 *   - `accentColor`: per-card override of the default lime
 *   - `sparkline`: array of numbers — drawn under the value
 */

export type StatCardSize = "bento-1x1" | "bento-2x1" | "bento-2x2";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  premium?: boolean;
  /** Bento layout sizing — controls grid span + value scale. */
  size?: StatCardSize;
  /** Optional per-card accent override. Defaults to brand lime. */
  accentColor?: string;
  /** Optional array of recent values for an inline sparkline. */
  sparkline?: number[];
  /** Stagger index for entrance animation delay. */
  index?: number;
  /**
   * Optional progress value (0–100). When provided, renders a thin horizontal
   * progress bar at the bottom of the card showing completion toward a goal.
   */
  progress?: number;
}

function useAnimatedNumber(target: number, duration = 1200, enabled = false) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || target === 0) {
      setCurrent(target);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic — matches the 220ms standard from brand tokens.
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return current;
}

const SIZE_GRID: Record<StatCardSize, string> = {
  "bento-1x1": "col-span-1 row-span-1",
  "bento-2x1": "col-span-2 row-span-1",
  "bento-2x2": "col-span-2 row-span-2",
};

const SIZE_VALUE_CLASS: Record<StatCardSize, string> = {
  "bento-1x1": "text-[clamp(1.75rem,1.4rem+0.8vw,2.25rem)] font-semibold leading-[1.0]",
  "bento-2x1": "text-[clamp(2rem,1.6rem+1vw,2.75rem)] font-semibold leading-[1.0]",
  "bento-2x2": "text-[clamp(2.5rem,1.8rem+2vw,3.5rem)] font-semibold leading-[0.96]",
};

const SIZE_PADDING: Record<StatCardSize, string> = {
  "bento-1x1": "p-5",
  "bento-2x1": "p-6",
  "bento-2x2": "p-7",
};

/**
 * Tiny inline sparkline. SVG path constructed from the data series, scaled
 * to fit inside a flat strip near the bottom of the card.
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 w-full h-6"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

/**
 * Thin animated progress bar shown beneath the sparkline when a `progress`
 * prop is supplied. Animates from 0 → pct on mount via CSS transition.
 */
function ProgressBar({ pct, color, visible }: { pct: number; color: string; visible: boolean }) {
  return (
    <div className="mt-3">
      {/* Track */}
      <div
        className="relative h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: `rgba(212, 255, 0, 0.12)` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: color,
            width: visible ? `${pct}%` : "0%",
            transition: "width 0.8s ease-out",
          }}
        />
      </div>
      {/* Percentage label */}
      <span
        className="mt-1 block text-[10px] font-medium tabular-nums"
        style={{ color: `${color}CC` }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function StatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  premium,
  size = "bento-1x1",
  accentColor,
  sparkline,
  index = 0,
  progress,
}: StatCardProps) {
  // May 16 v4: periwinkle-extended cycle — blue + indigo + periwinkle variants
  const PRISM_CYCLE = ["#D4FF00", "#6C72AC", "#9CA7DE", "#D4FF00", "#6366F1", "#8B5CF6"];
  const accent = accentColor ?? PRISM_CYCLE[index % PRISM_CYCLE.length];
  const changeColor = {
    positive: tokens.status.success,
    negative: tokens.status.error,
    neutral: tokens.text.muted,
  }[changeType];

  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Parse numeric value for the count-up animation. Strings like "$1,200" are
  // recognised so the prefix renders verbatim.
  const numericValue =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  const isNumeric = !isNaN(numericValue) && typeof value === "number";
  const animatedNum = useAnimatedNumber(isNumeric ? numericValue : 0, 1200, visible);
  const displayValue = isNumeric ? animatedNum : value;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
      e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
    },
    []
  );

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`${SIZE_GRID[size]} ${SIZE_PADDING[size]} group relative overflow-hidden flex flex-col gap-1.5 tilt-3d`}
      style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "18px",
        minHeight: size === "bento-1x1" ? "110px" : undefined,
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.08)",
          "inset 0 -1px 0 rgba(0,0,0,0.18)",
          "0 1px 2px rgba(0,0,0,0.35)",
          "0 4px 16px -4px rgba(0,0,0,0.40)",
          "0 12px 40px -8px rgba(0,0,0,0.50)",
        ].join(", "),
      }}
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 12,
        filter: visible ? "blur(0px)" : "blur(4px)",
      }}
      transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      data-premium={premium ? "true" : undefined}
      whileHover={{
        y: -4,
        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {/* Top-edge inset glow — brightens the top rim for frosted depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 45%)",
          borderRadius: "20px",
        }}
        aria-hidden
      />

      {/* Bottom accent bar — prism color per tile */}
      <div
        className="absolute bottom-0 left-4 right-4 h-[2px] opacity-60"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          borderRadius: "0 0 2px 2px",
        }}
        aria-hidden
      />

      {/* Mouse-tracked ambient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accent}10 0%, transparent 65%)`,
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] font-medium uppercase tracking-[1.2px]"
            style={{ color: "var(--text-secondary, #A8A8B2)" }}
          >
            {label}
          </span>
          {icon && (
            <span
              className="transition-all duration-200 ease-out"
              style={{
                color: `${accent}88`,
              }}
            >
              {icon}
            </span>
          )}
        </div>
        <span
          className={`${SIZE_VALUE_CLASS[size]} tracking-[-0.5px] tabular-nums`}
          style={{ color: "var(--text-primary, #F0F0F4)", fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
        >
          {displayValue}
        </span>
        {change && (
          <span className="text-[11px] font-medium mt-1 block" style={{ color: changeColor }}>
            {change}
          </span>
        )}
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={accent} />
        )}
        {progress !== undefined && (
          <ProgressBar pct={Math.min(100, Math.max(0, progress))} color={accent} visible={visible} />
        )}
      </div>
    </motion.div>
  );
}
