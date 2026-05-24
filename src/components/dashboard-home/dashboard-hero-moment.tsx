import { ArrowRight } from "@phosphor-icons/react";
﻿"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { tokens } from "@/lib/brand/tokens";
import BrainMark from "@/components/brand/brain-mark";
import type { HeroBlock } from "./types";

/**
 * DashboardHeroMoment — the editorial 8×2 tile at the top of the bento grid.
 *
 * Renders the day's most narratively interesting derived stat as a
 * magazine-style spread:
 *
 *   - Big Satoshi headline (clamp 2rem..3.75rem)
 *   - Bodoni-Moda eyebrow in blue
 *   - Full-width SVG area chart (performance trend) replacing the thin bar
 *   - Floating BrainMark in the right gutter
 *   - Blue-tinted glass surface with grain overlay
 *   - Blue CTA pill anchored to the bottom-left
 */
interface Props {
  hero: HeroBlock;
  index?: number;
}

/**
 * AreaChart — deterministic 14-point SVG sparkline derived from the progress
 * percentage. Uses fixed sine-offset noise so it looks natural but renders
 * identically on server and client (no Math.random()).
 */
function AreaChart({ pct }: { pct: number }) {
  const W = 400;
  const H = 72;
  // Fixed noise offsets — deterministic, no hydration mismatch
  const NOISE = [0, 4, -3, 6, 2, -4, 5, 1, -2, 4, 2, -1, 5, 2];
  const points = NOISE.map((n, i) => {
    const trend = (pct * 0.85) * (i / (NOISE.length - 1));
    return Math.max(2, Math.min(96, trend + n));
  });
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - ((v - min) / range) * (H * 0.82) - H * 0.08,
  }));
  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="relative w-full" aria-hidden>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: H, display: "block" }}
      >
        <defs>
          <linearGradient id="heroAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4FF00" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#D4FF00" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Filled area */}
        <path d={areaPath} fill="url(#heroAreaFill)" />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#D4FF00"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.65"
        />
        {/* Terminal dot + pulse ring */}
        <circle cx={last.x} cy={last.y} r="5" fill="rgba(212,255,0,0.15)" />
        <circle cx={last.x} cy={last.y} r="3" fill="#D4FF00" opacity="0.9" />
      </svg>
      {/* Percent label pinned to the terminal dot */}
      <span
        className="absolute right-0 text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md"
        style={{
          top: 0,
          background: "rgba(212,255,0,0.08)",
          color: "#D4FF00",
          border: "1px solid rgba(212,255,0,0.18)",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function DashboardHeroMoment({ hero, index = 0 }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="lg:col-span-8 lg:row-span-2 relative overflow-hidden flex border border-border-subtle"
      // Glassmorphism hero: frosted white over the page's blue ambient glow.
      // Matches BentoTile glass treatment for cohesive grid aesthetic.
      // The corona + grain overlays below add brand depth without a hard gradient.
      style={{
        background: "rgba(255, 255, 255, 0.90)",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,1)",
          "0 4px 12px rgba(0,0,0,0.06)",
          "0 24px 56px -16px rgba(0,0,0,0.12)",
          "0 0 48px -12px rgba(212,255,0,0.14)",
        ].join(", "),
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduceMotion ? 0 : index * 0.06,
        duration: reduceMotion ? 0.1 : 0.48,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      {/* Top-edge blue accent line */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, ${tokens.brand.accent}00 0%, ${tokens.brand.accent}88 30%, ${tokens.brand.accentSoft}55 70%, ${tokens.brand.accent}00 100%)`,
        }}
        aria-hidden
      />

      {/* Grain overlay — local, atmospheric */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "160px 160px",
        }}
        aria-hidden
      />

      {/* Blue corona — top-right radial glow */}
      <div
        className="pointer-events-none absolute -top-1/3 -right-1/4 w-[56%] h-[140%] rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${tokens.brand.accentGlow} 0%, transparent 70%)`,
        }}
        aria-hidden
      />

      <div className="relative flex-1 flex flex-col justify-between px-7 py-7 sm:px-10 sm:py-9 z-10">
        {/* Top section: headline + subhead */}
        <div>
          <p className="font-editorial text-sm mb-3 italic text-brand-accent opacity-95">
            Moment of the day
          </p>

          {/* ── SAPENCE z-split: headline physically threaded through BrainMark ──
           *
           * Design reference: SAPENCE portfolio site — a 3D element clips through
           * the large display headline using CSS z-layer stacking + mask-image.
           *
           * Three-layer sandwich (lg screens only):
           *   z-10 (back):  Full headline — visible BEHIND the BrainMark.
           *   z-20 (mid):   BrainMark absolutely positioned over the right portion
           *                 of the text area — floats between the two text layers.
           *   z-30 (front): Same headline text, but masked to reveal ONLY the
           *                 rightward slice — appears IN FRONT of the BrainMark.
           *
           * The mask gradient threshold (60→78%) is calibrated so the transition
           * point falls roughly where the BrainMark right-edge sits. Adjust if
           * the headline length changes dramatically.
           *
           * Mobile: no z-split — just the plain headline (BrainMark hidden). */}
          <div className="relative" style={{ isolation: "isolate" }}>
            {/* Back layer — z-10, full headline, readable behind BrainMark */}
            <h2
              className="font-display tracking-[-0.025em] leading-[1.02] text-[clamp(2rem,1.4rem+2.4vw,3.75rem)] text-text-primary [text-shadow:0_1px_2px_rgba(0,0,0,0.08)] relative"
              style={{ zIndex: 10 }}
            >
              {hero.headline}
            </h2>

            {/* BrainMark — z-20, sits between the two text layers.
                Positioned at the right side of the headline area so the
                trailing words of the headline appear in front of the mark. */}
            <div
              className="absolute hidden lg:flex items-center justify-center z-20"
              style={{
                top: "50%",
                right: "-2.5rem",
                transform: "translateY(-50%)",
              }}
              aria-hidden="true"
            >
              <BrainMark size="lg" glowing />
            </div>

            {/* Front layer — z-30, same text masked to RIGHT slice only.
                This copy is aria-hidden because the back layer carries semantics.
                The mask gradient reveals only the portion that should appear
                in front of the BrainMark, creating the "slice through" illusion. */}
            <h2
              aria-hidden="true"
              className="font-display tracking-[-0.025em] leading-[1.02] text-[clamp(2rem,1.4rem+2.4vw,3.75rem)] text-text-primary [text-shadow:0_1px_2px_rgba(0,0,0,0.08)] hidden lg:block absolute inset-0"
              style={{
                zIndex: 30,
                maskImage: "linear-gradient(to right, transparent 58%, rgba(0,0,0,0.6) 70%, black 80%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 58%, rgba(0,0,0,0.6) 70%, black 80%)",
                /* Fractionally brighter — being "in front" = closer to the viewer */
                filter: "brightness(1.06)",
              }}
            >
              {hero.headline}
            </h2>
          </div>

          <p className="text-sm mt-3 max-w-2xl leading-relaxed text-text-secondary">
            {hero.subhead}
          </p>
        </div>

        {/* Bottom section: area chart + CTA */}
        <div className="mt-auto pt-5">
          {/* Performance trend chart — replaces the old thin progress bar */}
          {hero.progressPct > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-mono text-text-muted mb-2 uppercase tracking-[0.8px]">
                Performance trend · today&apos;s target
              </p>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.35, duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
              >
                <AreaChart pct={Math.min(100, hero.progressPct)} />
              </motion.div>
            </div>
          )}

          <Link
            href={hero.cta.href}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-220 bg-brand-accent text-white hover:-translate-y-px"
            style={{
              boxShadow: `0 4px 18px -4px rgba(212,255,0,0.50), 0 1px 0 rgba(255,255,255,0.25) inset`,
            }}
          >
            {hero.cta.label}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* BrainMark is now embedded in the SAPENCE z-split headline above —
          see the three-layer sandwich comment in the headline section.
          The old side-by-side version has been replaced with the z-threading
          technique (BrainMark floats between two layers of the headline text). */}
    </motion.section>
  );
}

