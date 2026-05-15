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
            // Top-left: warm blue cloud
            "radial-gradient(ellipse 85% 65% at 8% 8%, rgba(59,130,246,0.065) 0%, transparent 62%)",
            // Bottom-right: soft indigo bloom
            "radial-gradient(ellipse 75% 60% at 92% 88%, rgba(99,102,241,0.055) 0%, transparent 58%)",
            // Center-right: sky highlight
            "radial-gradient(ellipse 55% 45% at 82% 25%, rgba(14,165,233,0.04) 0%, transparent 52%)",
            // Bottom-left: periwinkle accent
            "radial-gradient(ellipse 60% 45% at 15% 85%, rgba(147,197,253,0.045) 0%, transparent 50%)",
            // Center: neutral anchor (keeps base light)
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(248,250,252,0.6) 0%, transparent 65%)",
            // Base
            "#F3F6FA",
          ].join(", "),
        }}
      />

      {/* Animated drift layer — mounted client-side */}
      {mounted && (
        <>
          {/* Blob 1 — primary blue, top-left drift */}
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
              background: "radial-gradient(circle, rgba(37,99,235,0.055) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          {/* Blob 2 — indigo, bottom-right drift */}
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
              background: "radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 68%)",
              filter: "blur(90px)",
            }}
          />
          {/* Blob 3 — sky blue, center right */}
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
              background: "radial-gradient(circle, rgba(14,165,233,0.042) 0%, transparent 65%)",
              filter: "blur(80px)",
            }}
          />
          {/* Blob 4 — periwinkle, center-left */}
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
              background: "radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 62%)",
              filter: "blur(85px)",
            }}
          />
          {/* Blob 5 — soft warm highlight, top-right corner */}
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
              background: "radial-gradient(circle, rgba(186,230,253,0.055) 0%, transparent 60%)",
              filter: "blur(75px)",
            }}
          />
        </>
      )}
    </>
  );
}
