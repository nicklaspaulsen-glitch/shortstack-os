"use client";
import { Microphone, Sparkle } from "@phosphor-icons/react";

/**
 * TrinityHero3D — dashboard home hero. A 3D crystal "Trinity" floats on
 * the left, narrating the most-relevant suggestion or status line on
 * the right as a typing-style caption.
 *
 * Architecture:
 *   - The R3F canvas (heavy: three.js + R3F) is dynamic-imported with
 *     `{ ssr: false }` so it doesn't bloat the dashboard's initial JS.
 *     SSR + reduced-motion users get a CSS-only fallback that matches
 *     the visual silhouette.
 *   - Captions rotate every 5s. When a new caption arrives, Trinity
 *     enters "speaking" state — the crystal pulses faster, halo
 *     accelerates — for the duration of the typing animation.
 *   - Captions are sourced from /api/ai/suggest-topics (surface=script_lab
 *     by default). Falls back to a curated rotation while loading or on
 *     error so the hero is never empty.
 *
 * Drop into `/dashboard` page above the bento grid:
 *   <TrinityHero3D />
 *
 * Honors prefers-reduced-motion: caption rotation slows + canvas drops
 * back to the CSS fallback (no animation).
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokens } from "@/lib/brand/tokens";

const TrinityHero3DCanvas = dynamic(() => import("./trinity-hero-canvas"), {
  ssr: false,
  loading: () => null,
});

export interface TrinityHero3DProps {
  /** Pulled from auth context; first-name greeting in the headline. */
  greeting?: string;
  /** Visual size of the canvas in px. Defaults to 320. */
  size?: number;
  /** Surface used to fetch AI suggestions for the rotating caption. */
  suggestionSurface?:
    | "script_lab"
    | "cold_email"
    | "copywriter"
    | "thumbnail"
    | "ad_copy"
    | "email_composer"
    | "social_post";
  /** Optional className for the wrapper. */
  className?: string;
}

interface SuggestedTopic {
  topic: string;
  reason: string;
  impact?: "high" | "medium" | "low";
}

const FALLBACK_LINES: ReadonlyArray<string> = [
  "I'm analyzing your pipeline. New ideas in a moment.",
  "Three of your last leads went cold. Worth a follow-up?",
  "I've been watching the calendar. Wednesday is your best send day.",
  "Your last hook outperformed by 2.4x. Want to ship a sequel?",
  "Quick win: clean the duplicate leads in your CRM.",
];

const TYPING_SPEED_MS = 22;
const CAPTION_HOLD_MS = 4500;

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
 * CSS-only fallback while the R3F canvas chunk loads (or always, when
 * reduced-motion is set). A slowly rotating diamond with indigo glow.
 */
function TrinityCssFallback({ size }: { size: number }) {
  const inner = Math.round(size * 0.45);
  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center"
      aria-hidden
    >
      <div
        className="absolute animate-stack-rotate"
        style={{
          width: inner,
          height: inner,
          background: `linear-gradient(135deg, ${tokens.brand.accent} 0%, ${tokens.brand.accentSoft} 100%)`,
          transform: "rotate(45deg)",
          borderRadius: 8,
          boxShadow: `0 0 60px ${tokens.brand.accentGlow}, 0 0 120px ${tokens.brand.accentGlow}`,
        }}
      />
    </div>
  );
}

export default function TrinityHero3D({
  greeting,
  size = 320,
  suggestionSurface = "script_lab",
  className = "",
}: TrinityHero3DProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [captions, setCaptions] = useState<readonly string[]>(FALLBACK_LINES);
  const [activeIdx, setActiveIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => setMounted(true), []);

  // Pull live AI suggestions to use as captions. Fire-and-forget — falls
  // back to FALLBACK_LINES if the request fails (no auth, rate-limited,
  // etc.). Captions become "Quick idea: <topic> — <reason>."
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai/suggest-topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surface: suggestionSurface, max: 5 }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: SuggestedTopic[] };
        if (cancelled) return;
        const lines = (data.suggestions ?? [])
          .filter(s => s.topic)
          .map(s => `Try this: "${s.topic}". ${s.reason ?? ""}`.trim());
        if (lines.length > 0) {
          setCaptions(lines);
          setActiveIdx(0);
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestionSurface]);

  // Typing effect for the active caption + 5s hold + advance to the next.
  // Honors reduced motion: drop the typing pass + just hold each line.
  useEffect(() => {
    cancelRef.current.cancelled = true;
    cancelRef.current = { cancelled: false };
    const ctl = cancelRef.current;

    const line = captions[activeIdx] ?? "";

    if (reduceMotion) {
      setTyped(line);
      setIsSpeaking(false);
      const t = window.setTimeout(() => {
        if (!ctl.cancelled) setActiveIdx(i => (i + 1) % Math.max(1, captions.length));
      }, CAPTION_HOLD_MS);
      return () => {
        ctl.cancelled = true;
        window.clearTimeout(t);
      };
    }

    setTyped("");
    setIsSpeaking(true);

    let i = 0;
    const typer = window.setInterval(() => {
      if (ctl.cancelled) return;
      i++;
      setTyped(line.slice(0, i));
      if (i >= line.length) {
        window.clearInterval(typer);
        setIsSpeaking(false);
        const hold = window.setTimeout(() => {
          if (!ctl.cancelled) setActiveIdx(idx => (idx + 1) % Math.max(1, captions.length));
        }, CAPTION_HOLD_MS);
        ctl.cancelled = false;
        // Stash the timeout so cleanup can clear it
        (ctl as { hold?: number }).hold = hold;
      }
    }, TYPING_SPEED_MS);

    return () => {
      ctl.cancelled = true;
      window.clearInterval(typer);
      const h = (ctl as { hold?: number }).hold;
      if (h) window.clearTimeout(h);
    };
  }, [activeIdx, captions, reduceMotion]);

  const useCanvas = mounted && !reduceMotion;

  const headline = useMemo(() => {
    const name = greeting?.trim();
    if (!name) return "Trinity is online.";
    return `Hey ${name} — Trinity here.`;
  }, [greeting]);

  // Click-through to refresh the suggestion pool.
  const handleNudge = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ai/suggest-topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surface: suggestionSurface, max: 5, regenerate: true }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: SuggestedTopic[] };
        const lines = (data.suggestions ?? [])
          .filter(s => s.topic)
          .map(s => `Fresh take: "${s.topic}". ${s.reason ?? ""}`.trim());
        if (lines.length > 0) {
          setCaptions(lines);
          setActiveIdx(0);
        }
      } catch {
        /* swallow */
      }
    })();
  }, [suggestionSurface]);

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 md:p-8 shadow-stack-2 ${className}`}
      aria-label="Trinity AI assistant"
    >
      {/* Decorative indigo radial glow — sits behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${tokens.brand.accentGlow}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 grid items-center gap-6 md:grid-cols-[auto,1fr]">
        {/* Left — 3D crystal */}
        <div className="flex items-center justify-center">
          {useCanvas ? (
            <TrinityHero3DCanvas size={size} isSpeaking={isSpeaking} />
          ) : (
            <TrinityCssFallback size={size} />
          )}
        </div>

        {/* Right — speaking caption + headline */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  isSpeaking ? "animate-ping" : ""
                }`}
                style={{ background: tokens.brand.accent, opacity: 0.55 }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: tokens.brand.accent }}
              />
            </span>
            <span>{isSpeaking ? "Trinity speaking" : "Trinity online"}</span>
          </div>

          <h2 className="font-display text-2xl md:text-3xl text-text-primary tracking-tight mb-3">
            {headline}
          </h2>

          {/* Typing-style caption. Reserved-height container prevents
              layout shift between captions. */}
          <p
            className="min-h-[3.5rem] text-[14px] md:text-[15px] text-text-secondary leading-relaxed"
            aria-live="polite"
          >
            {typed}
            {isSpeaking && (
              <span
                className="ml-0.5 inline-block w-[2px] h-[1em] align-text-bottom animate-pulse"
                style={{ background: tokens.brand.accent }}
                aria-hidden
              />
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNudge}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-light px-3 py-1.5 text-[12px] text-text-primary transition-all hover:border-brand-accent/40 hover:bg-brand-accent/10"
            >
              <Sparkle size={12} />
              <span>Give me fresh ideas</span>
            </button>
            <span className="text-[11px] text-text-muted">
              <Microphone size={11} className="-mt-px mr-1 inline-block" />
              Voice replies coming soon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
