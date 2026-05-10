"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const TrinityPrompt = dynamic(
  () => import("@/components/dashboard/trinity-prompt"),
  { ssr: false }
);

// ── Segment label map ─────────────────────────────────────────────
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  reports: "Reports",
  clients: "Clients",
  leads: "Lead Engine",
  scraper: "Lead Finder",
  outreach: "Outreach",
  "outreach-hub": "Outreach Hub",
  "outreach-logs": "Outreach Logs",
  services: "AI Agents",
  "agent-office": "Agent Office",
  "agent-room": "Agent Room",
  "social-manager": "Social Manager",
  "script-lab": "Script Lab",
  websites: "Websites",
  design: "Design Studio",
  thumbnail: "Thumbnail Generator",
  "thumbnail-generator": "Thumbnail Generator",
  production: "Production",
  content: "Content AI",
  proposals: "Proposals",
  billing: "Billing",
  upgrade: "Upgrade",
  settings: "Settings",
  integrations: "Integrations",
  "integrations-hub": "Integrations Hub",
  automations: "Automations",
  calendar: "Calendar",
  inbox: "Inbox",
  meetings: "Meetings",
  ads: "Ads Manager",
  financials: "Financials",
  portal: "Client Portal",
  community: "Community",
  monitor: "Monitor",
  discord: "Discord",
  whatsapp: "WhatsApp",
  "eleven-agents": "Voice Agents",
  "voice-studio": "Voice Studio",
  "agent-supervisor": "Agent Supervisor",
  admin: "Admin",
  "agent-traces": "Agent Traces",
  pricing: "Pricing",
  "client-health": "Client Health",
  "ai-video": "AI Video Gen",
  "ai-studio": "AI Studio",
  "video-editor": "Video Editor",
  "design-studio": "Design Studio",
  copywriter: "AI Writer",
  "brand-kit": "Brand Kit",
  "social-studio": "Social Studio",
  "content-plan": "Content Plan",
  deals: "Deals",
  "cold-email": "Cold Email",
  "voice-receptionist": "Voice AI",
  "carousel-generator": "Carousel Gen",
};

function segmentLabel(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Breadcrumb builder ─────────────────────────────────────────────
interface Crumb { label: string; href: string }

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const dashIdx = parts.indexOf("dashboard");
  if (dashIdx === -1) return [];
  const segments = parts.slice(dashIdx);
  return segments.map((seg, i) => ({
    label: segmentLabel(seg),
    href: "/" + parts.slice(0, dashIdx + i + 1).join("/"),
  }));
}

// ── Contextual section nav ─────────────────────────────────────────
// When the user is inside a named section, a second row of pills
// shows the sibling pages so they can switch quickly — like how
// Figma / Linear show contextual sub-navigation.
interface ContextItem { label: string; href: string }
interface ContextSection { key: string; label: string; items: ContextItem[] }

const CONTEXT_SECTIONS: ContextSection[] = [
  {
    key: "visual",
    label: "Visual",
    items: [
      { label: "Video Editor", href: "/dashboard/video-editor" },
      { label: "AI Video", href: "/dashboard/ai-video" },
      { label: "Thumbnails", href: "/dashboard/thumbnail-generator" },
      { label: "AI Studio", href: "/dashboard/ai-studio" },
      { label: "Design Studio", href: "/dashboard/design-studio" },
      { label: "Carousel", href: "/dashboard/carousel-generator" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    items: [
      { label: "Outreach", href: "/dashboard/outreach-hub" },
      { label: "Lead Finder", href: "/dashboard/scraper" },
      { label: "Conversations", href: "/dashboard/conversations" },
      { label: "Cold Email", href: "/dashboard/cold-email" },
      { label: "Deals", href: "/dashboard/deals" },
      { label: "Proposals", href: "/dashboard/proposals" },
      { label: "Voice Studio", href: "/dashboard/voice-studio" },
      { label: "Dialer", href: "/dashboard/dialer" },
    ],
  },
  {
    key: "create",
    label: "Create",
    items: [
      { label: "AI Writer", href: "/dashboard/copywriter" },
      { label: "Script Lab", href: "/dashboard/script-lab" },
      { label: "Social Manager", href: "/dashboard/social-manager" },
      { label: "Content Plan", href: "/dashboard/content-plan" },
      { label: "Brand Kit", href: "/dashboard/brand-kit" },
      { label: "Websites", href: "/dashboard/websites" },
      { label: "Intake Forms", href: "/dashboard/intake" },
    ],
  },
  {
    key: "automate",
    label: "Automate",
    items: [
      { label: "AI Agents", href: "/dashboard/services" },
      { label: "Workflows", href: "/dashboard/workflows" },
      { label: "Agent Office", href: "/dashboard/agent-office" },
      { label: "Automations", href: "/dashboard/automations" },
      { label: "Flow Builder", href: "/dashboard/workflow-builder" },
    ],
  },
  {
    key: "manage",
    label: "Manage",
    items: [
      { label: "Clients", href: "/dashboard/clients" },
      { label: "Team", href: "/dashboard/team" },
      { label: "Invoices", href: "/dashboard/invoices" },
      { label: "Financials", href: "/dashboard/financials" },
      { label: "Client Health", href: "/dashboard/client-health" },
      { label: "Reviews", href: "/dashboard/reviews" },
      { label: "Production", href: "/dashboard/production" },
    ],
  },
  {
    key: "connect",
    label: "Connect",
    items: [
      { label: "Integrations", href: "/dashboard/integrations-hub" },
      { label: "Discord", href: "/dashboard/discord" },
      { label: "Google Biz", href: "/dashboard/google-business" },
      { label: "Telegram", href: "/dashboard/telegram-bot" },
      { label: "WhatsApp", href: "/dashboard/whatsapp" },
    ],
  },
];

function getActiveSection(pathname: string): ContextSection | null {
  for (const section of CONTEXT_SECTIONS) {
    const match = section.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    );
    if (match) return section;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────
export default function TopNavbar() {
  const pathname = usePathname() ?? "";
  const crumbs = buildCrumbs(pathname);
  const activeSection = getActiveSection(pathname);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  const shortcutHint = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      {/* ── Row 1: breadcrumbs + Ask Trinity ── */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(var(--bg-base-rgb, 10 10 13) / 0.82)",
          backdropFilter: "blur(20px) saturate(1.15)",
          WebkitBackdropFilter: "blur(20px) saturate(1.15)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Breadcrumb + Trinity row */}
        <div className="flex items-center px-4 lg:px-6 h-10 gap-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 flex-1 min-w-0 text-[12px]"
          >
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight size={11} className="shrink-0 text-text-muted/40" aria-hidden />
                  )}
                  {isLast ? (
                    <span
                      className="font-medium text-text-primary truncate"
                      aria-current="page"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-text-muted hover:text-text-primary transition-colors duration-150 truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>

          {/* Trinity quick-prompt button */}
          <button
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  ctrlKey: true,
                  metaKey: false,
                  bubbles: true,
                })
              );
            }}
            className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/50"
            style={{
              background: "rgba(37,99,235,0.07)",
              borderColor: "rgba(37,99,235,0.20)",
              color: "#2563EB",
            }}
            title="Open Trinity quick prompt"
          >
            <Sparkles size={11} />
            <span className="hidden sm:inline">Ask Trinity</span>
            <span
              className="text-[9px] font-mono opacity-60 border rounded px-1 hidden md:inline"
              style={{ borderColor: "rgba(255,45,45,0.25)" }}
            >
              {shortcutHint}
            </span>
          </button>
        </div>

        {/* ── Row 2: contextual section pills (only when in a section) ── */}
        {activeSection && (
          <div
            className="flex items-center gap-1 px-4 lg:px-6 pb-2 overflow-x-auto scrollbar-none"
            role="navigation"
            aria-label={`${activeSection.label} section pages`}
          >
            {/* Section label chip */}
            <span
              className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] px-2 py-[3px] rounded-full border mr-1"
              style={{
                color: "rgba(255,255,255,0.35)",
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {activeSection.label}
            </span>

            {activeSection.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 text-[11px] font-medium px-2.5 py-[3px] rounded-full border transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? "text-brand-accent border-brand-accent/30 bg-brand-accent/10"
                      : "text-text-muted border-transparent hover:text-text-primary hover:border-border-subtle hover:bg-white/[0.03]"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="ml-1.5 inline-block w-1 h-1 rounded-full bg-brand-accent"
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <TrinityPrompt />
    </>
  );
}
