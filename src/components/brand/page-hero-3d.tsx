"use client";

/**
 * PageHero3D — Apr 28 v8 redesign.
 *
 * User feedback: "cant you make custom icons that are actually
 * something that arent triangles or circles? Like actauyl for example
 * 3d money png or card 3d somethiong that actaully matches the page
 * not some rectangel".
 *
 * Got it. The previous v7 R3F primitive scenes (cones, spheres, boxes)
 * looked generic — combinations of basic geometry can't compete with
 * a properly-rendered 3D illustration.
 *
 * v8 swap: Microsoft Fluent UI 3D Emoji set (MIT licensed,
 * professionally rendered with full PBR materials and lighting).
 * Stored as static PNGs in /public/icons/3d/<theme>.png — downloaded
 * once via scripts/download-3d-icons.mjs.
 *
 * Animation: CSS perspective + rotateY for "alive" feel + drop-shadow
 * for grounding. No three.js, no GPU canvas — just an <Image> in a
 * spinning wrapper. Drops the R3F dependency from the page hero
 * entirely (the canvas mount was a measurable initial-paint cost).
 *
 * Themes: 30+ icons matching every major sidebar surface. Each one
 * is a real 3D-rendered illustration — money bag for sales, credit
 * card for billing, telephone for AI Caller, microphone for Voice
 * Studio, robot for AI agents, etc.
 */

import Image from "next/image";
import { useEffect, useState } from "react";

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
  // sidebar-icon-matched themes
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
  // bonus themes (for one-off pages)
  | "rocket"
  | "gem"
  | "fire"
  | "trophy"
  | "card"
  | "chart"
  | "brain"
  | "pen"
  | "camera"
  | "film"
  | "building"
  | "receipt"
  | "invoice"
  | "zap"
  | "cog"
  | "pin"
  | "lock"
  | "download"
  // fallback
  | "default";

export type PageHero3DSize = "sm" | "md" | "lg";

interface PageHero3DProps {
  theme?: PageHero3DTheme;
  size?: PageHero3DSize;
  className?: string;
  /** Animate (default true). Pass false on static / print pages. */
  animate?: boolean;
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

export default function PageHero3D({
  theme = "default",
  size = "md",
  className = "",
  animate = true,
}: PageHero3DProps) {
  const px = SIZE_PX[size];
  const reduce = usePrefersReducedMotion();
  const shouldAnimate = animate && !reduce;

  // Apr 28 v10: dropped the constant 12s Y-spin. The Fluent emojis are
  // flat 2D rasters of 3D renders — they don't have a real back face,
  // so spinning them around Y showed mirrored ugly profiles. The spin
  // also made them feel "boxed in" rather than tactile.
  //
  // New behavior:
  //   • Idle: static, slight forward tilt (rotateX ~6°) so they read
  //     as 3D objects sitting on a surface, not flat stickers.
  //   • Hover: subtle lift + 5° tilt — clearly responsive but tiny.
  //   • Theme-aware drop-shadow: teal-tinted in dark mode, neutral in
  //     light mode, so the icon feels cohesive with the rest of the
  //     surface instead of a colorful sticker out of place.
  return (
    <span
      className={`hero-3d-icon inline-flex items-center justify-center ${className}`}
      style={{
        width: px,
        height: px,
      }}
      aria-hidden="true"
    >
      <Image
        src={`/icons/3d/${theme}.png`}
        alt=""
        width={px}
        height={px}
        unoptimized
        priority={false}
        className={shouldAnimate ? "hero-3d-icon-img" : ""}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </span>
  );
}
