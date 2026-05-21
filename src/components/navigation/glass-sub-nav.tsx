"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// ── Sub-nav config ──────────────────────────────────────────────────

interface SubNavConfig {
  crumb: string;
  tabs: string[];
  chips: string[];
}

const SUBNAV_CONFIG: Record<string, SubNavConfig> = {
  "/dashboard": {
    crumb: "Studio · Home",
    tabs: ["Today", "This week", "This month"],
    chips: ["Sync now", "Daily review"],
  },
  "/dashboard/ai-studio": {
    crumb: "Studio · Home",
    tabs: ["Today", "This week", "This month"],
    chips: ["Sync now", "Daily review"],
  },
  "/dashboard/thumbnail": {
    crumb: "Create · Thumbnails",
    tabs: ["Recent", "Generated", "A/B tests"],
    chips: ["Filter", "Sort: CTR"],
  },
  "/dashboard/ai-video": {
    crumb: "Create · Video Studio",
    tabs: ["Briefs", "Takes", "Rendering", "Done"],
    chips: ["Filter", "Sort: newest"],
  },
  "/dashboard/video-editor": {
    crumb: "Create · Editor",
    tabs: ["Timeline", "Captions", "Music", "Color"],
    chips: ["Autosave on", "Snap"],
  },
  "/dashboard/social-studio": {
    crumb: "Distribute · Social",
    tabs: ["Calendar", "Queue", "Accounts", "Pages"],
    chips: ["This week", "Filter"],
  },
  "/dashboard/analytics": {
    crumb: "Distribute · Analytics",
    tabs: ["Overview", "Videos", "Audience", "Revenue"],
    chips: ["Last 28d", "Compare"],
  },
  "/dashboard/media-library": {
    crumb: "Distribute · Library",
    tabs: ["Videos", "Thumbnails", "Music", "Stock"],
    chips: ["Sort: recent", "Upload"],
  },
  "/dashboard/conversations": {
    crumb: "Distribute · Comments",
    tabs: ["All", "YouTube", "TikTok", "Instagram"],
    chips: ["Unread only", "Mentions"],
  },
  "/dashboard/brand-kit": {
    crumb: "System · Brand Kit",
    tabs: ["Logos", "Palette", "Typography", "Intros"],
    chips: ["Locked"],
  },
  "/dashboard/automations": {
    crumb: "System · Automations",
    tabs: ["Active", "Paused", "All runs", "Templates"],
    chips: ["Filter"],
  },
  "/dashboard/settings": {
    crumb: "System · Settings",
    tabs: ["General", "Accounts", "AI models", "Billing"],
    chips: ["Save"],
  },
  "/dashboard/clients": {
    crumb: "System · Clients",
    tabs: ["All", "Active", "Paused", "Archived"],
    chips: ["Filter", "Sort: recent"],
  },
  "/dashboard/crm": {
    crumb: "System · CRM",
    tabs: ["Leads", "Pipeline", "Deals", "Tasks"],
    chips: ["Filter", "This month"],
  },
  "/dashboard/outreach-hub": {
    crumb: "System · Outreach",
    tabs: ["Sequences", "Inbox", "Templates", "Reports"],
    chips: ["Filter", "Active only"],
  },
  "/dashboard/websites": {
    crumb: "Create · Websites",
    tabs: ["Sites", "Templates", "Domains", "Drafts"],
    chips: ["Filter", "Sort: newest"],
  },
};

function getSubNavConfig(pathname: string): SubNavConfig | null {
  if (SUBNAV_CONFIG[pathname]) return SUBNAV_CONFIG[pathname];
  // Prefix match — longest key wins
  let best: SubNavConfig | null = null;
  let bestLen = 0;
  for (const [key, val] of Object.entries(SUBNAV_CONFIG)) {
    if (pathname.startsWith(key + "/") && key.length > bestLen) {
      best = val;
      bestLen = key.length;
    }
  }
  return best;
}

// ── Component ───────────────────────────────────────────────────────

export default function GlassSubNav() {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "";
  const [activeTab, setActiveTab] = useState(0);

  // Reset tab to 0 on every route change
  useEffect(() => { setActiveTab(0); }, [pathname]);

  const config = getSubNavConfig(pathname);
  if (!config) return null;

  const crumbParts = config.crumb.split(" · ");

  return (
    <div className="glass-sub-nav" role="navigation" aria-label="Page navigation">
      {/* Breadcrumb */}
      <nav className="gsn-breadcrumb" aria-label="Breadcrumb">
        {crumbParts.map((part, i) => (
          <span key={i} className="gsn-crumb-group">
            {i > 0 && (
              <ChevronRight
                size={9}
                strokeWidth={2.5}
                className="gsn-crumb-sep"
                aria-hidden="true"
              />
            )}
            <span
              className={
                i === crumbParts.length - 1
                  ? "gsn-crumb-active"
                  : "gsn-crumb-parent"
              }
            >
              {part}
            </span>
          </span>
        ))}
      </nav>

      {/* Tab strip */}
      <div className="gsn-tabs" role="tablist" aria-label="View">
        {config.tabs.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={i === activeTab}
            onClick={() => setActiveTab(i)}
            className={`gsn-tab${i === activeTab ? " gsn-tab-active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="gsn-chips" aria-label="Filters">
        {config.chips.map((chip) => (
          <span key={chip} className="gsn-chip">
            <span className="gsn-chip-dot" aria-hidden="true" />
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
