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
import dynamic from "next/dynamic";
import {
  Megaphone,
  BarChart3,
  Target,
  Sparkles,
  PieChart,
  Plug,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

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

export default function AdsManagerPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div className="space-y-6">
      <PageHero
        title="Ads Manager"
        subtitle="One dashboard for Meta, Google, and TikTok ads — with AI-driven budget reallocation."
        icon={<Megaphone size={20} />}
        gradient="gold"
        eyebrow={
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold">
            Cross-platform · AI-optimised
          </span>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/5 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-gold text-gold"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab && (
        <p className="text-xs text-muted -mt-2">{activeTab.description}</p>
      )}

      {/* Tab content */}
      <div>
        {tab === "overview" && <OverviewPanel />}
        {tab === "campaigns" && <CampaignsTable />}
        {tab === "insights" && <InsightsPanel />}
        {tab === "budgets" && <BudgetsPanel />}
        {tab === "connect" && <ZernioConnectPanel />}
      </div>
    </div>
  );
}
