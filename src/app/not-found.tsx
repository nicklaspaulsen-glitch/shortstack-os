import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import Stack3D from "@/components/brand/stack-3d";

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
            "linear-gradient(to right, rgba(212,255,0,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,255,0,0.4) 1px, transparent 1px)",
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
          <Stack3D size="md" rotating />
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
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand-lime text-bg-base text-[14px] font-semibold hover:bg-brand-lime-soft transition-all duration-220 ease-out-expo-foundation shadow-[0_0_0_1px_rgba(212,255,0,0.3),0_0_24px_-6px_rgba(212,255,0,0.45)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.45),0_0_32px_-4px_rgba(212,255,0,0.6)]"
          >
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>
          <a
            href="mailto:hello@shortstack.work?subject=Broken%20link%20on%20ShortStack&body=I%20landed%20on%20a%20404%20at%20this%20URL%3A%20"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border-subtle bg-transparent text-text-secondary text-[14px] font-medium hover:border-border-strong hover:text-text-primary hover:bg-white/[0.02] transition-all duration-220 ease-out-expo-foundation"
          >
            <Mail size={15} />
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
