import Link from "next/link";

import BrainMark from "@/components/brand/brain-mark";

/**
 * 404 — editorial dead-end. Massive Bodoni Moda numerals, a centered Stack
 * 3D mark above, copy that owns the situation, and two CTAs (primary lime
 * "Back to dashboard", ghost "Report this" mailto).
 *
 * Faint lime grid pattern in the background gives the page a sense of
 * place without distracting from the type. Fully respects
 * prefers-reduced-motion via the Stack3D component.
 */
export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full bg-bg-base text-text-primary overflow-hidden flex items-center justify-center px-6 py-16">
      {/* Faint lime grid — pure CSS, sits behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(closest-side at 50% 45%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 45%, black 30%, transparent 80%)",
        }}
      />

      {/* Plum atmospheric glow — bottom-right, very low opacity */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, rgba(63,13,45,0.5), transparent 70%)",
        }}
      />

      <div className="relative z-10 text-center max-w-2xl">
        {/* Mark */}
        <div className="flex justify-center mb-6 animate-fade-in-foundation">
          <BrainMark size="md" glowing />
        </div>

        {/* Massive editorial 404 */}
        <h1
          className="font-editorial leading-[0.9] text-text-primary tracking-tight animate-slide-in-up"
          style={{
            fontSize: "clamp(6rem, 4rem + 12vw, 12rem)",
            animationDelay: "60ms",
          }}
        >
          404
          <span className="text-brand-lime">.</span>
        </h1>

        {/* Copy */}
        <p
          className="mt-6 text-[18px] md:text-[20px] text-text-secondary leading-relaxed max-w-[560px] mx-auto animate-slide-in-up"
          style={{ animationDelay: "120ms" }}
        >
          This route doesn&apos;t exist&nbsp;&mdash;&nbsp;yet. Or maybe ever.
        </p>
        <p
          className="mt-2 text-[13px] text-text-muted animate-slide-in-up"
          style={{ animationDelay: "150ms" }}
        >
          If you typed the URL by hand, double-check the spelling. If you
          followed a link, the page has probably moved.
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand-lime text-bg-base text-[14px] font-semibold hover:bg-brand-lime-soft transition-all duration-220 ease-out-expo-foundation shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_0_24px_-6px_rgba(255,255,255,0.45)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.45),0_0_32px_-4px_rgba(255,255,255,0.6)]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M6.854 3.146a.5.5 0 0 1 0 .708L3.707 7H13.5a.5.5 0 0 1 0 1H3.707l3.147 3.146a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 0 1 .708 0Z" fill="currentColor"/></svg>
            Back to dashboard
          </Link>
          <a
            href="mailto:hello@shortstack.work?subject=Broken%20link%20on%20ShortStack&body=I%20landed%20on%20a%20404%20at%20this%20URL%3A%20"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border-subtle bg-transparent text-text-secondary text-[14px] font-medium hover:border-border-strong hover:text-text-primary hover:bg-white/[0.02] transition-all duration-220 ease-out-expo-foundation"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h10A1.5 1.5 0 0 1 14 2.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 1 11.5v-9Zm1.5-.5a.5.5 0 0 0-.5.5v.795l5.5 3.143 5.5-3.143V2.5a.5.5 0 0 0-.5-.5h-10ZM13 4.87 8.053 7.686a1 1 0 0 1-.985.007L2 4.872V11.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V4.87Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
            Report this
          </a>
        </div>

        {/* Quiet attribution */}
        <p
          className="mt-12 text-[10.5px] text-text-muted/70 tracking-[0.18em] uppercase font-editorial animate-slide-in-up"
          style={{ animationDelay: "260ms" }}
        >
          ShortStack OS
        </p>
      </div>
    </div>
  );
}
