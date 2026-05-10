"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { tokens, themeTokens } from "@/lib/brand/tokens";
import Stack3D from "@/components/brand/stack-3d";

/**
 * BentoTile — shared shell for every tile on the dashboard home.
 *
 * Provides the OLED surface, lime-tint border, hover-lift, header row,
 * and consistent stagger entrance. Each tile component composes this
 * shell and supplies its own content via `children`.
 */
interface BentoTileProps {
  /** Section heading rendered top-left in the tile. */
  title: string;
  /** Optional small icon rendered to the left of the title. */
  icon?: ReactNode;
  /** Optional href + label for the "View →" link in the top-right. */
  link?: { href: string; label: string };
  /** Tailwind class controlling the bento span (e.g. `lg:col-span-4 lg:row-span-2`). */
  span: string;
  /** Stagger index (0..N) — the BentoGrid uses this to delay the entrance. */
  index?: number;
  /** Override the surface accent colour (defaults to brand lime). */
  accent?: string;
  /** When true, render a danger-tinted border. Used for the Danger Zone settings card. */
  danger?: boolean;
  children: ReactNode;
}

export function BentoTile({
  title,
  icon,
  link,
  span,
  index = 0,
  accent,
  danger = false,
  children,
}: BentoTileProps) {
  const reduceMotion = useReducedMotion();
  const accentColor = accent ?? tokens.brand.lime;
  const borderColor = danger ? "rgba(242, 96, 99, 0.25)" : tokens.border.subtle;

  return (
    <motion.section
      className={`${span} relative overflow-hidden flex flex-col`}
      style={{
        background: themeTokens.bg.surface1,
        border: `1px solid ${borderColor}`,
        boxShadow: [
          "0 1px 0 rgba(255,255,255,0.8) inset",
          "0 2px 4px rgba(0,0,0,0.06)",
          "0 12px 28px -12px rgba(0,0,0,0.10)",
          `0 0 24px -8px ${accentColor}22`,
        ].join(", "),
        transition: "border-color 220ms cubic-bezier(0.32,0.72,0,1), box-shadow 220ms cubic-bezier(0.32,0.72,0,1), transform 220ms cubic-bezier(0.32,0.72,0,1)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.42),
        duration: reduceMotion ? 0.1 : 0.48,
        ease: [0.32, 0.72, 0, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -2,
              boxShadow: [
                "0 1px 0 rgba(255,255,255,0.9) inset",
                "0 4px 8px rgba(0,0,0,0.08)",
                "0 18px 40px -12px rgba(0,0,0,0.14)",
                `0 0 0 1px ${accentColor}33`,
                `0 0 32px -8px ${accentColor}44`,
              ].join(", "),
            }
      }
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span style={{ color: accentColor }} className="shrink-0">
              {icon}
            </span>
          )}
          <h2
            className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] truncate"
            style={{ color: themeTokens.text.primary }}
          >
            {title}
          </h2>
        </div>
        {link && (
          <Link
            href={link.href}
            className="flex items-center gap-0.5 text-[11px] font-medium shrink-0 transition-colors"
            style={{ color: accentColor }}
          >
            {link.label}
            <ChevronRight size={12} />
          </Link>
        )}
      </header>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </motion.section>
  );
}

/**
 * Compact, on-brand empty state used inside any bento tile when the
 * underlying query returns 0 rows.
 */
interface BentoEmptyProps {
  copy: string;
  cta?: { label: string; href: string };
  /** Override the small Stack3D mark (defaults to "sm"). */
  mark?: boolean;
}

export function BentoEmpty({ copy, cta, mark = true }: BentoEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
      {mark && (
        <div className="opacity-70">
          <Stack3D size="sm" rotating={false} />
        </div>
      )}
      <p
        className="font-editorial text-[13px] leading-snug max-w-[26ch]"
        style={{ color: themeTokens.text.secondary }}
      >
        {copy}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors"
          style={{
            color: themeTokens.bg.base,
            background: tokens.brand.lime,
            boxShadow: `0 0 16px -4px ${tokens.brand.lime}66`,
          }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
