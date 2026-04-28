"use client";

/**
 * Stack3D — the signature brand mark for ShortStack OS.
 *
 * Three offset rectangular blocks at slight rotation, indigo-edged on a
 * dark base. Slowly rotates around the Y axis. Used on:
 *   - Login screen (massive)
 *   - Empty states (small)
 *   - Sidebar header (small)
 *   - Hero surfaces optionally (via PageHero `showStack3D` prop)
 *   - 404 / loading states
 *
 * Implementation strategy (Apr 28 — perf rewrite):
 *
 * The R3F + three.js implementation lives in a separate file
 * (`stack-3d-canvas.tsx`) and is dynamic-imported with `{ ssr: false }`
 * via next/dynamic. That stops three.js (~120 KB gzipped) from being
 * bundled into every page that imports Stack3D — most importantly the
 * sidebar, which means it would otherwise ship on every dashboard
 * route.  CSS fallback renders during SSR + first paint, then the
 * canvas mounts in the background and crossfades in.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { tokens } from "@/lib/brand/tokens";

const Stack3DCanvas = dynamic(() => import("./stack-3d-canvas"), {
  ssr: false,
  // Render the CSS fallback while the canvas chunk loads.
  loading: () => null,
});

export type Stack3DSize = "sm" | "md" | "lg";

interface Stack3DProps {
  /** Visual size — sm=64px, md=128px, lg=256px. */
  size?: Stack3DSize;
  /** Whether the mark slowly rotates around Y. Defaults to true. */
  rotating?: boolean;
  /** Additional className applied to the wrapping element. */
  className?: string;
}

const SIZE_PX: Record<Stack3DSize, number> = {
  sm: 64,
  md: 128,
  lg: 256,
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

/**
 * Pure CSS fallback — three layered divs with indigo borders. Used during
 * SSR, when reduced motion is requested, and as the loading state while
 * the R3F canvas chunk lazy-loads.
 */
function StackCssFallback({ size, rotating }: { size: number; rotating: boolean }) {
  const slabHeight = Math.round(size * 0.18);
  const slabWidth = Math.round(size * 0.86);
  const offset = Math.round(size * 0.16);
  return (
    <div
      className={rotating ? "animate-stack-rotate" : ""}
      style={{
        width: size,
        height: size,
        position: "relative",
        perspective: `${size * 4}px`,
        transformStyle: "preserve-3d",
      }}
      aria-hidden
    >
      {[2, 1, 0].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: slabWidth,
            height: slabHeight,
            transform: `translate(-50%, -50%) translateY(${(i - 1) * offset}px) rotateX(20deg) rotateY(-25deg)`,
            background: tokens.bg.surface1,
            border: `1.5px solid ${tokens.brand.accent}`,
            borderRadius: 4,
            boxShadow: `0 0 ${size * 0.12}px ${tokens.brand.accentGlow}, 0 ${size * 0.04}px ${size * 0.12}px rgba(0,0,0,0.4)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Stack3D({ size = "md", rotating = true, className = "" }: Stack3DProps) {
  const px = SIZE_PX[size];
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  // Defer the canvas mount until after hydration so SSR returns the CSS
  // fallback. Prevents the dynamic-imported chunk from running on the server.
  useEffect(() => setMounted(true), []);

  const useCanvas = mounted && !reduceMotion;
  const shouldRotate = rotating && !reduceMotion;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {useCanvas ? (
        <Stack3DCanvas size={px} rotating={shouldRotate} />
      ) : (
        <StackCssFallback size={px} rotating={shouldRotate} />
      )}
    </div>
  );
}
