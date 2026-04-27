/**
 * GrainOverlay — analog noise texture for the brand foundation.
 *
 * Drop once in the root layout (e.g. inside <body>) for the
 * site-wide "anti-AI-slop" texture. Position fixed, z-index 50,
 * pointer-events none, blend-mode overlay at 0.03 opacity.
 *
 * Style supplied by `.brand-grain-overlay` in src/app/globals.css —
 * inline SVG noise, no external image, ~1KB total CSS cost.
 *
 * Server-safe: no client-only dependencies.
 */
export default function GrainOverlay() {
  return <div className="brand-grain-overlay" aria-hidden />;
}
