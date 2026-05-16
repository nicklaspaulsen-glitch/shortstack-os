"use client";

/**
 * Typewriter — animated typewriter text with blinking cursor.
 * Supports multiple strings that cycle with a delete-then-type animation.
 * Adapted from 21st.dev/r/ibelick/typewriter for ShortStack.
 *
 * Usage:
 *   <Typewriter strings={["Generate leads.", "Close deals.", "Scale fast."]} />
 *   <Typewriter strings={["Hello"]} loop={false} typingSpeed={80} />
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  /** Strings to cycle through */
  strings: string[];
  /** Loop forever — defaults to true */
  loop?: boolean;
  /** ms per character while typing — defaults to 60 */
  typingSpeed?: number;
  /** ms per character while deleting — defaults to 30 */
  deletingSpeed?: number;
  /** ms pause at end of completed word — defaults to 1800 */
  pauseDuration?: number;
  /** Show blinking cursor — defaults to true */
  cursor?: boolean;
  /** Cursor character — defaults to | */
  cursorChar?: string;
  className?: string;
  cursorClassName?: string;
}

type Phase = "typing" | "pausing" | "deleting" | "done";

export function Typewriter({
  strings,
  loop = true,
  typingSpeed = 60,
  deletingSpeed = 30,
  pauseDuration = 1800,
  cursor = true,
  cursorChar = "|",
  className,
  cursorClassName,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [stringIndex, setStringIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reduced motion — just show first string statically
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (prefersReduced.current || strings.length === 0) {
      setDisplayText(strings[0] ?? "");
      return;
    }

    const current = strings[stringIndex] ?? "";

    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    if (phase === "typing") {
      if (charIndex < current.length) {
        timerRef.current = setTimeout(() => {
          setDisplayText(current.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);
        }, typingSpeed);
      } else {
        setPhase("pausing");
      }
    } else if (phase === "pausing") {
      timerRef.current = setTimeout(() => {
        if (!loop && stringIndex === strings.length - 1) {
          setPhase("done");
        } else {
          setPhase("deleting");
        }
      }, pauseDuration);
    } else if (phase === "deleting") {
      if (charIndex > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayText(current.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);
        }, deletingSpeed);
      } else {
        const next = (stringIndex + 1) % strings.length;
        setStringIndex(next);
        setPhase("typing");
      }
    }

    return clear;
  }, [phase, charIndex, stringIndex, strings, loop, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span>{displayText}</span>
      {cursor && phase !== "done" && (
        <span
          aria-hidden="true"
          className={cn(
            "ml-[2px] animate-[blink_1s_step-start_infinite]",
            cursorClassName
          )}
          style={{
            animationName: "blink",
            animationDuration: "1s",
            animationTimingFunction: "step-start",
            animationIterationCount: "infinite",
          }}
        >
          {cursorChar}
        </span>
      )}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </span>
  );
}

export default Typewriter;
