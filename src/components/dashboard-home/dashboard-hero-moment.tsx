"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { tokens } from "@/lib/brand/tokens";
import Stack3D from "@/components/brand/stack-3d";
import type { HeroBlock } from "./types";

/**
 * DashboardHeroMoment — the editorial 8x2 tile at the top of the bento grid.
 *
 * Picks the most narratively interesting derived stat (computed server-side
 * in /api/dashboard-bento) and renders it as a magazine-style spread:
 *
 *   - Big Satoshi headline (clamp 2rem..3.5rem)
 *   - Bodoni-Moda subhead in lime
 *   - Progress bar against the implied goal
 *   - Floating Stack3D mark in the right gutter
 *   - Subtle lime-to-plum gradient backdrop with grain overlay
 *   - Lime CTA pill anchored to the bottom-left
 */
interface Props {
  hero: HeroBlock;
  index?: number;
}

export default function DashboardHeroMoment({ hero, index = 0 }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="lg:col-span-8 lg:row-span-2 relative overflow-hidden rounded-2xl flex"
      style={{
        background: `linear-gradient(135deg, ${tokens.bg.surface1} 0%, ${tokens.bg.surface2} 50%, ${tokens.brand.plum} 145%)`,
        border: `1px solid ${tokens.border.subtle}`,
        boxShadow: [
          "0 1px 0 rgba(255,255,255,0.04) inset",
          "0 4px 12px rgba(0,0,0,0.4)",
          "0 24px 56px -16px rgba(0,0,0,0.6)",
          `0 0 48px -12px ${tokens.brand.lime}22`,
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
      {/* Lime accent rail */}
      <div
        className="pointer-events-none absolute left-0 top-[12%] bottom-[12%] w-1 rounded-r-sm"
        style={{
          background: tokens.brand.lime,
          boxShadow: `0 0 18px ${tokens.brand.lime}`,
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

      {/* Lime corona — top-right radial glow */}
      <div
        className="pointer-events-none absolute -top-1/3 -right-1/4 w-[56%] h-[140%] rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${tokens.brand.lime}1a 0%, transparent 70%)`,
        }}
        aria-hidden
      />

      <div className="relative flex-1 flex flex-col justify-between px-7 py-7 sm:px-10 sm:py-9 z-10">
        <div>
          <p
            className="font-editorial text-sm mb-3 italic"
            style={{ color: tokens.brand.lime, opacity: 0.95 }}
          >
            Moment of the day
          </p>
          <h2
            className="font-display tracking-[-0.025em] leading-[1.02] text-[clamp(2rem,1.4rem+2.4vw,3.75rem)]"
            style={{
              color: tokens.text.primary,
              textShadow: "0 1px 2px rgba(0,0,0,0.45)",
            }}
          >
            {hero.headline}
          </h2>
          <p
            className="text-sm mt-3 max-w-2xl leading-relaxed"
            style={{ color: tokens.text.secondary }}
          >
            {hero.subhead}
          </p>

          {/* Progress bar — only when the hero has meaningful progress */}
          {hero.progressPct > 0 && (
            <div className="mt-6 max-w-md">
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: tokens.bg.surface3 }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${tokens.brand.lime} 0%, ${tokens.brand.limeSoft} 100%)`,
                    boxShadow: `0 0 10px ${tokens.brand.lime}66`,
                  }}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.min(100, hero.progressPct)}%` }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.3,
                    duration: reduceMotion ? 0.1 : 0.9,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                />
              </div>
              <p
                className="mt-2 text-[11px] font-mono"
                style={{ color: tokens.text.muted }}
              >
                {hero.progressPct}% of today&apos;s target
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href={hero.cta.href}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-220"
            style={{
              background: tokens.brand.lime,
              color: tokens.bg.base,
              boxShadow: `0 4px 18px -4px ${tokens.brand.lime}88, 0 1px 0 rgba(255,255,255,0.4) inset`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = `0 6px 22px -4px ${tokens.brand.lime}aa, 0 1px 0 rgba(255,255,255,0.5) inset`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 4px 18px -4px ${tokens.brand.lime}88, 0 1px 0 rgba(255,255,255,0.4) inset`;
            }}
          >
            {hero.cta.label}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Floating Stack3D mark — hidden on small screens to keep the headline readable */}
      <div className="hidden lg:flex relative z-10 items-center justify-center pr-8 shrink-0">
        <Stack3D size="md" rotating />
      </div>
    </motion.section>
  );
}
