"use client";

/**
 * Unified Ads Manager — single dashboard for Meta + Google + TikTok ads.
 *
 * The page is intentionally thin: it owns the tab state and delegates each
 * tab's rendering to a dedicated `_components/*` panel that talks directly
 * to /api/ads-manager/*. This keeps the page file under the 800-line cap
 * from coding-style.md and makes each tab independently testable.
 *
 * Tabs:
 *   1. Overview  — aggregate KPIs, per-platform tiles, 30d spend chart, top 5
 *   2. Campaigns — filterable/sortable cross-platform campaign list
 *   3. Insights  — Claude-generated optimisation suggestions + per-platform charts
 *   4. Budgets   — current vs AI-suggested allocation with one-click rebalance
 *   5. Connect   — Zernio-hosted OAuth flow for connecting new ad accounts
 *
 * Sidebar entry already lives in src/components/sidebar.tsx ("Ads Manager").
 */

import { useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Megaphone,
  BarChart3,
  Target,
  Sparkles,
  PieChart,
  Plug,
  Plus,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";
import PageTrainingPanel from "@/components/ui/page-training-panel";

// Code-split the panels — only the active tab loads. Each panel has its
// own data fetching, so this also avoids waterfall fetches at page load.
const OverviewPanel = dynamic(() => import("./_components/OverviewPanel"), {
  ssr: false,
});
const CampaignsTable = dynamic(() => import("./_components/CampaignsTable"), {
  ssr: false,
});
const InsightsPanel = dynamic(() => import("./_components/InsightsPanel"), {
  ssr: false,
});
const BudgetsPanel = dynamic(() => import("./_components/BudgetsPanel"), {
  ssr: false,
});
const ZernioConnectPanel = dynamic(
  () => import("@/components/ads-manager/zernio-connect-panel"),
  { ssr: false },
);

type Tab = "overview" | "campaigns" | "insights" | "budgets" | "connect";

const TABS: Array<{
  id: Tab;
  label: string;
  icon: typeof Megaphone;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    description: "Aggregate metrics across Meta + Google + TikTok",
  },
  {
    id: "campaigns",
    label: "Campaigns",
    icon: Target,
    description: "Pause, resume, and edit budgets across platforms",
  },
  {
    id: "insights",
    label: "Insights",
    icon: Sparkles,
    description: "AI-generated optimization suggestions",
  },
  {
    id: "budgets",
    label: "Budgets",
    icon: PieChart,
    description: "Per-platform allocation + AI rebalance",
  },
  {
    id: "connect",
    label: "Connect",
    icon: Plug,
    description: "Connect new ad accounts via Zernio",
  },
];

/** Platform indicator pills — shown in the command strip */
const PLATFORMS = [
  { label: "Meta",   color: "#1877F2" },
  { label: "Google", color: "#4285F4" },
  { label: "TikTok", color: "#69C9D0" },
] as const;

export default function AdsManagerPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <MotionPage className="space-y-6">
      {/* ── brand accent top rail ───────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(212,255,0,0.5) 30%, rgba(212,255,0,0.8) 50%, rgba(212,255,0,0.5) 70%, transparent 100%)" }}
      />

      {/* ── Ads Manager command strip ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">
              Paid Media
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
              Ads Manager
            </h1>
          </div>

          {/* Platform badges */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            {PLATFORMS.map((p) => (
              <span
                key={p.label}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: p.color + "22", color: p.color, border: `1px solid ${p.color}40` }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Connect CTA — navigates to the Connect tab */}
        <motion.button
          type="button"
          onClick={() => setTab("connect")}
          whileTap={{ scale: 0.97 }}
          className="btn-pill-ghost flex items-center gap-1.5 text-xs py-1.5 px-3 shrink-0"
        >
          <Plus size={12} />
          Connect
        </motion.button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="tab-pill-strip flex-wrap">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const isActive = t.id === tab;
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.05 }}
              whileTap={{ scale: 0.97 }}
              className={`tab-pill flex items-center gap-2${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              title={t.description}
            >
              <Icon size={14} />
              {t.label}
            </motion.button>
          );
        })}
      </div>

      {activeTab && (
        <p className="text-xs text-text-muted -mt-2 px-1">{activeTab.description}</p>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {tab === "overview"   && <OverviewPanel />}
        {tab === "campaigns"  && <CampaignsTable />}
        {tab === "insights"   && <InsightsPanel />}
        {tab === "budgets"    && <BudgetsPanel />}
        {tab === "connect"    && <ZernioConnectPanel />}
      </motion.div>

      <PageTrainingPanel pageKey="ads" pageLabel="Ads Manager" />
    </MotionPage>
  );
}
