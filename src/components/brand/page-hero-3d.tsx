"use client";

/**
 * PageHero3D — themed 3D scene that drops into the right side of any
 * dashboard page hero. Each `theme` renders a different cluster of
 * shapes so the visual mark matches what the page is for:
 *
 *   sales        — dollar coin (torus) + arrow cone + spinning ring
 *   create       — pen (cone) + idea bubble (sphere) + spark (octahedron)
 *   visual       — photo cube (box) + lens sphere + plane card
 *   automate     — gear (torus) + chip (box) + zap (octahedron)
 *   manage       — building stack (3 boxes) + chart ring (torus)
 *   connect      — node + link torus + satellite cube
 *   ai           — brain orb (icosahedron) + circuit ring + spark
 *   voice        — microphone (cylinder + sphere) + sound wave torus
 *   analytics    — bar stacks (3 boxes) + ring + sphere
 *   leads        — funnel (cone) + magnet (torus) + drops (spheres)
 *   inbox        — envelope (box flat) + dots (spheres)
 *   default      — generic Trinity icosahedron + 2 orbital shards
 *
 * Props are minimal so it's drop-in:
 *   <PageHero3D theme="sales" />
 *   <PageHero3D theme="create" size="lg" />
 *
 * Performance:
 *   - 2-4 shapes per scene (low GPU cost).
 *   - DPR cap [1, 2] — sharp on retina, never melts integrated GPUs.
 *   - Float wrapper handles motion (no per-frame React state).
 *   - HDR environment via drei `Environment preset="city"` (free
 *     reflections without shipping an .hdr file).
 *   - Auto-disabled on prefers-reduced-motion (component returns
 *     a static SVG fallback, same silhouette).
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PageHero3DCanvas = dynamic(() => import("./page-hero-3d-canvas"), {
  ssr: false,
  loading: () => null,
});

export type PageHero3DTheme =
  // section-hub themes
  | "sales"
  | "create"
  | "visual"
  | "automate"
  | "manage"
  | "connect"
  // domain themes
  | "ai"
  | "voice"
  | "analytics"
  | "leads"
  | "inbox"
  // sidebar-icon-matched themes (Apr 28 v7)
  | "phone"
  | "mic"
  | "calendar"
  | "mail"
  | "search"
  | "settings"
  | "bell"
  | "crown"
  | "bot"
  | "globe"
  | "heart"
  | "star"
  | "key"
  | "shield"
  | "target"
  | "briefcase"
  | "headphones"
  // fallback
  | "default";

export type PageHero3DSize = "sm" | "md" | "lg";

interface PageHero3DProps {
  theme?: PageHero3DTheme;
  size?: PageHero3DSize;
  className?: string;
}

const SIZE_PX: Record<PageHero3DSize, number> = {
  sm: 96,
  md: 140,
  lg: 200,
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

/** Static SVG fallback shown while canvas chunk loads + on reduced-motion.
 *  Rendered as the same silhouette per theme to prevent layout flash. */
function StaticFallback({ theme, size }: { theme: PageHero3DTheme; size: number }) {
  // A small monochromatic teal silhouette per theme. Cheap to render,
  // matches the canvas approximate composition, no layout shift when
  // the canvas mounts.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ opacity: 0.7 }}
    >
      <defs>
        <radialGradient id={`g-${theme}`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="rgb(94, 234, 212)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="rgb(13, 148, 136)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="42" r="28" fill={`url(#g-${theme})`} />
      <circle cx="72" cy="60" r="10" fill={`url(#g-${theme})`} />
      <circle cx="30" cy="68" r="8" fill={`url(#g-${theme})`} />
    </svg>
  );
}

export default function PageHero3D({
  theme = "default",
  size = "md",
  className = "",
}: PageHero3DProps) {
  const reduce = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const px = SIZE_PX[size];

  return (
    <div
      className={`pointer-events-none inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      {!mounted || reduce ? (
        <StaticFallback theme={theme} size={px} />
      ) : (
        <PageHero3DCanvas theme={theme} size={px} />
      )}
    </div>
  );
}
