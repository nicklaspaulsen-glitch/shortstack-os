"use client";

/**
 * GooeyMorphing — SVG filter gooey text morph effect.
 * Words dissolve into each other with a liquid "goo" transition.
 * Adapted from 21st.dev/r/serafimcloud/gooey-text-morphing.
 *
 * Usage:
 *   <GooeyMorphing words={["Agency OS", "Lead Machine", "Growth Engine"]} />
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GooeyMorphingProps {
  words: string[];
  /** Morph transition duration in ms — defaults to 900 */
  morphDuration?: number;
  /** Pause between morphs in ms — defaults to 2000 */
  holdDuration?: number;
  className?: string;
  /** Text style classes */
  textClassName?: string;
}

const FILTER_ID = "gooey-morph-filter";
const BLUR_AMOUNT = 8;

export function GooeyMorphing({
  words,
  morphDuration = 900,
  holdDuration = 2000,
  className,
  textClassName,
}: GooeyMorphingProps) {
  const [fromIndex, setFromIndex] = useState(0);
  const [toIndex, setToIndex] = useState(1 % (words.length || 1));
  const [progress, setProgress] = useState(0); // 0 → 1 during morph
  const [isMorphing, setIsMorphing] = useState(false);

  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const startMorph = () => {
    if (prefersReduced.current) {
      setFromIndex((i) => (i + 1) % words.length);
      setProgress(0);
      scheduleNext();
      return;
    }

    setIsMorphing(true);
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / morphDuration, 1);
      // Ease in-out
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setProgress(eased);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setIsMorphing(false);
        setProgress(0);
        setFromIndex(toIndex);
        setToIndex((toIndex + 1) % words.length);
        scheduleNext();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  const scheduleNext = () => {
    timerRef.current = setTimeout(startMorph, holdDuration);
  };

  useEffect(() => {
    if (words.length < 2) return;
    timerRef.current = setTimeout(startMorph, holdDuration);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blur values: from-text blurs out, to-text blurs in
  const fromBlur = isMorphing ? progress * BLUR_AMOUNT : 0;
  const toBlur   = isMorphing ? (1 - progress) * BLUR_AMOUNT : 0;
  const fromOpacity = isMorphing ? 1 - progress : 1;
  const toOpacity   = isMorphing ? progress : 0;

  return (
    <div className={cn("relative select-none", className)}>
      {/* SVG gooey filter */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={FILTER_ID}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className="relative flex items-center justify-center"
        style={{ filter: isMorphing ? `url(#${FILTER_ID})` : undefined }}
      >
        {/* FROM word */}
        <span
          aria-hidden={isMorphing}
          className={cn("absolute", textClassName)}
          style={{
            opacity: fromOpacity,
            filter: `blur(${fromBlur}px)`,
            transition: "none",
          }}
        >
          {words[fromIndex]}
        </span>

        {/* TO word */}
        <span
          aria-hidden={!isMorphing}
          className={cn("absolute", textClassName)}
          style={{
            opacity: toOpacity,
            filter: `blur(${toBlur}px)`,
            transition: "none",
          }}
        >
          {words[toIndex]}
        </span>

        {/* Invisible spacer keeps container at max word width */}
        <span className="invisible" aria-hidden="true">
          {words.reduce((a, b) => (a.length > b.length ? a : b), "")}
        </span>
      </div>
    </div>
  );
}

export default GooeyMorphing;
