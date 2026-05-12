"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, ChevronRight, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/brand-config";

const HeroProductTour = dynamic(() => import("./hero-product-tour"), { ssr: false });

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ---------------------------------------------------------------------------
// Background blob config
// ---------------------------------------------------------------------------

const BLOBS = [
  // Large blue glow — bottom-left anchor
  {
    style: { left: "-8%", top: "38%", width: 720, height: 720 },
    color: "rgba(37,99,235,0.22)",
    animate: { y: [0, -28, 0], x: [0, 14, 0] },
    duration: 14,
    delay: 0,
  },
  // Indigo glow — top-right
  {
    style: { right: "-4%", top: "-8%", width: 560, height: 560 },
    color: "rgba(99,102,241,0.18)",
    animate: { y: [0, 20, 0], x: [0, -12, 0] },
    duration: 11,
    delay: 1.5,
  },
  // Wide diffuse — top-center
  {
    style: { left: "20%", top: "-20%", width: 900, height: 420 },
    color: "rgba(59,130,246,0.10)",
    animate: { y: [0, 16, 0], x: [0, 8, 0] },
    duration: 18,
    delay: 0.5,
  },
  // Violet accent — right-center
  {
    style: { right: "5%", top: "52%", width: 380, height: 380 },
    color: "rgba(139,92,246,0.09)",
    animate: { y: [0, -18, 0], x: [0, -8, 0] },
    duration: 9,
    delay: 3,
  },
];

// ---------------------------------------------------------------------------
// Stat cards (inline — no separate TrustBar section needed below hero)
// ---------------------------------------------------------------------------

const STATS = [
  { value: "2.4M+", label: "Leads scraped" },
  { value: "850K+", label: "Messages sent" },
  { value: "$18M+", label: "Revenue managed" },
  { value: "50+", label: "Agencies active" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center pt-28 pb-24 px-6 overflow-hidden">

      {/* ── Animated gradient blobs ── */}
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            ...b.style,
            background: `radial-gradient(circle at center, ${b.color} 0%, transparent 70%)`,
            filter: "blur(80px)",
          }}
          animate={b.animate}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: b.delay,
          }}
        />
      ))}

      {/* ── Subtle grid texture ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "64px 64px",
        }}
      />

      {/* ── Radial edge vignette — keeps blobs from bleeding to page edges ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 120% 80% at 50% 50%, transparent 25%, #070708 78%)",
        }}
      />

      {/* ── Main content ── */}
      <motion.div
        className="relative z-10 max-w-5xl mx-auto text-center"
        variants={CONTAINER}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow badge */}
        <motion.div variants={ITEM} className="mb-8">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(37,99,235,0.28)",
              color: "#93C5FD",
            }}
          >
            <Zap size={11} className="fill-blue-300" />
            The AI operating system for modern agencies
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={ITEM}
          className="text-5xl md:text-7xl xl:text-[5.5rem] font-extrabold leading-[1.04] tracking-[-0.03em] font-display text-white mb-6"
        >
          Replace 15 SaaS tools
          <br />
          <span className="text-blue-500">with one platform.</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          variants={ITEM}
          className="text-base md:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {BRAND.product_name} runs your agency end-to-end — lead scraping, AI outreach and calls,
          content creation, CRM, proposals, billing, and white-label client portals. One command center.
          Zero duct tape.
        </motion.p>

        {/* CTA row */}
        <motion.div
          variants={ITEM}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 bg-blue-600 hover:bg-blue-500 shadow-[0_0_28px_rgba(37,99,235,0.45)] hover:shadow-[0_0_52px_rgba(37,99,235,0.65)]"
          >
            Start your 7-day free trial
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform duration-150"
            />
          </Link>

          <Link
            href="#features"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-white transition-colors duration-150"
          >
            See all features
            <ChevronRight size={14} />
          </Link>
        </motion.div>

        {/* Trust micro-copy */}
        <motion.div
          variants={ITEM}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 mb-16"
        >
          {["No credit card required", "Cancel anytime", "You own your data"].map((text) => (
            <div key={text} className="flex items-center gap-1.5">
              <Shield size={11} className="text-blue-600" />
              {text}
            </div>
          ))}
        </motion.div>

        {/* Glass stat cards */}
        <motion.div
          variants={ITEM}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-5 text-center backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset",
              }}
            >
              <p
                className="text-2xl md:text-3xl font-extrabold mb-0.5 font-display"
                style={{ color: "#3B82F6" }}
              >
                {stat.value}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Product tour — delayed entrance, sits below the fold ── */}
      <motion.div
        className="relative z-10 max-w-5xl mx-auto w-full mt-20"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.75 }}
      >
        <HeroProductTour />
      </motion.div>
    </section>
  );
}
