"use client";

import { useState } from "react";
import { Megaphone, Calendar, Sparkles, Lightbulb, BarChart3, Users } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { useAuth } from "@/lib/auth-context";
import Tab1Calendar from "./components/Tab1Calendar";
import Tab2AIUpload from "./components/Tab2AIUpload";
import Tab3Trends from "./components/Tab3Trends";
import Tab4Stats from "./components/Tab4Stats";
import Tab5TopCommenters from "./components/Tab5TopCommenters";

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
    <div className="space-y-6">
      <PageHero
        title="Social Studio"
        subtitle="Plan, post, and grow across every platform"
        gradient="ocean"
        icon={<Megaphone size={20} />}
        eyebrow="MVP"
      />

      <div className="rounded-xl border border-border/40 bg-surface p-1 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[140px] px-3 py-2 rounded-md text-xs font-medium inline-flex items-center justify-center gap-2 transition-all ${
                active
                  ? "bg-gold/15 border border-gold/40 text-gold shadow-inner"
                  : "border border-transparent text-muted hover:text-foreground hover:bg-elevated"
              }`}
              aria-pressed={active}
              title={t.description}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "calendar"   && <Tab1Calendar />}
      {tab === "ai-upload"  && <Tab2AIUpload />}
      {tab === "trends"     && <Tab3Trends />}
      {tab === "stats"      && <Tab4Stats />}
      {tab === "commenters" && <Tab5TopCommenters />}
    </div>
  );
}
