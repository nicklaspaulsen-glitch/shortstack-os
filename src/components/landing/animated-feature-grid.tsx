"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  Brain, Users, Film, Image as ImageIcon, MessageSquare, Target,
  Zap, Globe, BarChart3,
} from "lucide-react";

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";

// Lucide icon compatible — accept any component that takes size + className
type LucideLike = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;

type Feature = {
  title: string;
  blurb: string;
  Icon: LucideLike;
  preview: (hovering: boolean) => React.ReactNode;
};

/**
 * Each feature's `preview` renders a small CSS/motion animation that
 * "plays" while hovering — pulse bars, flowing dots, orbiting particles, etc.
 */
const FEATURES: Feature[] = [
  {
    title: "AI Agents",
    blurb: "Sales, ops, and creative agents that close loops for you.",
    Icon: Brain,
    preview: (h) => (
      <div className="flex items-end gap-1 h-16">
        {[0.3, 0.6, 0.9, 0.45, 0.75, 0.5].map((baseH, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-t"
            style={{ background: GOLD }}
            animate={{
              height: h
                ? [`${baseH * 100}%`, `${(baseH + 0.2) * 100}%`, `${baseH * 100}%`]
                : `${baseH * 100}%`,
              opacity: h ? [0.6, 1, 0.6] : 0.5,
            }}
            transition={{ duration: 1.2, repeat: h ? Infinity : 0, delay: i * 0.08 }}
          />
        ))}
      </div>
    ),
  },
  {
    title: "CRM",
    blurb: "Auto-enriching client records with lifecycle health.",
    Icon: Users,
    preview: (h) => (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2"
            animate={{ x: h ? [0, 4, 0] : 0 }}
            transition={{ duration: 1.4, repeat: h ? Infinity : 0, delay: i * 0.1 }}
          >
            <div className="w-4 h-4 rounded-full" style={{ background: GOLD }} />
            <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(200,168,85,0.2)" }} />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: "Video Editor",
    blurb: "Premiere-style timeline in your browser.",
    Icon: Film,
    preview: (h) => (
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-3 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
            <motion.div
              className="absolute top-0 left-0 h-full rounded"
              style={{ background: i === 0 ? GOLD : i === 1 ? "#4a90e2" : "#27c93f" }}
              animate={{ width: h ? ["10%", "90%", "10%"] : "40%" }}
              transition={{ duration: 2, repeat: h ? Infinity : 0, delay: i * 0.15 }}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Thumbnails",
    blurb: "Photoshop-caliber editor built in.",
    Icon: ImageIcon,
    preview: (h) => (
      <div className="relative h-16 rounded overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` }}>
        <motion.div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
          animate={{ x: h ? ["-100%", "100%"] : "-100%" }}
          transition={{ duration: 1.8, repeat: h ? Infinity : 0, ease: "linear" }}
        />
      </div>
    ),
  },
  {
    title: "Team Chat",
    blurb: "Slack-style DMs + channels, native.",
    Icon: MessageSquare,
    preview: (h) => (
      <div className="space-y-2">
        <motion.div
          className="w-2/3 h-3 rounded-lg rounded-bl-none origin-left"
          style={{ background: "rgba(255,255,255,0.1)" }}
          animate={{ scaleX: h ? [0.4, 1, 1] : 1 }}
          transition={{ duration: 1.2, repeat: h ? Infinity : 0 }}
        />
        <motion.div
          className="w-1/2 h-3 rounded-lg rounded-br-none ml-auto"
          style={{ background: GOLD }}
          animate={{ scaleX: h ? [0, 1, 1] : 1 }}
          transition={{ duration: 1.2, repeat: h ? Infinity : 0, delay: 0.4 }}
        />
      </div>
    ),
  },
  {
    title: "Lead Scraper",
    blurb: "Qualified leads auto-enriched by AI.",
    Icon: Target,
    preview: (h) => (
      <div className="relative h-16 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2" style={{ borderColor: GOLD, opacity: 0.3 }} />
        <motion.div
          className="absolute w-3 h-3 rounded-full"
          style={{ background: GOLD }}
          animate={{
            x: h ? [0, 20, 0, -20, 0] : 0,
            y: h ? [-20, 0, 20, 0, -20] : 0,
          }}
          transition={{ duration: 2.5, repeat: h ? Infinity : 0, ease: "linear" }}
        />
      </div>
    ),
  },
  {
    title: "Automations",
    blurb: "Triggers, actions, and flows that never sleep.",
    Icon: Zap,
    preview: (h) => (
      <div className="flex items-center justify-between gap-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="flex-1 h-8 rounded flex items-center justify-center"
            style={{ background: "rgba(200,168,85,0.1)", border: "1px solid rgba(200,168,85,0.2)" }}
            animate={{ background: h
              ? ["rgba(200,168,85,0.1)", "rgba(200,168,85,0.3)", "rgba(200,168,85,0.1)"]
              : "rgba(200,168,85,0.1)"
            }}
            transition={{ duration: 1.2, repeat: h ? Infinity : 0, delay: i * 0.25 }}
          >
            <Zap size={12} style={{ color: GOLD }} />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: "Client Portal",
    blurb: "White-label portal you'll show off.",
    Icon: Globe,
    preview: (h) => (
      <motion.div
        className="h-16 rounded border"
        style={{
          background: "linear-gradient(135deg, rgba(200,168,85,0.05), rgba(200,168,85,0.02))",
          borderColor: "rgba(200,168,85,0.2)",
        }}
        animate={{ rotate: h ? [0, 1, -1, 0] : 0 }}
        transition={{ duration: 2, repeat: h ? Infinity : 0 }}
      >
        <div className="p-2 space-y-1.5">
          <div className="w-1/3 h-1.5 rounded-full" style={{ background: GOLD }} />
          <div className="w-2/3 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="w-1/2 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>
      </motion.div>
    ),
  },
  {
    title: "Analytics",
    blurb: "Unified metrics across every channel.",
    Icon: BarChart3,
    preview: (h) => (
      <motion.svg viewBox="0 0 120 48" className="w-full h-16">
        <motion.path
          d="M0,40 L20,30 L40,35 L60,15 L80,22 L100,8 L120,16"
          fill="none"
          stroke={GOLD}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: h ? [0, 1] : 1 }}
          transition={{ duration: 1.6, repeat: h ? Infinity : 0, ease: "easeInOut" }}
        />
      </motion.svg>
    ),
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const [hovering, setHovering] = useState(false);
  const Icon = feature.Icon;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -4 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="rounded-xl p-6 cursor-default"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(200,168,85,0.1)", border: "1px solid rgba(200,168,85,0.2)" }}>
          <Icon size={18} className="text-gold" />
        </div>
        <h3 className="text-white font-semibold">{feature.title}</h3>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed mb-5">{feature.blurb}</p>
      <div className="pt-2">{feature.preview(hovering)}</div>
    </motion.div>
  );
}

export default function AnimatedFeatureGrid() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}>
            Nine products. <span style={{ color: GOLD }}>One login.</span>
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            Hover any card to see the feature in motion.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
