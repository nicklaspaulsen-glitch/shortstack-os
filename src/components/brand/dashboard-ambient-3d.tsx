"use client";

/**
 * DashboardAmbient3D — atmospheric floating-shapes background that sits
 * behind every dashboard page. Tuned for permanent presence rather
 * than landing-page hero use:
 *
 *   • Lower DPR (1.5 cap) — runs constantly, not a one-shot wow moment.
 *   • 3 shapes instead of 5 — smaller frame budget.
 *   • Teal materials — match the v4 brand accent.
 *   • Pointer-events-none + fixed positioning — never blocks UI.
 *   • Auto-disabled for prefers-reduced-motion + can be globally
 *     toggled off via `data-ambient="off"` on <html> for perf-critical
 *     surfaces (video editor, etc.).
 *   • Dynamic-imported with ssr=false so three.js doesn't bloat the
 *     dashboard initial JS bundle. The <Suspense> fallback is a static
 *     SVG that renders during the chunk load.
 *
 * Usage: drop once inside src/app/dashboard/layout.tsx as the FIRST
 * child of the layout's relative-positioned wrapper. Subsequent
 * sidebar / main / overlays paint above it via natural z-index.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AmbientCanvas = dynamic(() => import("./dashboard-ambient-3d-canvas"), {
  ssr: false,
  loading: () => null,
});

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

function useAmbientEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const off = document.documentElement.getAttribute("data-ambient") === "off";
    setEnabled(!off);
    // Listen for runtime toggles (e.g. video editor toggling ambient off)
    const observer = new MutationObserver(() => {
      setEnabled(document.documentElement.getAttribute("data-ambient") !== "off");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient"] });
    return () => observer.disconnect();
  }, []);
  return enabled;
}

export default function DashboardAmbient3D() {
  const reduce = usePrefersReducedMotion();
  const enabled = useAmbientEnabled();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Stay out of SSR; respect reduced-motion + ambient-off toggle.
  if (!mounted || reduce || !enabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <AmbientCanvas />
    </div>
  );
}
