"use client";

/**
 * LoginHero — editorial left column for the redesigned login screen.
 *
 * Renders the massive Stack 3D mark, an editorial Bodoni Moda eyebrow, the
 * Satoshi welcome headline, a one-line product positioning subhead, and a
 * subtly rotating live-stat ticker at the bottom.
 *
 * The ticker numbers are intentionally illustrative (sourced from the
 * production agency template copy) — they rotate on a 4s cadence to give
 * the hero an "always alive" feeling without making any HTTP requests on
 * the unauthenticated login surface. If we want true live numbers later,
 * swap `STAT_LINES` for a fetch from `/api/public/stats` with a fallback
 * to the static array.
 */

import { useEffect, useState } from "react";
import Stack3D from "@/components/brand/stack-3d";

const STAT_LINES: ReadonlyArray<string> = [
  "12,847 leads scored today",
  "342 calls auto-analyzed",
  "1,103 cold emails sent",
  "58 proposals out the door",
  "9,214 contacts validated",
];

const TICKER_INTERVAL_MS = 4000;

function useReducedMotion(): boolean {
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

export default function LoginHero() {
  const reduceMotion = useReducedMotion();
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setTickerIdx((prev) => (prev + 1) % STAT_LINES.length);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="relative flex flex-col justify-between h-full p-10 md:p-14 lg:p-20 overflow-hidden">
      {/* Decorative lime-tinted radial glow — sits behind the type, never on top */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full opacity-[0.08] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, rgba(212,255,0,0.6), transparent 70%)",
        }}
      />
      {/* Faint plum glow lower-right for editorial complement */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 w-[480px] h-[480px] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, rgba(63,13,45,0.8), transparent 70%)",
        }}
      />

      {/* Top — Stack 3D mark */}
      <div className="relative z-10 animate-fade-in-foundation">
        <Stack3D size="lg" rotating />
      </div>

      {/* Middle — eyebrow + headline + subhead */}
      <div className="relative z-10 max-w-[640px]">
        <p
          className="font-editorial text-[14px] md:text-[15px] text-brand-lime/90 tracking-[0.04em] mb-4 animate-slide-in-up"
          style={{ animationDelay: "60ms" }}
        >
          Built for agencies that ship.
        </p>
        <h1
          className="font-display text-text-primary leading-[0.95] tracking-tight animate-slide-in-up"
          style={{
            fontSize: "clamp(3rem, 1rem + 7vw, 8rem)",
            animationDelay: "120ms",
          }}
        >
          Welcome
          <br />
          back.
        </h1>
        <p
          className="mt-6 text-[16px] md:text-[18px] text-text-secondary leading-relaxed max-w-[520px] animate-slide-in-up"
          style={{ animationDelay: "180ms" }}
        >
          The operating system that scores, calls, writes and ships outreach
          while you focus on closing.
        </p>
      </div>

      {/* Bottom — live-feeling stat ticker */}
      <div
        className="relative z-10 flex items-center gap-3 text-[12px] tracking-wide text-text-muted animate-slide-in-up"
        style={{ animationDelay: "240ms" }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-lime opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-lime" />
        </span>
        <span className="font-editorial uppercase tracking-[0.18em] text-text-muted/80">Live</span>
        <span className="text-text-secondary tabular-nums transition-opacity duration-220" key={tickerIdx}>
          {STAT_LINES[tickerIdx]}
        </span>
      </div>
    </div>
  );
}
