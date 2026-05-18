"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Calendar, Sparkles, Lightbulb, BarChart3, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Tab1Calendar from "./components/Tab1Calendar";
import Tab2AIUpload from "./components/Tab2AIUpload";
import Tab3Trends from "./components/Tab3Trends";
import Tab4Stats from "./components/Tab4Stats";
import Tab5TopCommenters from "./components/Tab5TopCommenters";
import { MotionPage } from "@/components/motion/motion-page";
import PageAgent from "@/components/ui/page-agent";

type StudioTab = "calendar" | "ai-upload" | "trends" | "stats" | "commenters";

interface TabConfig {
  key: StudioTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { key: "calendar",   label: "Calendar",      description: "Plan & lineup",          icon: <Calendar size={14} /> },
  { key: "ai-upload",  label: "AI Auto-Upload", description: "Drag, drop, schedule",   icon: <Sparkles size={14} /> },
  { key: "trends",     label: "Trends & Ideas", description: "Hashtags + ideas",       icon: <Lightbulb size={14} /> },
  { key: "stats",      label: "Stats",          description: "Performance + best times", icon: <BarChart3 size={14} /> },
  { key: "commenters", label: "Top Commenters", description: "Reply with AI",          icon: <Users size={14} /> },
];

export default function SocialStudioPage() {
  useAuth();
  const [tab, setTab] = useState<StudioTab>("calendar");

  return (
    <MotionPage className="space-y-6">{/* -- Social Studio command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">POST STUDIO</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Social Studio</h1>
      </div>
    </div><div className="tab-pill-strip flex-wrap">
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
      {tab === "calendar"   && <Tab1Calendar />}{tab === "ai-upload"  && <Tab2AIUpload />}{tab === "trends"     && <Tab3Trends />}{tab === "stats"      && <Tab4Stats />}{tab === "commenters" && <Tab5TopCommenters />}</MotionPage>
  );
}
