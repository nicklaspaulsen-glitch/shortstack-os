"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Film, Sparkles, ImageIcon, Users, MessageSquare, PenTool,
  Package, Globe,
} from "lucide-react";

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";

// Lucide icon compatible — accept any component that takes size + className
type LucideLike = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;

type Slide = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  Icon: LucideLike;
  body: React.ReactNode;
};

/**
 * MockFrame wraps each slide in a macOS-style window chrome so every
 * slide feels like a real screenshot even without a real PNG.
 */
function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl"
      style={{
        background: "#0f1218",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-4 py-2.5"
        style={{ background: "#171a21", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f56" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#27c93f" }} />
      </div>
      <div className="p-6 md:p-8 min-h-[320px] md:min-h-[400px]">{children}</div>
    </div>
  );
}

function Bar({ width, color = GOLD, opacity = 0.6 }: { width: string; color?: string; opacity?: number }) {
  return (
    <div className="h-2 rounded-full" style={{ width, background: color, opacity }} />
  );
}

const SLIDES: Slide[] = [
  {
    id: "ai-studio",
    label: "AI Studio",
    title: "AI Studio",
    subtitle: "15+ generators in one place.",
    Icon: Sparkles,
    body: (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-lg h-20 flex items-center justify-center"
            style={{
              background: "rgba(200,168,85,0.06)",
              border: "1px solid rgba(200,168,85,0.12)",
            }}
          >
            <Sparkles size={18} style={{ color: GOLD }} />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "video-editor",
    label: "Video Editor",
    title: "Video Editor",
    subtitle: "Timeline that feels like Premiere.",
    Icon: Film,
    body: (
      <div className="space-y-3">
        <div className="rounded-lg h-32" style={{ background: "rgba(255,255,255,0.03)" }} />
        {["Video", "Audio", "Subtitles"].map((track, i) => (
          <div key={track} className="flex items-center gap-3">
            <div className="text-[10px] text-gray-500 w-16">{track}</div>
            <div className="flex-1 flex gap-1">
              {[0.3, 0.5, 0.2, 0.4, 0.6, 0.3].map((w, j) => (
                <div
                  key={j}
                  className="h-6 rounded"
                  style={{
                    flex: w,
                    background: i === 0 ? GOLD : i === 1 ? "#4a90e2" : "#27c93f",
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "thumbnail",
    label: "Thumbnails",
    title: "Thumbnail Editor",
    subtitle: "Photoshop in the browser.",
    Icon: ImageIcon,
    body: (
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3 rounded-lg aspect-video"
          style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` }} />
        <div className="space-y-2">
          {["T", "B", "I", "F"].map((k) => (
            <div key={k} className="h-10 rounded flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-sm font-semibold" style={{ color: GOLD }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "crm",
    label: "CRM",
    title: "Client CRM",
    subtitle: "Lifecycle health at a glance.",
    Icon: Users,
    body: (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-8 h-8 rounded-full" style={{ background: GOLD }} />
            <div className="flex-1 space-y-1.5">
              <Bar width="60%" color="#fff" opacity={0.8} />
              <Bar width="40%" />
            </div>
            <div className="text-[10px] px-2 py-1 rounded"
              style={{ background: "rgba(39,201,63,0.15)", color: "#27c93f" }}>active</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "team-chat",
    label: "Team Chat",
    title: "Team Chat",
    subtitle: "Slack, but inside your stack.",
    Icon: MessageSquare,
    body: (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex items-start gap-3 ${i % 2 ? "justify-end" : ""}`}>
            {!(i % 2) && <div className="w-7 h-7 rounded-full" style={{ background: GOLD }} />}
            <div className="rounded-xl p-3 max-w-[65%] space-y-1.5"
              style={{
                background: i % 2 ? GOLD : "rgba(255,255,255,0.05)",
                color: i % 2 ? "#0b0d12" : "#fff",
              }}>
              <Bar width={`${80 + i * 5}px`} color={i % 2 ? "#0b0d12" : "#fff"} opacity={0.8} />
              <Bar width={`${120 + i * 15}px`} color={i % 2 ? "#0b0d12" : "#fff"} opacity={0.5} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "creative-review",
    label: "Creative Review",
    title: "Creative Review",
    subtitle: "Comment, markup, approve.",
    Icon: PenTool,
    body: (
      <div className="relative aspect-video rounded-lg overflow-hidden"
        style={{ background: `linear-gradient(135deg, #2a2f3a, #1a1d25)` }}>
        <div className="absolute top-8 left-12 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: GOLD, color: "#0b0d12" }}>1</div>
        <div className="absolute bottom-12 right-16 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: GOLD, color: "#0b0d12" }}>2</div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium flex items-center gap-2"
          style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
          2 notes pending
        </div>
      </div>
    ),
  },
  {
    id: "assets",
    label: "Assets",
    title: "Asset Library",
    subtitle: "Everything, indexed and searchable.",
    Icon: Package,
    body: (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="aspect-square rounded-lg"
            style={{
              background: i % 3 === 0
                ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`
                : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "showcase",
    label: "Showcase",
    title: "Client Showcase",
    subtitle: "Case-study pages that sell for you.",
    Icon: Globe,
    body: (
      <div className="space-y-4">
        <div className="rounded-xl aspect-[16/7]"
          style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` }} />
        <div className="space-y-2">
          <Bar width="50%" color="#fff" opacity={0.9} />
          <Bar width="80%" opacity={0.4} />
          <Bar width="65%" opacity={0.4} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["+312%", "42 days", "$1.8M"].map((k) => (
            <div key={k} className="rounded-lg p-3"
              style={{ background: "rgba(200,168,85,0.06)", border: "1px solid rgba(200,168,85,0.12)" }}>
              <div className="text-lg font-bold" style={{ color: GOLD }}>{k}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/**
 * Auto-playing carousel, 4.2s per slide. Hover the card to pause.
 */
export default function ScreenshotCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 4200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  const slide = SLIDES[index];
  const Icon = slide.Icon;

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}>
            One platform, <span style={{ color: GOLD }}>every view.</span>
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            Eight flagship surfaces, rotating every four seconds. Hover to pause.
          </p>
        </motion.div>

        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative"
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                className="text-xs px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: i === index ? "rgba(200,168,85,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${i === index ? "rgba(200,168,85,0.4)" : "rgba(255,255,255,0.06)"}`,
                  color: i === index ? GOLD : "rgba(255,255,255,0.6)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(200,168,85,0.1)", border: "1px solid rgba(200,168,85,0.2)" }}>
                    <Icon size={18} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{slide.title}</h3>
                    <p className="text-sm text-gray-500">{slide.subtitle}</p>
                  </div>
                </div>
                <MockFrame>{slide.body}</MockFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
