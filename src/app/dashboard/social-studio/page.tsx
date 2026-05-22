"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Sparkles, Lightbulb, BarChart3, Users, TrendingUp, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Tab1Calendar from "./components/Tab1Calendar";
import Tab2AIUpload from "./components/Tab2AIUpload";
import Tab3Trends from "./components/Tab3Trends";
import Tab4Stats from "./components/Tab4Stats";
import Tab5TopCommenters from "./components/Tab5TopCommenters";
import { MotionPage } from "@/components/motion/motion-page";
import PageAgent from "@/components/ui/page-agent";
import CreatorIntelligence, { type CreatorIdea } from "@/components/ui/creator-intelligence";
import type { CreatorStyle } from "@/lib/ai/creator-styles";
import toast from "react-hot-toast";

type StudioTab = "calendar" | "ai-upload" | "trends" | "stats" | "commenters" | "creator-ideas";

interface TabConfig {
  key: StudioTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { key: "calendar",      label: "Calendar",       description: "Plan & lineup",             icon: <Calendar size={14} /> },
  { key: "ai-upload",     label: "AI Auto-Upload",  description: "Drag, drop, schedule",      icon: <Sparkles size={14} /> },
  { key: "trends",        label: "Trends & Ideas",  description: "Hashtags + ideas",          icon: <Lightbulb size={14} /> },
  { key: "stats",         label: "Stats",           description: "Performance + best times",  icon: <BarChart3 size={14} /> },
  { key: "commenters",    label: "Top Commenters",  description: "Reply with AI",             icon: <Users size={14} /> },
  { key: "creator-ideas", label: "Creator AI",      description: "12-archetype idea engine",  icon: <TrendingUp size={14} /> },
];

export default function SocialStudioPage() {
  useAuth();
  const [tab, setTab] = useState<StudioTab>("calendar");
  const [lastApplied, setLastApplied] = useState<{ idea: CreatorIdea; creator: CreatorStyle } | null>(null);

  const handleCreatorApply = (idea: CreatorIdea, creator: CreatorStyle) => {
    setLastApplied({ idea, creator });
    const copyText = `${idea.title}\n\n${idea.hook}\n\n${idea.caption}\n${idea.hashtags.map((t) => `#${t}`).join(" ")}`;
    navigator.clipboard.writeText(copyText).catch(() => null);
    toast.success(`${creator.emoji} Idea copied to clipboard — paste into your post!`);
  };

  return (
    <MotionPage className="space-y-6">
      {/* ── brand accent top rail ───────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(212,255,0,0.5) 30%, rgba(212,255,0,0.8) 50%, rgba(212,255,0,0.5) 70%, transparent 100%)" }}
      />

      {/* ── Social Studio command strip ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1 truncate">
              Post Studio
            </p>
            <h1 className="text-2xl font-display font-bold text-text-primary truncate">
              Social Studio
            </h1>
          </div>

          {/* Platform indicators */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            {(["IG", "TK", "FB", "YT"] as const).map((p, i) => (
              <span
                key={p}
                className="text-[10px] font-medium w-6 h-6 rounded-full flex items-center justify-center leading-none"
                style={{
                  background: ["#E1306C22","#69C9D022","#1877F222","#FF000022"][i],
                  color: ["#E1306C","#69C9D0","#1877F2","#FF0000"][i],
                  border: `1px solid ${["#E1306C","#69C9D0","#1877F2","#FF0000"][i]}40`,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Quick schedule CTA */}
        <motion.button
          type="button"
          onClick={() => setTab("ai-upload")}
          whileTap={{ scale: 0.97 }}
          className="btn-pill flex items-center gap-1.5 text-xs py-1.5 px-3 shrink-0"
        >
          <Plus size={12} />
          Schedule
        </motion.button>
      </div>

      <div className="tab-pill-strip flex-wrap">
        {TABS.map((t, index) => {
          const active = tab === t.key;
          return (
            <motion.button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.05 }}
              whileTap={{ scale: 0.97 }}
              className={`tab-pill flex items-center gap-2${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={t.description}
            >
              {t.icon}
              <span>{t.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Competitive Intelligence strip */}
      <div className="px-1 mb-2">
        <PageAgent context="social-studio" />
      </div>

      {/* Tab content */}
      {tab === "calendar"   && <Tab1Calendar />}
      {tab === "ai-upload"  && <Tab2AIUpload />}
      {tab === "trends"     && <Tab3Trends />}
      {tab === "stats"      && <Tab4Stats />}
      {tab === "commenters" && <Tab5TopCommenters />}
      {tab === "creator-ideas" && (
        <div className="space-y-4">
          <div className="px-1">
            <p className="text-[11px] text-text-muted">
              Pick a creator archetype, enter your topic, and get 5 platform-ready post ideas generated in that style. Click{" "}
              <span className="text-text-secondary font-medium">Use this idea</span> to copy it to your clipboard.
            </p>
          </div>

          <CreatorIntelligence
            context="social"
            variant="inline"
            platform="instagram"
            onApply={handleCreatorApply}
            className="mx-1"
          />

          {/* Last applied idea display */}
          {lastApplied && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-1 rounded-2xl border p-4 space-y-2"
              style={{
                background: "rgba(13,17,32,0.7)",
                borderColor: "rgba(212,255,0,0.22)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{lastApplied.creator.emoji}</span>
                <span className="text-[11px] font-semibold text-text-primary">
                  {lastApplied.creator.name} style applied
                </span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: lastApplied.creator.primaryColor + "22",
                    color: lastApplied.creator.primaryColor,
                  }}
                >
                  copied
                </span>
              </div>
              <p className="text-xs font-semibold text-text-primary">{lastApplied.idea.title}</p>
              <p className="text-[11px] italic text-text-secondary">
                &ldquo;{lastApplied.idea.hook}&rdquo;
              </p>
              <p className="text-[10px] text-text-muted">{lastApplied.idea.caption}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {lastApplied.idea.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded text-text-secondary bg-white/5"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </MotionPage>
  );
}
