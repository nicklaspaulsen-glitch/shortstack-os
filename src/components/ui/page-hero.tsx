"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  /** Drop the floating decorative sparkle particles. They're on by default
   *  for the gold/sunset/ocean/purple gradients (premium-feel surfaces) and
   *  disabled for green/blue (tools surfaces). Pass `false` to suppress on
   *  any page where the sparkles compete with content. */
  sparkles?: boolean;
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

/** Gradients where decorative floating sparkles look good. The "tools"
 *  gradients (green/blue) are deliberately quieter — sparkles there
 *  compete with status chips and CTAs. */
const SPARKLE_DEFAULT: Record<HeroGradient, boolean> = {
  gold: true,
  sunset: true,
  ocean: true,
  purple: true,
  green: false,
  blue: false,
};

// Pre-computed sparkle positions so SSR + first client render match (no
// hydration mismatch from Math.random). Using deterministic placements
// also lets us tune the look once instead of leaving "fairness" to the
// RNG. Each entry is %x, %y, size px, animation-delay seconds.
const SPARKLES: Array<{ x: number; y: number; size: number; delay: number; duration: number }> = [
  { x: 8, y: 18, size: 4, delay: 0, duration: 7 },
  { x: 22, y: 72, size: 3, delay: 1.2, duration: 9 },
  { x: 35, y: 30, size: 5, delay: 2.4, duration: 6 },
  { x: 48, y: 80, size: 3, delay: 0.8, duration: 8 },
  { x: 60, y: 22, size: 4, delay: 3.6, duration: 7 },
  { x: 72, y: 65, size: 3, delay: 1.6, duration: 9 },
  { x: 85, y: 35, size: 4, delay: 2.8, duration: 6 },
  { x: 92, y: 78, size: 3, delay: 0.4, duration: 8 },
];

export default function PageHero({
  title,
  subtitle,
  icon,
  gradient = "gold",
  actions,
  pattern = true,
  eyebrow,
  sparkles,
  className = "",
}: PageHeroProps) {
  const g = GRADIENT_PRESETS[gradient];
  const patternId = `hero-dots-${gradient}`;
  const reduceMotion = useReducedMotion();
  // Caller can override default per-gradient sparkle behavior with `sparkles`.
  const showSparkles = sparkles ?? SPARKLE_DEFAULT[gradient];

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
      {/* Radial glow accents — slow-orbit motion so the hero feels alive
       *  but never distracting. Honours prefers-reduced-motion: when set,
       *  the glows render statically (no animate prop kicks in). The orbit
       *  is very low-amplitude (~24 px) at a 14–18 s period — readable as
       *  ambient breathing, not as movement competing with content. */}
      <motion.div
        className="pointer-events-none absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${g.glowA} 0%, transparent 65%)` }}
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -18, 8, -10, 0], y: [0, 12, -6, 14, 0] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-20 -left-20 w-[260px] h-[260px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${g.glowB} 0%, transparent 65%)` }}
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 16, -8, 10, 0], y: [0, -10, 6, -14, 0] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
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

      {/* Decorative floating sparkles — disabled when prefers-reduced-motion
       *  is set. Static positions (deterministic) so SSR matches first paint
       *  with no hydration warning. Each sparkle pulses opacity + drifts a
       *  tiny vertical amount on its own delay so the field feels organic. */}
      {showSparkles && !reduceMotion && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {SPARKLES.map((s, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                background: g.accent,
                boxShadow: `0 0 ${s.size * 2}px ${g.accent}`,
              }}
              animate={{
                opacity: [0.25, 0.7, 0.25],
                y: [0, -6, 0],
              }}
              transition={{
                duration: s.duration,
                delay: s.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Content
       *
       * Layout notes — why this row is structured exactly this way:
       * 1. Outer wrapper uses `md:items-start` (not items-center) so a long
       *    title on the left never vertically pushes the actions out of the
       *    top-right corner. Actions sit at the top-right where users expect
       *    the AdvancedToggle pill to live — even when the title wraps to
       *    two lines or the subtitle is long.
       * 2. The left (title) div gets `flex-1 min-w-0` so it claims its share
       *    of the row and truncates/wraps its own content instead of growing
       *    past the right edge and pushing the actions into the parent's
       *    `overflow-hidden` clip zone. Without `flex-1` the title's intrinsic
       *    width wins and the actions get shoved off-screen or clipped by the
       *    rounded-2xl overflow-hidden on the outer card.
       * 3. The right (actions) div uses `shrink-0` + `flex-wrap` + `ml-auto`
       *    so it never shrinks below its content but can wrap its own children
       *    to a second row instead of overflowing horizontally.
       * 4. The whole content block fades in + slides up on mount via
       *    framer-motion. Subtle (12 px slide, 0.4 s) — the page feels
       *    composed-into-place rather than slammed in. Still respects
       *    prefers-reduced-motion. */}
      <motion.div
        className="relative z-10 px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-start justify-between gap-5"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-start gap-4 min-w-0 flex-1">
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
          //
          // `shrink-0` + `flex-wrap` ensures actions never get compressed by
          // the title on the left; when they overflow they wrap to a second
          // row inside the hero, visible, instead of being clipped by the
          // outer card's `overflow-hidden rounded-2xl`.
          //
          // `md:ml-auto` pushes the actions to the right on row layout,
          // redundant with `justify-between` on the parent but kept explicit
          // so consumers who nest another flex wrapper (e.g. a raw
          // `<div className="flex items-center gap-2">` around actions) still
          // get the correct right-alignment behavior.
          <div className="relative z-20 flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full md:ml-auto">
            {actions}
          </div>
        )}
      </motion.div>
    </div>
  );
}
