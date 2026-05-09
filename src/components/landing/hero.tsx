"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/brand-config";

const Hero3DScene = dynamic(() => import("./hero-3d-scene"), { ssr: false });
const HeroProductTour = dynamic(() => import("./hero-product-tour"), { ssr: false });

const CONTENT_VARIANTS = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 overflow-hidden">
      {/* R3F 3D scene — transparent canvas, sits behind everything */}
      <Hero3DScene />

      {/* Animated glow orbs */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.07) 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="absolute top-20 right-0 w-[400px] h-[400px] pointer-events-none"
        animate={{ y: [0, -20, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle, rgba(255,45,45,0.08) 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="absolute top-40 left-0 w-[300px] h-[300px] pointer-events-none"
        animate={{ y: [0, 16, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{
          background:
            "radial-gradient(circle, rgba(255,45,45,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Floating glass prism decoratives */}
      <motion.div
        className="absolute right-[8%] top-[18%] w-16 h-16 rounded-xl hidden lg:block pointer-events-none"
        animate={{ y: [0, -14, 0], rotate: [8, 16, 8] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: "rgba(255, 45, 45, 0.07)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 45, 45, 0.18)",
          boxShadow: "0 0 24px rgba(255, 45, 45, 0.10) inset",
        }}
      />
      <motion.div
        className="absolute left-[7%] top-[32%] w-10 h-10 rounded-lg hidden lg:block pointer-events-none"
        animate={{ y: [0, 12, 0], rotate: [-6, 6, -6] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
        }}
      />
      <motion.div
        className="absolute right-[13%] top-[44%] w-9 h-9 rounded-full hidden lg:block pointer-events-none"
        animate={{ y: [0, -10, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        style={{
          background: "rgba(255, 45, 45, 0.10)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 45, 45, 0.20)",
        }}
      />
      <motion.div
        className="absolute left-[11%] top-[52%] w-6 h-20 rounded-full hidden xl:block pointer-events-none"
        animate={{ y: [0, 8, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{
          background: "linear-gradient(180deg, rgba(255,45,45,0.14) 0%, transparent 100%)",
          border: "1px solid rgba(255, 45, 45, 0.12)",
        }}
      />

      {/* Main content — Framer Motion stagger container */}
      <motion.div
        className="max-w-5xl mx-auto text-center relative z-10"
        variants={CONTENT_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div
          variants={ITEM_VARIANTS}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#FF6B6B",
          }}
        >
          <Sparkles size={12} />
          Built by agency operators, for agency operators
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={ITEM_VARIANTS}
          className="text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight font-display"
          style={{
            background:
              "linear-gradient(135deg, #ffffff 0%, #FF2D2D 40%, #FF6B6B 60%, #ffffff 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
          }}
        >
          The operating system
          <br />
          that replaces 15 agency SaaS tools.
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          variants={ITEM_VARIANTS}
          className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          {BRAND.product_name} is the all-in-one command center for digital
          marketing agencies. Lead scraping, AI outreach and calls, content
          generation and publishing, CRM, proposals, contracts, billing, and
          white-label client portals — in one platform your clients will
          actually brag about.
        </motion.p>

        {/* CTA row */}
        <motion.div
          variants={ITEM_VARIANTS}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/pricing"
            className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_40px_rgba(255,45,45,0.35)]"
            style={{
              background: "linear-gradient(135deg, #FF2D2D, #CC2424)",
              color: "#ffffff",
              boxShadow: "0 0 24px rgba(255,45,45,0.22)",
            }}
          >
            Start your 7-day free trial
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        </motion.div>

        {/* Trust micro-copy */}
        <motion.div
          variants={ITEM_VARIANTS}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-gray-500"
        >
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#FF2D2D" }} />
            No credit card required
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#FF2D2D" }} />
            Cancel anytime
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#FF2D2D" }} />
            You own your data
          </div>
        </motion.div>
      </motion.div>

      {/* Product tour — separate entrance with longer delay */}
      <motion.div
        className="max-w-5xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
      >
        <HeroProductTour />
      </motion.div>
    </section>
  );
}
