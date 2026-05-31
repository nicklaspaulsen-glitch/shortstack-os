"use client";

/**
 * /dashboard/agentstack — AgentStack Control Plane
 *
 * Central workflow hub giving access to every part of ShortStack OS
 * from a single page. Five tabs:
 *
 *   Overview      — Quick-launch matrix + system status
 *   ShortStack OS — Full navigable map of every feature
 *   Agents        — Agent Command, Agent Office, traces, voice
 *   Automations   — Workflow library, browser tasks, content plan
 *   Integrations  — Connected OAuth providers and API keys
 */

import {
  ArrowSquareOut,
  ChartBar,
  FilmStrip,
  Gear,
  Globe,
  Image,
  Lightning,
  Plug,
  Receipt,
  Robot,
  ShareNetwork,
  Sparkle,
  SquaresFour,
  Stack,
  Target,
  Users,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "overview" | "shortstack" | "agents" | "automations" | "integrations";

interface NavTab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface SectionGroup {
  section: string;
  tiles: FeatureTile[];
}

interface FeatureTile {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

interface HubTile {
  label: string;
  description: string;
  href: string;
  badge: string | null;
}

// ── Navigation tabs ────────────────────────────────────────────────────────

const TABS: NavTab[] = [
  { id: "overview",      label: "Overview",      icon: <SquaresFour size={13} /> },
  { id: "shortstack",   label: "ShortStack OS", icon: <Stack        size={13} /> },
  { id: "agents",       label: "Agents",         icon: <Robot        size={13} /> },
  { id: "automations",  label: "Automations",    icon: <Lightning    size={13} /> },
  { id: "integrations", label: "Integrations",   icon: <Plug         size={13} /> },
];

// ── OS feature map (ShortStack OS tab) ────────────────────────────────────

const OS_SECTIONS: SectionGroup[] = [
  {
    section: "Core",
    tiles: [
      { label: "Dashboard",  description: "Home overview and quick stats",       href: "/dashboard",           icon: <SquaresFour size={16} /> },
      { label: "Clients",    description: "Client list, onboarding, and portal", href: "/dashboard/clients",   icon: <Users       size={16} /> },
      { label: "Analytics",  description: "Revenue, outreach, and lead metrics", href: "/dashboard/analytics", icon: <ChartBar    size={16} /> },
    ],
  },
  {
    section: "Create",
    tiles: [
      { label: "AI Video",    description: "Fal.ai short-form video generation", href: "/dashboard/ai-video",            icon: <FilmStrip size={16} /> },
      { label: "Thumbnails",  description: "AI-powered thumbnail generator",     href: "/dashboard/thumbnail-generator", icon: <Image     size={16} /> },
      { label: "AI Studio",   description: "Multi-modal AI workspace",           href: "/dashboard/ai-studio",           icon: <Sparkle   size={16} /> },
    ],
  },
  {
    section: "Reach",
    tiles: [
      { label: "Social",    description: "Schedule and publish to all accounts", href: "/dashboard/social-manager", icon: <ShareNetwork size={16} /> },
      { label: "Websites",  description: "Build and manage client websites",    href: "/dashboard/websites",       icon: <Globe        size={16} /> },
    ],
  },
  {
    section: "Revenue",
    tiles: [
      { label: "Ads",      description: "Google and Meta campaign management",  href: "/dashboard/ads-manager", icon: <Target  size={16} /> },
      { label: "CRM",      description: "Pipeline, contacts, and deals",        href: "/dashboard/crm",         icon: <Users   size={16} /> },
      { label: "Invoices", description: "Send invoices and track payments",     href: "/dashboard/invoices",    icon: <Receipt size={16} /> },
    ],
  },
  {
    section: "Operate",
    tiles: [
      { label: "Agent Office",   description: "Realtime pixel-art agent view",   href: "/dashboard/agent-office",    icon: <UsersThree size={16} /> },
      { label: "Agent Command",  description: "Autonomous loop control centre",  href: "/dashboard/agent-command",   icon: <Robot      size={16} /> },
      { label: "Integrations",   description: "OAuth and API key connections",   href: "/dashboard/integrations-hub",icon: <Plug       size={16} /> },
      { label: "Settings",       description: "Billing, team, and configuration",href: "/dashboard/settings",        icon: <Gear       size={16} /> },
    ],
  },
];

// ── Quick-launch tiles (Overview tab) ──────────────────────────────────────

const QUICK_LAUNCH: FeatureTile[] = [
  { label: "Agent Command",  description: "Start and monitor the autonomous loop",  href: "/dashboard/agent-command",  icon: <Robot       size={18} /> },
  { label: "Analytics",      description: "Revenue and performance at a glance",    href: "/dashboard/analytics",      icon: <ChartBar    size={18} /> },
  { label: "Clients",        description: "Manage clients and send proposals",      href: "/dashboard/clients",        icon: <Users       size={18} /> },
  { label: "AI Video",       description: "Generate and publish short-form video",  href: "/dashboard/ai-video",       icon: <FilmStrip   size={18} /> },
  { label: "Social",         description: "Schedule posts across all channels",     href: "/dashboard/social-manager", icon: <ShareNetwork size={18} /> },
  { label: "Automations",    description: "12 production automation templates",     href: "/dashboard/automations",    icon: <Lightning   size={18} /> },
];

// ── Hub tiles (Agents tab) ─────────────────────────────────────────────────

const AGENT_TILES: HubTile[] = [
  { label: "Agent Command",  description: "Autonomous loop — configure run cadence, max leads, auto-publish, and Telegram alerts", href: "/dashboard/agent-command",      badge: "Live"   },
  { label: "Agent Office",   description: "Realtime pixel-art map of every agent's current task and recent activity",             href: "/dashboard/agent-office",       badge: null     },
  { label: "Agent Traces",   description: "Langfuse trace log — latency, tokens, and cost for every LLM call in the system",     href: "/dashboard/admin/agent-traces", badge: null     },
  { label: "Voice Studio",   description: "Voice clone presets that power dialer calls, voicemail drops, and SMS voice notes",   href: "/dashboard/voice-studio",       badge: null     },
];

// ── Hub tiles (Automations tab) ────────────────────────────────────────────

const AUTOMATION_TILES: HubTile[] = [
  { label: "Workflow Library",  description: "12 production-ready automation templates — install in one click and run immediately",  href: "/dashboard/automations/library",       badge: "12 ready" },
  { label: "Automations",       description: "Build custom multi-step workflows with triggers, conditions, and action chains",       href: "/dashboard/automations",               badge: null       },
  { label: "Browser Tasks",     description: "Autonomous browser agent — scrape sites, fill forms, and navigate on your behalf",   href: "/dashboard/automations/browser-tasks", badge: null       },
  { label: "Content Plan",      description: "AI-generated content calendar with topic briefs and scheduled publishing queue",      href: "/dashboard/content-plan",              badge: null       },
];

// ── Hub tiles (Integrations tab) ───────────────────────────────────────────

const INTEGRATION_TILES: HubTile[] = [
  { label: "Integrations Hub",  description: "Connect Google, Meta, HubSpot, Stripe, and 20+ providers via Nango OAuth",  href: "/dashboard/integrations-hub",  badge: null },
  { label: "Social Accounts",   description: "Meta, TikTok, and LinkedIn OAuth managed through the Zernio social layer",  href: "/dashboard/integrations",      badge: null },
  { label: "API Keys",          description: "Manage secret keys for Anthropic, ElevenLabs, RunPod, and third-party APIs",href: "/dashboard/settings/api-keys", badge: null },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function cardAnim(index: number) {
  return {
    initial:    { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    transition: { delay: index * 0.04, duration: 0.22 },
  } as const;
}

// ── Shared components ──────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold mb-2.5">
      {label}
    </h3>
  );
}

function FeatureCard({ tile, index }: { tile: FeatureTile; index: number }) {
  return (
    <motion.div {...cardAnim(index)}>
      <Link
        href={tile.href}
        className="group flex items-start gap-3 p-3 rounded-xl border border-border-subtle bg-[rgba(13,17,32,0.6)] hover:border-[rgba(212,255,0,0.2)] hover:bg-[rgba(13,17,32,0.85)] transition-all duration-[220ms]"
      >
        <span className="mt-0.5 text-text-muted group-hover:text-brand-accent transition-colors duration-[220ms] shrink-0">
          {tile.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary group-hover:text-brand-accent transition-colors duration-[220ms] leading-tight">
            {tile.label}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{tile.description}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function HubCard({ tile, index }: { tile: HubTile; index: number }) {
  return (
    <motion.div {...cardAnim(index)}>
      <Link
        href={tile.href}
        className="group flex flex-col gap-2 p-4 rounded-xl border border-border-subtle bg-[rgba(13,17,32,0.6)] hover:border-[rgba(212,255,0,0.2)] hover:bg-[rgba(13,17,32,0.85)] transition-all duration-[220ms] h-full"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary group-hover:text-brand-accent transition-colors duration-[220ms]">
            {tile.label}
          </p>
          {tile.badge !== null && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.18)] text-brand-accent whitespace-nowrap">
              {tile.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-muted leading-snug flex-1">{tile.description}</p>
        <div className="flex items-center gap-1 text-[10px] text-text-muted group-hover:text-brand-accent transition-colors duration-[220ms]">
          <ArrowSquareOut size={10} />
          <span>Open</span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Tab content ────────────────────────────────────────────────────────────

function OverviewTab() {
  const STATUS_ITEMS = [
    { label: "ShortStack OS",  sub: "Next.js 14 + Supabase + Vercel",          href: "https://app.shortstack.work", live: true  },
    { label: "Agent Loop",     sub: "Autonomous task + content pipeline",       href: "/dashboard/agent-command",    live: false },
    { label: "Integrations",   sub: "OAuth providers and API connections",      href: "/dashboard/integrations-hub", live: false },
  ];

  return (
    <div className="space-y-7">
      <div>
        <SectionLabel label="Quick Launch" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {QUICK_LAUNCH.map((tile, i) => (
            <FeatureCard key={tile.href} tile={tile} index={i} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel label="System" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {STATUS_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              {...cardAnim(i + QUICK_LAUNCH.length)}
            >
              <Link
                href={item.href}
                className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-[rgba(13,17,32,0.6)] hover:border-[rgba(212,255,0,0.2)] hover:bg-[rgba(13,17,32,0.85)] transition-all duration-[220ms]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{item.label}</p>
                  <p className="text-[11px] text-text-muted truncate">{item.sub}</p>
                </div>
                {item.live ? (
                  <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.18)] text-brand-accent">
                    <span className="w-1 h-1 rounded-full bg-brand-accent animate-pulse" />
                    Live
                  </span>
                ) : (
                  <ArrowSquareOut
                    size={12}
                    className="text-text-muted shrink-0 group-hover:text-brand-accent transition-colors duration-[220ms]"
                  />
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortStackTab() {
  let tileIdx = 0;
  return (
    <div className="space-y-6">
      {OS_SECTIONS.map(({ section, tiles }) => (
        <div key={section}>
          <SectionLabel label={section} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tiles.map(tile => {
              const idx = tileIdx++;
              return <FeatureCard key={tile.href} tile={tile} index={idx} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentsTab() {
  return (
    <div>
      <SectionLabel label="Agent Tools" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AGENT_TILES.map((tile, i) => (
          <HubCard key={tile.href} tile={tile} index={i} />
        ))}
      </div>
    </div>
  );
}

function AutomationsTab() {
  return (
    <div>
      <SectionLabel label="Automation Suite" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AUTOMATION_TILES.map((tile, i) => (
          <HubCard key={tile.href} tile={tile} index={i} />
        ))}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div>
      <SectionLabel label="Connected Tools" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INTEGRATION_TILES.map((tile, i) => (
          <HubCard key={tile.href} tile={tile} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AgentStackPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  function renderTab() {
    switch (activeTab) {
      case "overview":      return <OverviewTab />;
      case "shortstack":   return <ShortStackTab />;
      case "agents":        return <AgentsTab />;
      case "automations":   return <AutomationsTab />;
      case "integrations":  return <IntegrationsTab />;
    }
  }

  return (
    <MotionPage className="space-y-5">

      {/* ── Editorial header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1 truncate">
            your control plane
          </p>
          <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2 truncate">
            <Stack size={22} weight="fill" className="text-brand-accent shrink-0" />
            AgentStack
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Every part of your workflow, one place
          </p>
        </div>

        <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.18)] text-brand-accent shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
          Online
        </span>
      </div>

      {/* ── Tab strip ──────────────────────────────────────────────────── */}
      <div className="tab-pill-strip overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`tab-pill flex items-center gap-1.5 whitespace-nowrap${activeTab === tab.id ? " active" : ""}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {renderTab()}
      </motion.div>

    </MotionPage>
  );
}
