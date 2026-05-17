"use client";

/**
 * DashboardBackground — premium animated mesh gradient background.
 *
 * Five independently drifting blobs in soft blue, indigo, and sky tones.
 * Each blob has its own CSS keyframe animation so no JavaScript runs
 * per frame — it's pure CSS compositor work.
 *
 * Design intent:
 *   • Very low opacity (4-9%) — atmospheric depth, not decoration
 *   • Warm-cool contrast: blue/indigo blobs left, sky/periwinkle right
 *   • 16-24s drift cycles — slower than the eye tracks, creates presence
 *     without distraction
 *   • Blur radius 80-120px — blobs feel like light, not shapes
 *   • Respects prefers-reduced-motion — static fallback (still renders
 *     the gradient, just no animation)
 *
 * Usage: rendered once inside dashboard/layout.tsx, fixed behind all UI.
 * Replaces the flat `#F3F6FA` body background with a living surface.
 */

import { useEffect, useState } from "react";

export default function DashboardBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Always render the static gradient (no flash). Motion layer added
  // client-side after mount to respect prefers-reduced-motion and avoid
  // SSR hydration mismatch on the animation class.
  return (
    <>
      {/* Static gradient base — renders server-side, no flash */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-20 pointer-events-none"
        style={{
          background: [
            // Top-left: deep blue corona
            "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(37,99,235,0.09) 0%, transparent 60%)",
            // Bottom-right: indigo depth bloom
            "radial-gradient(ellipse 60% 50% at 70% 70%, rgba(59,130,246,0.06) 0%, transparent 55%)",
            // Top-right: blue-indigo accent
            "radial-gradient(ellipse 50% 40% at 82% 18%, rgba(99,102,241,0.05) 0%, transparent 50%)",
            // Bottom-left: subtle blue fade
            "radial-gradient(ellipse 40% 40% at 18% 82%, rgba(37,99,235,0.04) 0%, transparent 50%)",
            // Base — deep OLED navy
            "#0D1120",
          ].join(", "),
        }}
      />

      {/* Animated drift layer — mounted client-side */}
      {mounted && (
        <>
          {/* Blob 1 — blue corona, top-left drift */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-1"
            style={{
              width: "55vw",
              height: "55vw",
              maxWidth: 900,
              maxHeight: 900,
              top: "-15%",
              left: "-10%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          {/* Blob 2 — deep indigo, bottom-right drift */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-2"
            style={{
              width: "50vw",
              height: "50vw",
              maxWidth: 800,
              maxHeight: 800,
              bottom: "-12%",
              right: "-8%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 68%)",
              filter: "blur(90px)",
            }}
          />
          {/* Blob 3 — electric blue, center right */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-3"
            style={{
              width: "38vw",
              height: "38vw",
              maxWidth: 620,
              maxHeight: 620,
              top: "20%",
              right: "5%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.055) 0%, transparent 65%)",
              filter: "blur(80px)",
            }}
          />
          {/* Blob 4 — navy glow, center-left */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-4"
            style={{
              width: "35vw",
              height: "35vw",
              maxWidth: 560,
              maxHeight: 560,
              top: "55%",
              left: "8%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 62%)",
              filter: "blur(85px)",
            }}
          />
          {/* Blob 5 — cool blue, top-right */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-5"
            style={{
              width: "28vw",
              height: "28vw",
              maxWidth: 450,
              maxHeight: 450,
              top: "-5%",
              right: "10%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 60%)",
              filter: "blur(75px)",
            }}
          />
        </>
      )}
    </>
  );
}
