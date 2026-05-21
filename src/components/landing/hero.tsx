"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/brand-config";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ---------------------------------------------------------------------------
// Ambient glow config
// ---------------------------------------------------------------------------

const BLOBS = [
  // Primary blue — bottom-left
  {
    style: { left: "-6%", top: "42%", width: 680, height: 680 },
    color: "rgba(212,255,0,0.18)",
    animate: { y: [0, -26, 0], x: [0, 12, 0] },
    duration: 16,
    delay: 0,
  },
  // Indigo — top-right
  {
    style: { right: "-4%", top: "-6%", width: 520, height: 520 },
    color: "rgba(99,102,241,0.14)",
    animate: { y: [0, 18, 0], x: [0, -10, 0] },
    duration: 13,
    delay: 1.8,
  },
  // Wide diffuse — top-center
  {
    style: { left: "28%", top: "-18%", width: 860, height: 380 },
    color: "rgba(212,255,0,0.08)",
    animate: { y: [0, 14, 0], x: [0, 6, 0] },
    duration: 20,
    delay: 0.6,
  },
  // Violet — right-center
  {
    style: { right: "8%", top: "55%", width: 340, height: 340 },
    color: "rgba(139,92,246,0.07)",
    animate: { y: [0, -16, 0], x: [0, -6, 0] },
    duration: 10,
    delay: 3.2,
  },
];

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const STATS = [
  { value: "2.4M+", label: "Leads scraped" },
  { value: "850K+", label: "Messages sent" },
  { value: "$18M+", label: "Revenue managed" },
  { value: "50+", label: "Agencies active" },
];

// ---------------------------------------------------------------------------
// Mini dashboard mockup — glass UI preview
// ---------------------------------------------------------------------------

function DashboardMockup() {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[rgba(99,146,255,0.14)] shadow-[0_0_0_1px_rgba(99,146,255,0.06),0_24px_80px_rgba(0,0,0,0.6),0_0_120px_rgba(212,255,0,0.07)]"
      style={{ background: "rgba(13,17,32,0.92)", backdropFilter: "blur(24px)" }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(99,146,255,0.10)]"
        style={{ background: "rgba(19,24,39,0.90)" }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
        <span
          className="ml-4 text-[11px] px-3 py-1 rounded-md text-[#4A4A5A]"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          app.shortstack.work/dashboard
        </span>
      </div>

      {/* Dashboard body */}
      <div className="flex" style={{ minHeight: 360 }}>
        {/* Sidebar */}
        <div
          className="flex flex-col gap-1 py-4 px-2 border-r border-[rgba(99,146,255,0.08)]"
          style={{ width: 48, background: "rgba(13,17,32,0.95)" }}
        >
          {[0.9, 0.5, 0.5, 0.5, 0.5, 0.5].map((op, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-lg mx-auto"
              style={{
                background: i === 0
                  ? "rgba(212,255,0,0.25)"
                  : "rgba(255,255,255,0.04)",
                opacity: op,
              }}
            />
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 p-5 flex flex-col gap-4">
          {/* Stat row */}
          <div className="grid grid-cols-4 gap-3">
            {["Revenue", "Leads", "Calls", "Posts"].map((label, i) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ background: "rgba(19,24,39,0.80)", border: "1px solid rgba(99,146,255,0.09)" }}
              >
                <div className="text-[10px] text-[#4A4A5A] mb-1.5">{label}</div>
                <div
                  className="text-sm font-bold"
                  style={{ color: i === 0 ? "#60A5FA" : "#A8A8B2" }}
                >
                  {["$14,280", "1,247", "38", "94"][i]}
                </div>
                <div className="mt-2 h-1 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: ["82%", "67%", "45%", "71%"][i],
                      background: i === 0 ? "rgba(212,255,0,0.6)" : "rgba(99,146,255,0.25)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Activity + chart placeholder */}
          <div className="grid grid-cols-[1fr_1.4fr] gap-3 flex-1">
            {/* Recent activity list */}
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: "rgba(19,24,39,0.80)", border: "1px solid rgba(99,146,255,0.09)" }}
            >
              <div className="text-[10px] text-[#4A4A5A] mb-1">Recent Activity</div>
              {[
                { label: "New lead scored", time: "2m ago", color: "#60A5FA" },
                { label: "Proposal accepted", time: "14m ago", color: "#34D399" },
                { label: "AI call completed", time: "31m ago", color: "#A78BFA" },
                { label: "Invoice paid", time: "1h ago", color: "#34D399" },
                { label: "Content published", time: "2h ago", color: "#60A5FA" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-[10px] text-[#A8A8B2]">{item.label}</span>
                  </div>
                  <span className="text-[9px] text-[#4A4A5A]">{item.time}</span>
                </div>
              ))}
            </div>

            {/* Sparkline chart */}
            <div
              className="rounded-xl p-3 flex flex-col"
              style={{ background: "rgba(19,24,39,0.80)", border: "1px solid rgba(99,146,255,0.09)" }}
            >
              <div className="text-[10px] text-[#4A4A5A] mb-2">Revenue this month</div>
              <div className="flex-1 relative flex items-end gap-1.5 px-1 pb-1">
                {[38, 52, 44, 67, 55, 72, 61, 84, 73, 91, 88, 96].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: `rgba(212,255,0,${0.15 + (h / 100) * 0.45})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center pt-28 pb-20 px-6 lg:px-8 overflow-hidden">

      {/* ── Ambient gradient blobs ── */}
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
          transition={{ duration: b.duration, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
        />
      ))}

      {/* ── Grid texture ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "72px 72px",
        }}
      />

      {/* ── Edge vignette ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 110% 80% at 50% 50%, transparent 20%, #0D1120 76%)",
        }}
      />

      {/* ── Main content — Interfere-style split layout ── */}
      <div className="relative z-10 max-w-7xl mx-auto w-full">

        {/* Hero grid: headline left, CTA right */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-12 lg:gap-16 items-center"
          variants={CONTAINER}
          initial="hidden"
          animate="visible"
        >
          {/* ── Left column ── */}
          <div className="flex flex-col">
            {/* Eyebrow */}
            <motion.p
              variants={ITEM}
              className="text-[11px] font-semibold tracking-[0.22em] uppercase text-indigo-400/70 mb-7"
            >
              Agency Operating System
            </motion.p>

            {/* Headline — serif italic on emphasis word (Interfere signature) */}
            <motion.h1
              variants={ITEM}
              className="text-5xl md:text-6xl xl:text-[5rem] 2xl:text-[5.5rem] font-extrabold leading-[1.03] tracking-[-0.03em] text-white"
            >
              Replace 15 tools{" "}
              <br className="hidden md:block" />
              with{" "}
              <em
                className="font-editorial not-italic"
                style={{
                  fontStyle: "italic",
                  color: "#60A5FA",
                  letterSpacing: "-0.01em",
                }}
              >
                one
              </em>{" "}
              platform.
            </motion.h1>

            {/* Numbered reveal — Interfere's "finds⁰¹ … understands⁰² … owns⁰³" */}
            <motion.p
              variants={ITEM}
              className="mt-8 text-base md:text-lg text-[#A8A8B2] leading-relaxed max-w-xl"
            >
              {BRAND.product_name}{" "}
              <strong className="text-indigo-400 font-semibold">scrapes</strong>
              <sup className="text-[9px] text-[#4A4A5A] ml-0.5 font-mono tracking-wider">01</sup>
              {" "}leads, {" "}
              <strong className="text-indigo-400 font-semibold">converts</strong>
              <sup className="text-[9px] text-[#4A4A5A] ml-0.5 font-mono tracking-wider">02</sup>
              {" "}them automatically, and{" "}
              <strong className="text-indigo-400 font-semibold">manages</strong>
              <sup className="text-[9px] text-[#4A4A5A] ml-0.5 font-mono tracking-wider">03</sup>
              {" "}your clients end-to-end.
            </motion.p>

            {/* Stats row */}
            <motion.div
              variants={ITEM}
              className="flex flex-wrap gap-x-8 gap-y-4 mt-10"
            >
              {STATS.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-2xl font-bold text-white font-display tracking-tight"
                  >
                    {s.value}
                  </div>
                  <div className="text-xs text-[#4A4A5A] mt-0.5">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right column — tagline + CTAs ── */}
          <div className="flex flex-col gap-7 lg:pt-8">
            <motion.p
              variants={ITEM}
              className="text-[#A8A8B2] text-base leading-relaxed"
            >
              Scrape leads, run AI outreach and voice calls, manage clients,
              create content, send proposals, and handle billing — all from one
              dark-glass command center. Zero duct tape.
            </motion.p>

            {/* CTA buttons */}
            <motion.div variants={ITEM} className="flex flex-col gap-3">
              <Link
                href="/pricing"
                className="relative inline-flex items-center justify-center gap-2.5 font-semibold text-[13px] h-11 px-6 rounded-[14px] bg-[#3B82F6] text-white border border-[rgba(96,165,250,0.40)] shadow-[0_0_0_1px_rgba(212,255,0,0.30),0_4px_20px_rgba(212,255,0,0.50),0_0_60px_rgba(212,255,0,0.18)] hover:bg-[#2563EB] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.50),0_6px_28px_rgba(212,255,0,0.65),0_0_80px_rgba(212,255,0,0.28)] hover:-translate-y-0.5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
              >
                Start your 7-day free trial
                <ArrowRight size={15} />
              </Link>

              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 font-medium text-[12px] h-9 px-4 rounded-[12px] bg-transparent text-[#A8A8B2] border border-[rgba(99,146,255,0.18)] hover:bg-[rgba(212,255,0,0.08)] hover:text-[#C8C8D4] hover:border-[rgba(99,146,255,0.32)] transition-all duration-200"
              >
                See all features
                <ChevronRight size={13} />
              </Link>
            </motion.div>

            {/* Trust micro-copy */}
            <motion.p variants={ITEM} className="text-[11px] text-[#4A4A5A]">
              No credit card required · Cancel anytime · Setup in 5 min
            </motion.p>
          </div>
        </motion.div>

        {/* ── Dashboard mockup — the product as the visual proof ── */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 lg:mt-20"
        >
          <DashboardMockup />
        </motion.div>

        {/* ── Trust logos ── */}
        <motion.div
          variants={ITEM}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.8 }}
          className="mt-14 flex flex-col items-center gap-4"
        >
          <p className="text-[11px] tracking-[0.16em] uppercase text-[#4A4A5A]">
            Trusted by agency teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {["Marketing Co.", "Growth Labs", "Agency Hub", "Scale Studio", "Rank Digital"].map(
              (name) => (
                <span key={name} className="text-[12px] font-medium text-[#4A4A5A]">
                  {name}
                </span>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
