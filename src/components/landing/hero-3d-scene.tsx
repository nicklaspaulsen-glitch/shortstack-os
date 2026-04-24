"use client";

/**
 * Hero3DScene — SVG-only (temporary)
 *
 * HOTFIX Apr 26: the R3F-powered Canvas crashed production with
 *   TypeError: Cannot read properties of undefined (reading 'S')
 *     at isPrimaryRenderer
 * because @react-three/fiber@^9 and @react-three/drei@^10 target React 19
 * but this project is on React 18. `.npmrc legacy-peer-deps=true` bypassed
 * the install-time peer check but the runtime reconciler still crashes,
 * taking down the entire landing page (and any route that bounces through
 * it while signed-out).
 *
 * We're replacing the <Canvas> entirely with the prefers-reduced-motion
 * SVG fallback that was already part of this component. This drops all
 * R3F/three imports so the modules don't even load. A follow-up will
 * downgrade fiber@^8.17 + drei@^9.114 (React-18 compatible) and
 * restore the 3D version.
 */

import { useEffect, useState } from "react";

const GOLD_LIGHT = "#e4c876";
const GOLD_DARK = "#8a6f2f";

function StaticHeroArt() {
  return (
    <svg
      viewBox="0 0 800 500"
      className="w-full h-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="g-gold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity="0.7" />
          <stop offset="100%" stopColor={GOLD_DARK} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="210" cy="240" r="90" fill="url(#g-gold)" />
      <circle cx="600" cy="200" r="60" fill="url(#g-gold)" />
      <circle cx="520" cy="380" r="50" fill="url(#g-gold)" />
    </svg>
  );
}

export default function Hero3DScene() {
  // Track reduce-motion for the opacity-40 dim we used to apply on the
  // fallback path — preserved so the visual doesn't change for users
  // who had prefers-reduced-motion set.
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${reduceMotion ? "opacity-40" : "opacity-60"}`}
      aria-hidden="true"
    >
      <StaticHeroArt />
    </div>
  );
}
