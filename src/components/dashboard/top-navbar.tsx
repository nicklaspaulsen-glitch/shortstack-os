"use client";

/**
 * TopNavbar — sticky breadcrumb bar + Trinity Cmd+K button.
 *
 * Rendered at the top of the main content area (below the existing
 * header chrome). Shows:
 *   - Breadcrumbs derived from the current pathname
 *   - A Trinity quick-prompt button (Cmd+K shortcut hint)
 *
 * Height: h-14. Sticky at top-0 with z-30 so it stays below modals
 * but above page content.
 */

import { usePathname } from "next/navigation";
import { Sparkles, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load the modal — it's only rendered when needed
const TrinityPrompt = dynamic(
  () => import("@/components/dashboard/trinity-prompt"),
  { ssr: false }
);

// ── Segment label map ─────────────────────────────────────────────
// Converts raw URL segments into human-readable breadcrumb labels.
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
  workflows: "Workflows",
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
};

function segmentLabel(segment: string): string {
  // Check the map first; fall back to a title-cased version of the slug
  return (
    SEGMENT_LABELS[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Breadcrumb builder ─────────────────────────────────────────────
interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  // Start from "dashboard" — skip any prefix before it
  const dashIdx = parts.indexOf("dashboard");
  if (dashIdx === -1) return [];

  const segments = parts.slice(dashIdx);
  return segments.map((seg, i) => ({
    label: segmentLabel(seg),
    href: "/" + parts.slice(0, dashIdx + i + 1).join("/"),
  }));
}

// ── Component ─────────────────────────────────────────────────────

export default function TopNavbar() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname ?? "");

  // Determine OS for shortcut hint
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  const shortcutHint = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      <div
        className="h-14 sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm flex items-center px-4 lg:px-6 gap-2"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 flex-1 min-w-0 text-sm"
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <ChevronRight
                    size={13}
                    className="shrink-0 text-muted/50"
                    aria-hidden
                  />
                )}
                {isLast ? (
                  <span
                    className="font-medium truncate"
                    style={{ color: "#F5F4F1" }}
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <a
                    href={crumb.href}
                    className="text-muted hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </a>
                )}
              </span>
            );
          })}
        </nav>

        {/* Trinity quick-prompt button */}
        <button
          onClick={() => {
            // Dispatch a synthetic Ctrl+K event to open TrinityPrompt
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                ctrlKey: true,
                metaKey: false,
                bubbles: true,
              })
            );
          }}
          className="shrink-0 flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: "rgba(255,255,255,0.07)",
            borderColor: "rgba(255,255,255,0.15)",
            color: "#FF2D2D",
          }}
          title="Open Trinity quick prompt"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">Ask Trinity</span>
          <span
            className="text-[10px] font-mono opacity-70 border rounded px-1"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            {shortcutHint}
          </span>
        </button>
      </div>

      {/* Modal rendered here so it's portaled into the right layer */}
      <TrinityPrompt />
    </>
  );
}
