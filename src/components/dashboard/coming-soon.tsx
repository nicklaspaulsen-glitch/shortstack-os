"use client";

/**
 * ComingSoon — shared "In Development" layout for stub routes.
 *
 * Used by dashboard pages whose backend hasn't shipped yet. Replaces the
 * half-broken mock UI with a premium, honest placeholder that:
 *  - Shows the feature title, tagline, and ETA
 *  - Lists what's coming ("What's coming" bullet list)
 *  - Lets users join the waitlist via POST /api/waitlist/join
 *  - Points at nearby shipped alternatives
 *
 * Visual language tracks the existing dashboard hero (see PageHero): dark
 * gradient, radial glows, dot pattern, gold-ish accent. Adds an animated
 * sparkle field so the page doesn't feel static.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Sparkles,
  ArrowLeft,
  Bell,
  ArrowRight,
  CheckCircle2,
  Clock,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";

export interface ComingSoonProps {
  /** Feature title, e.g. "Proposals" */
  title: string;
  /** One-line pitch shown under the title */
  tagline: string;
  /** lucide icon for the hero */
  icon: LucideIcon;
  /** Optional ETA string: "Q2 2026", "~2 weeks", "In beta", etc. */
  eta?: string;
  /** 4-6 bullet points describing what's shipping */
  features: string[];
  /** Nearby shipped alternatives to redirect users to */
  alternatives?: Array<{ label: string; href: string }>;
  /** Hero gradient as [start, end] hex. Defaults to dark gold. */
  gradient?: [string, string];
}

/** 12 evenly-spaced twinkle positions — deterministic so SSR matches CSR */
const SPARKLE_POSITIONS = [
  { top: "12%", left: "8%", delay: "0s", size: 10 },
  { top: "22%", left: "84%", delay: "1.4s", size: 8 },
  { top: "68%", left: "15%", delay: "0.7s", size: 12 },
  { top: "80%", left: "72%", delay: "2.1s", size: 9 },
  { top: "38%", left: "50%", delay: "0.3s", size: 7 },
  { top: "56%", left: "92%", delay: "1.8s", size: 11 },
  { top: "8%", left: "62%", delay: "2.4s", size: 8 },
  { top: "90%", left: "40%", delay: "0.9s", size: 10 },
  { top: "45%", left: "22%", delay: "3.1s", size: 9 },
  { top: "28%", left: "36%", delay: "1.1s", size: 7 },
  { top: "72%", left: "58%", delay: "2.6s", size: 8 },
  { top: "15%", left: "94%", delay: "0.5s", size: 9 },
];

export function ComingSoon({
  title,
  tagline,
  icon: Icon,
  eta,
  features,
  alternatives,
  gradient = ["#3d3020", "#1a1611"],
}: ComingSoonProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  // Email is optional — the waitlist endpoint resolves the authed user's
  // email server-side. We only ask for email as a fallback for anonymous
  // users (shouldn't normally hit this code path inside /dashboard).

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: title, email: email || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to join waitlist");
      }
      setJoined(true);
      setPosition(typeof data?.position === "number" ? data.position : null);
      toast.success("You're on the list — we'll email you when it ships");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join waitlist");
    } finally {
      setSubmitting(false);
    }
  }

  const [gStart, gEnd] = gradient;
  const heroGradient = `linear-gradient(135deg, ${gStart} 0%, ${gEnd} 100%)`;

  return (
    <div className="fade-in space-y-6 max-w-[1100px] mx-auto pb-10">
      {/* Back-to-dashboard link */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-gold transition-colors"
        >
          <ArrowLeft size={12} />
          Back to dashboard
        </Link>
      </div>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/5"
        style={{
          background: heroGradient,
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.05) inset, 0 2px 8px rgba(0,0,0,0.25), 0 10px 28px -8px rgba(0,0,0,0.5)",
        }}
      >
        {/* Radial glows */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-[360px] h-[360px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${gStart}66 0%, transparent 65%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-[300px] h-[300px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${gEnd}55 0%, transparent 65%)`,
          }}
        />

        {/* Inset vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.5)" }}
        />

        {/* Twinkling sparkle field */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {SPARKLE_POSITIONS.map((p, i) => (
            <Sparkles
              key={i}
              size={p.size}
              className="absolute text-white/60 coming-soon-twinkle"
              style={{
                top: p.top,
                left: p.left,
                animationDelay: p.delay,
              }}
            />
          ))}
        </div>

        {/* Dot pattern */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full"
          style={{ opacity: 0.08 }}
          aria-hidden
        >
          <defs>
            <pattern id="cs-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cs-dots)" />
        </svg>

        <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 text-center">
          <div
            className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#E4C876",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
            }}
          >
            <Icon size={30} />
          </div>

          {/* In-development pill */}
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] border border-white/15 bg-white/[0.08] text-white/85 backdrop-blur-sm">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-amber-300 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-400" />
            </span>
            In Development
            {eta && (
              <>
                <span className="w-px h-3 bg-white/20 mx-0.5" />
                <Clock size={10} className="opacity-75" />
                <span className="text-white/75 font-medium normal-case tracking-normal">
                  {eta}
                </span>
              </>
            )}
          </div>

          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
          >
            {title}
          </h1>
          <p
            className="text-sm sm:text-base mt-3 max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {tagline}
          </p>
        </div>
      </div>

      {/* Main grid: "What's coming" + "Join waitlist" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* What's coming */}
        <div className="lg:col-span-2 card !p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
              <Hammer size={14} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                What&apos;s coming
              </h2>
              <p className="text-[10px] text-muted leading-tight">
                Features we&apos;re building for {title}
              </p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {features.map((feat, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[12.5px] text-foreground leading-snug"
              >
                <CheckCircle2
                  size={15}
                  className="text-gold shrink-0 mt-0.5"
                  strokeWidth={2.2}
                />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Waitlist panel */}
        <div className="card !p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
              <Bell size={14} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                Get notified
              </h2>
              <p className="text-[10px] text-muted leading-tight">
                We&apos;ll email when it launches
              </p>
            </div>
          </div>

          {joined ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center text-success mb-3">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-[13px] font-semibold text-foreground">
                You&apos;re on the list
              </p>
              <p className="text-[11px] text-muted mt-1">
                {position !== null && position > 0
                  ? `You're #${position + 1} — we'll email the moment it ships.`
                  : "We'll email the moment it ships."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="flex-1 flex flex-col gap-2.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-[12px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                style={{
                  background: "var(--color-accent, #C9A84C)",
                  boxShadow: "0 1px 3px rgba(201,168,76,0.25)",
                }}
              >
                {submitting ? (
                  <>Joining…</>
                ) : (
                  <>
                    <Bell size={13} />
                    Notify me
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Alternatives row */}
      {alternatives && alternatives.length > 0 && (
        <div className="card !p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <ArrowRight size={14} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                Use this instead for now
              </h2>
              <p className="text-[10px] text-muted leading-tight">
                Nearby tools that ship the closest workflow today
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {alternatives.map((alt) => (
              <Link
                key={alt.href}
                href={alt.href}
                className="group flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-light hover:border-gold/30 transition-all"
              >
                <span className="text-[12px] font-semibold text-foreground truncate">
                  {alt.label}
                </span>
                <ArrowRight
                  size={14}
                  className="text-muted group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Twinkle keyframes — local to this component */}
      <style jsx>{`
        :global(.coming-soon-twinkle) {
          animation: coming-soon-twinkle 3.2s ease-in-out infinite;
          opacity: 0.35;
        }
        @keyframes coming-soon-twinkle {
          0%,
          100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

export default ComingSoon;
