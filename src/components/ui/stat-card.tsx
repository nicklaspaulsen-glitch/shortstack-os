"use client";

import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
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
  "bento-1x1": "font-display text-[clamp(1.75rem,1.4rem+0.8vw,2.25rem)] leading-[1.0]",
  "bento-2x1": "font-display text-[clamp(2rem,1.6rem+1vw,2.75rem)] leading-[1.0]",
  "bento-2x2": "font-display text-[clamp(2.5rem,1.8rem+2vw,3.5rem)] leading-[0.96]",
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
}: StatCardProps) {
  const accent = accentColor ?? tokens.brand.lime;
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
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`${SIZE_GRID[size]} ${SIZE_PADDING[size]} group relative overflow-hidden rounded-2xl flex flex-col gap-1.5 transition-all duration-220 ease-out`}
      // Apr 28 v9 fix: surface bg now uses themeTokens (CSS-var-backed)
      // so the card flips white on light theme. Was hardcoded
      // tokens.bg.surface1 (dark hex baked at import time, ignored
      // theme switching).
      style={{
        background: themeTokens.bg.surface1,
        border: `1px solid var(--border-subtle, rgba(13,148,136,0.08))`,
        boxShadow: [
          "0 1px 0 rgba(255,255,255,0.04) inset",
          "0 2px 4px rgba(0,0,0,0.10)",
          "0 12px 28px -12px rgba(0,0,0,0.18)",
          `0 0 24px -8px ${accent}22`,
        ].join(", "),
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 480ms cubic-bezier(0.32,0.72,0,1), transform 480ms cubic-bezier(0.32,0.72,0,1), box-shadow 220ms cubic-bezier(0.32,0.72,0,1)",
      }}
      data-premium={premium ? "true" : undefined}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) rotate(0.4deg)";
        e.currentTarget.style.borderColor = "var(--border-strong, rgba(13,148,136,0.20))";
        e.currentTarget.style.boxShadow = [
          "0 1px 0 rgba(255,255,255,0.06) inset",
          "0 4px 8px rgba(0,0,0,0.12)",
          "0 18px 40px -12px rgba(0,0,0,0.22)",
          `0 0 0 1px ${accent}33`,
          `0 0 32px -8px ${accent}55`,
        ].join(", ");
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) rotate(0deg)";
        e.currentTarget.style.borderColor = "var(--border-subtle, rgba(13,148,136,0.08))";
        e.currentTarget.style.boxShadow = [
          "0 1px 0 rgba(255,255,255,0.04) inset",
          "0 2px 4px rgba(0,0,0,0.10)",
          "0 12px 28px -12px rgba(0,0,0,0.18)",
          `0 0 24px -8px ${accent}22`,
        ].join(", ");
      }}
    >
      {/* Mouse-tracked ambient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accent}10 0%, transparent 60%)`,
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: themeTokens.text.muted }}
          >
            {label}
          </span>
          {icon && (
            <span
              className="transition-all duration-220 ease-out"
              style={{
                color: `${accent}66`,
              }}
            >
              {icon}
            </span>
          )}
        </div>
        <span
          className={`${SIZE_VALUE_CLASS[size]} tracking-[-0.025em] tabular-nums`}
          style={{ color: themeTokens.text.primary }}
        >
          {typeof value === "string" && value.startsWith("$")
            ? `$${animatedNum.toLocaleString()}`
            : displayValue}
        </span>
        {change && (
          <span className="text-[11px] font-medium mt-1 block" style={{ color: changeColor }}>
            {change}
          </span>
        )}
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={accent} />
        )}
      </div>
    </div>
  );
}
