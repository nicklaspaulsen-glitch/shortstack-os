"use client";

/**
 * DashboardBackground — premium animated mesh gradient background.
 *
 * Six independently drifting blobs: blue, indigo, violet, and a teal accent.
 * Each blob has its own CSS keyframe animation so no JavaScript runs
 * per frame — it's pure CSS compositor work.
 *
 * Design intent:
 *   • Boosted opacity (8-18%) — enough vibrancy to feel like Glass SaaS OS
 *   • Color variety: blue/indigo blobs left, violet/indigo right, teal center
 *   • 17-26s drift cycles — slower than the eye tracks, creates presence
 *     without distraction
 *   • Blur radius 80-120px — blobs feel like light, not shapes
 *   • Respects prefers-reduced-motion — static fallback (still renders
 *     the gradient, just no animation)
 *
 * Usage: rendered once inside dashboard/layout.tsx, fixed behind all UI.
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
            // Top-left: deep blue corona — boosted vibrancy
            "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(37,99,235,0.16) 0%, transparent 60%)",
            // Bottom-right: indigo depth bloom
            "radial-gradient(ellipse 60% 50% at 70% 70%, rgba(212,255,0,0.12) 0%, transparent 55%)",
            // Top-right: violet accent
            "radial-gradient(ellipse 50% 40% at 82% 18%, rgba(139,92,246,0.10) 0%, transparent 50%)",
            // Bottom-left: subtle blue fade
            "radial-gradient(ellipse 40% 40% at 18% 82%, rgba(37,99,235,0.08) 0%, transparent 50%)",
            // Center: teal depth hint
            "radial-gradient(ellipse 30% 30% at 50% 55%, rgba(20,184,166,0.06) 0%, transparent 55%)",
            // Base — Trinity OS matte-black
            "#020711",
          ].join(", "),
        }}
      />

      {/* Animated drift layer — mounted client-side */}
      {mounted && (
        <>
          {/* Blob 1 — blue corona, top-left drift — boosted opacity + size */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-1"
            style={{
              width: "65vw",
              height: "65vw",
              maxWidth: 1060,
              maxHeight: 1060,
              top: "-20%",
              left: "-12%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 70%)",
              filter: "blur(110px)",
            }}
          />
          {/* Blob 2 — deep indigo, bottom-right drift */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-2"
            style={{
              width: "58vw",
              height: "58vw",
              maxWidth: 940,
              maxHeight: 940,
              bottom: "-15%",
              right: "-10%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,255,0,0.14) 0%, transparent 68%)",
              filter: "blur(100px)",
            }}
          />
          {/* Blob 3 — violet accent, center right — new hue for color variety */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-3"
            style={{
              width: "44vw",
              height: "44vw",
              maxWidth: 720,
              maxHeight: 720,
              top: "18%",
              right: "4%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)",
              filter: "blur(90px)",
            }}
          />
          {/* Blob 4 — navy/indigo glow, center-left */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-4"
            style={{
              width: "42vw",
              height: "42vw",
              maxWidth: 680,
              maxHeight: 680,
              top: "52%",
              left: "6%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 62%)",
              filter: "blur(95px)",
            }}
          />
          {/* Blob 5 — cool periwinkle, top-right */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-5"
            style={{
              width: "34vw",
              height: "34vw",
              maxWidth: 540,
              maxHeight: 540,
              top: "-6%",
              right: "8%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 60%)",
              filter: "blur(80px)",
            }}
          />
          {/* Blob 6 — teal depth, center stage (new) */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-none -z-19 dashboard-blob-3"
            style={{
              width: "30vw",
              height: "30vw",
              maxWidth: 480,
              maxHeight: 480,
              top: "38%",
              left: "40%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 65%)",
              filter: "blur(100px)",
            }}
          />
        </>
      )}
    </>
  );
}
