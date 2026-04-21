"use client";

import { ReactNode } from "react";
import { BRAND } from "@/lib/brand-config";

export type HeroGradient = "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";

/** Product brand primary color — central source of truth, used as the
 *  baseline for the "gold" hero gradient. Swapping BRAND.primary_color
 *  in brand-config flips all default gold heroes. */
const BRAND_PRIMARY = BRAND.primary_color;

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  gradient?: HeroGradient;
  actions?: ReactNode;
  pattern?: boolean;
  /** Optional small badge/pill shown above the title */
  eyebrow?: ReactNode;
  className?: string;
}

// Hex helper so the gold preset can pull BRAND.primary_color as its accent
// without hardcoding the color in two places. For non-gold presets (which
// are purely decorative/section colors) hex literals stay inline.
const HERO_GOLD_ACCENT = BRAND_PRIMARY; // "#C9A84C" by default

const GRADIENT_PRESETS: Record<HeroGradient, { bg: string; glowA: string; glowB: string; accent: string; iconBg: string; iconBorder: string }> = {
  gold: {
    bg: "linear-gradient(135deg, #1a1611 0%, #2d2418 45%, #3d3020 100%)",
    glowA: "rgba(201, 168, 76, 0.35)",
    glowB: "rgba(201, 168, 76, 0.12)",
    // Light gold highlight is derived; core accent comes from brand config.
    accent: "#E4C876",
    iconBg: `${HERO_GOLD_ACCENT}2E`, // ~0.18 alpha as hex suffix
    iconBorder: `${HERO_GOLD_ACCENT}59`, // ~0.35 alpha as hex suffix
  },
  blue: {
    bg: "linear-gradient(135deg, #0a1428 0%, #112447 45%, #1a3e7a 100%)",
    glowA: "rgba(59, 130, 246, 0.38)",
    glowB: "rgba(59, 130, 246, 0.12)",
    accent: "#93C5FD",
    iconBg: "rgba(59, 130, 246, 0.2)",
    iconBorder: "rgba(147, 197, 253, 0.35)",
  },
  purple: {
    bg: "linear-gradient(135deg, #1a1033 0%, #2c1a55 45%, #4a2285 100%)",
    glowA: "rgba(168, 85, 247, 0.4)",
    glowB: "rgba(236, 72, 153, 0.12)",
    accent: "#D8B4FE",
    iconBg: "rgba(168, 85, 247, 0.2)",
    iconBorder: "rgba(216, 180, 254, 0.35)",
  },
  green: {
    bg: "linear-gradient(135deg, #07231a 0%, #0c3d2c 45%, #14633e 100%)",
    glowA: "rgba(16, 185, 129, 0.38)",
    glowB: "rgba(110, 231, 183, 0.1)",
    accent: "#6EE7B7",
    iconBg: "rgba(16, 185, 129, 0.2)",
    iconBorder: "rgba(110, 231, 183, 0.35)",
  },
  sunset: {
    bg: "linear-gradient(135deg, #2a0f13 0%, #4f1e1d 35%, #8a3520 70%, #b45a23 100%)",
    glowA: "rgba(249, 115, 22, 0.4)",
    glowB: "rgba(251, 146, 60, 0.12)",
    accent: "#FDBA74",
    iconBg: "rgba(249, 115, 22, 0.2)",
    iconBorder: "rgba(253, 186, 116, 0.35)",
  },
  ocean: {
    bg: "linear-gradient(135deg, #041926 0%, #0b3547 40%, #14596c 75%, #1f7a87 100%)",
    glowA: "rgba(20, 184, 166, 0.4)",
    glowB: "rgba(56, 189, 248, 0.12)",
    accent: "#5EEAD4",
    iconBg: "rgba(20, 184, 166, 0.2)",
    iconBorder: "rgba(94, 234, 212, 0.35)",
  },
};

export default function PageHero({
  title,
  subtitle,
  icon,
  gradient = "gold",
  actions,
  pattern = true,
  eyebrow,
  className = "",
}: PageHeroProps) {
  const g = GRADIENT_PRESETS[gradient];
  const patternId = `hero-dots-${gradient}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/5 ${className}`}
      style={{
        background: g.bg,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.05) inset," +
          "0 2px 8px rgba(0,0,0,0.25)," +
          "0 10px 28px -8px rgba(0,0,0,0.5)",
      }}
    >
      {/* Radial glow accents */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${g.glowA} 0%, transparent 65%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 w-[260px] h-[260px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${g.glowB} 0%, transparent 65%)` }}
      />

      {/* Inset vignette */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,0.45)" }}
      />

      {/* Dot pattern overlay */}
      {pattern && (
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full"
          style={{ opacity: 0.12 }}
          aria-hidden
        >
          <defs>
            <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      )}

      {/* Content */}
      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          {icon && (
            <div
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: g.iconBg,
                border: `1px solid ${g.iconBorder}`,
                color: g.accent,
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.08) inset",
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: g.accent, opacity: 0.85 }}>
                {eyebrow}
              </div>
            )}
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "rgba(255,255,255,0.7)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          // `relative z-20` keeps the actions above the radial glow layer so
          // translucent pills (like AdvancedToggle) don't appear clipped by
          // the orange/amber glow bleed at the hero's top-right corner.
          <div className="relative z-20 flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
