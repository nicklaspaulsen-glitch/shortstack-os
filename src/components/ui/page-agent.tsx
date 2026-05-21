"use client";

/**
 * PageAgent — Competitive intelligence widget
 *
 * Drop into any creative page to show what's going viral in the client's niche
 * alongside quick-action CTAs. Powered by mock data in v1; wires to
 * /api/enemy-tracker/feed in production.
 *
 * Usage:
 *   <PageAgent context="thumbnail" niche="fitness" />
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Eye,
  Flame,
  Wand2,
  Copy,
  ChevronRight,
  Sparkles,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentContext =
  | "thumbnail"
  | "ai-studio"
  | "video-gen"
  | "video-editor"
  | "social-studio"
  | "content-hub"
  | "script-lab"
  | "ads-manager";

interface TrendItem {
  id: string;
  platform: "tiktok" | "instagram" | "youtube" | "x";
  thumbnailSeed: string;
  title: string;
  views: number;
  viralScore: number;
  hook: string;
  niche: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#69C9D0",
  instagram: "#E1306C",
  youtube: "#FF0000",
  x: "#A8B3C5",
};

const CONTEXT_ACTIONS: Record<
  AgentContext,
  { label: string; icon: typeof Wand2; href: string }
> = {
  thumbnail: {
    label: "Generate Similar Thumbnail",
    icon: Sparkles,
    href: "/dashboard/thumbnail-generator",
  },
  "ai-studio": {
    label: "Use This Style",
    icon: Wand2,
    href: "/dashboard/ai-studio",
  },
  "video-gen": {
    label: "Generate Similar Video",
    icon: Zap,
    href: "/dashboard/ai-video-gen",
  },
  "video-editor": {
    label: "Use This Format",
    icon: Wand2,
    href: "/dashboard/video-editor",
  },
  "social-studio": {
    label: "Schedule Similar Post",
    icon: ArrowUpRight,
    href: "/dashboard/social-studio",
  },
  "content-hub": {
    label: "Add to Content Plan",
    icon: ArrowUpRight,
    href: "/dashboard/content-library",
  },
  "script-lab": {
    label: "Write Script from This",
    icon: Wand2,
    href: "/dashboard/script-lab",
  },
  "ads-manager": {
    label: "Launch Ad from This",
    icon: Zap,
    href: "/dashboard/ads-manager",
  },
};

// ─── Mock data ────────────────────────────────────────────────────────────────
// In production: fetched from /api/enemy-tracker/feed?limit=6

const TRENDING_ITEMS: TrendItem[] = [
  {
    id: "t1",
    platform: "tiktok",
    thumbnailSeed: "fitness-trend",
    title: "3 things that changed my physique in 60 days",
    views: 14_200_000,
    viralScore: 94,
    hook: "Specific result + short timeframe",
    niche: "fitness",
  },
  {
    id: "t2",
    platform: "instagram",
    thumbnailSeed: "business-reveal",
    title: "I make $40K/month working 4 hours a day",
    views: 9_800_000,
    viralScore: 91,
    hook: "Income reveal + lifestyle hook",
    niche: "business",
  },
  {
    id: "t3",
    platform: "youtube",
    thumbnailSeed: "design-process",
    title: "The color palette trick every designer knows",
    views: 4_300_000,
    viralScore: 84,
    hook: "Insider knowledge reveal",
    niche: "design",
  },
  {
    id: "t4",
    platform: "tiktok",
    thumbnailSeed: "food-tutorial",
    title: "5-ingredient dinner that goes viral every time",
    views: 21_700_000,
    viralScore: 97,
    hook: "Accessible + specific count",
    niche: "food",
  },
  {
    id: "t5",
    platform: "instagram",
    thumbnailSeed: "productivity-desk",
    title: "My $47K income breakdown as a solo creator",
    views: 7_100_000,
    viralScore: 88,
    hook: "Transparency + exact number",
    niche: "business",
  },
  {
    id: "t6",
    platform: "x",
    thumbnailSeed: "tech-hot-take",
    title: "Hot take: AI won't replace junior devs. Here's why.",
    views: 3_900_000,
    viralScore: 81,
    hook: "Controversy + expert counter-narrative",
    niche: "tech",
  },
];

const TRENDING_TOPICS = [
  "Day-in-my-life POV",
  "Income reveal",
  "Transformation (30-day)",
  "Things nobody talks about",
  "Stop doing this mistake",
  "I tried X for 7 days",
  "Here's what actually works",
];

// ─── TrendCard ───────────────────────────────────────────────────────────────

function TrendCard({
  item,
  onAction,
  context,
}: {
  item: TrendItem;
  onAction: (item: TrendItem) => void;
  context: AgentContext;
}) {
  const [hovered, setHovered] = useState(false);
  const platformColor = PLATFORM_COLORS[item.platform];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{
        background: "rgba(13,17,32,0.95)",
        border: hovered
          ? "1px solid rgba(212,255,0,0.35)"
          : "1px solid rgba(212, 255, 0,0.08)",
        transition: "border-color 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onAction(item)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "9/14" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${item.thumbnailSeed}/200/310`}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Platform dot */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md"
          style={{ background: `${platformColor}18`, border: `1px solid ${platformColor}33` }}>
          <div className="w-1 h-1 rounded-full" style={{ background: platformColor }} />
          <span className="text-[9px] font-semibold" style={{ color: platformColor }}>
            {item.platform.toUpperCase().slice(0, 2)}
          </span>
        </div>

        {/* Viral score */}
        <div
          className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
          style={{
            background: item.viralScore >= 90 ? "rgba(34,197,94,0.20)" : "rgba(212,255,0,0.20)",
            border: `1px solid ${item.viralScore >= 90 ? "rgba(34,197,94,0.30)" : "rgba(212,255,0,0.30)"}`,
            color: item.viralScore >= 90 ? "#22c55e" : "#60a5fa",
          }}
        >
          {item.viralScore}
        </div>

        {/* Action overlay on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(2,7,17,0.65)", backdropFilter: "blur(4px)" }}
            >
              <div className="text-center px-3">
                <Wand2 className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                <div className="text-[10px] font-semibold text-indigo-300">
                  {CONTEXT_ACTIONS[context].label}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Views */}
        <div className="absolute bottom-2 left-2 flex items-center gap-0.5 text-[9px] text-white/60">
          <Eye className="w-2.5 h-2.5" />
          {fmt(item.views)}
        </div>
      </div>

      {/* Card body */}
      <div className="px-2.5 py-2">
        <p className="text-[10px] text-white/80 font-medium leading-tight line-clamp-2">
          {item.title}
        </p>
        <p className="text-[9px] text-indigo-400/70 mt-1 truncate">{item.hook}</p>
      </div>
    </motion.div>
  );
}

// ─── PageAgent ────────────────────────────────────────────────────────────────

interface PageAgentProps {
  context: AgentContext;
  niche?: string;
  className?: string;
}

export default function PageAgent({ context, niche, className = "" }: PageAgentProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  const ctaConfig = CONTEXT_ACTIONS[context];
  const CTA_Icon = ctaConfig.icon;

  const handleItemAction = (item: TrendItem) => {
    const params = new URLSearchParams({
      hooks: item.hook,
      niche: item.niche,
      platform: item.platform,
      thumbnailSeed: item.thumbnailSeed,
      ref: `page-agent-${context}`,
    });
    router.push(`${ctaConfig.href}?${params.toString()}`);
  };

  const handleCopyHook = (hook: string) => {
    navigator.clipboard.writeText(hook);
    setCopiedHook(hook);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: "rgba(13,17,32,0.92)",
        border: "1px solid rgba(212,255,0,0.12)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(212,255,0,0.15)", border: "1px solid rgba(212,255,0,0.25)" }}>
            <Flame className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-white">
              What&apos;s Viral {niche ? `in ${niche}` : "Right Now"}
            </div>
            <div className="text-[10px] text-white/35">
              Competitor intelligence · Live
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <ChevronRight
            className="w-3.5 h-3.5 text-white/30 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05]">
              {/* Trending cards — horizontal scroll */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                  Top Viral Posts
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {TRENDING_ITEMS.map((item) => (
                    <div key={item.id} className="w-28 flex-shrink-0">
                      <TrendCard
                        item={item}
                        onAction={handleItemAction}
                        context={context}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending hooks — copy to use */}
              <div className="px-3 pb-3">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                  Hooks Going Viral
                </div>
                <div className="space-y-1.5">
                  {TRENDING_TOPICS.slice(0, 4).map((hook) => (
                    <button
                      key={hook}
                      onClick={() => handleCopyHook(hook)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[10px] font-medium transition-all hover:bg-indigo-500/10 group"
                      style={{
                        background:
                          copiedHook === hook
                            ? "rgba(34,197,94,0.08)"
                            : "rgba(255,255,255,0.03)",
                        border:
                          copiedHook === hook
                            ? "1px solid rgba(34,197,94,0.20)"
                            : "1px solid rgba(255,255,255,0.06)",
                        color:
                          copiedHook === hook
                            ? "#22c55e"
                            : "rgba(255,255,255,0.60)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingUp className="w-3 h-3 shrink-0 text-indigo-400" />
                        <span className="truncate">{hook}</span>
                      </div>
                      <Copy
                        className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: copiedHook === hook ? "#22c55e" : "#60a5fa" }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="px-3 pb-3">
                <button
                  onClick={() => router.push("/dashboard/enemy-tracker")}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, rgba(212,255,0,0.18) 0%, rgba(99,102,241,0.12) 100%)",
                    border: "1px solid rgba(212,255,0,0.25)",
                    color: "#60a5fa",
                  }}
                >
                  <CTA_Icon className="w-3.5 h-3.5" />
                  Open Full Enemy Tracker
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
