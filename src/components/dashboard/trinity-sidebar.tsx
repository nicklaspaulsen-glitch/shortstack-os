"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  BarChart3,
  X,
  Settings,
  Briefcase,
  Send,
  Target,
  FileCheck,
  Pen,
  Sparkles,
  Globe,
  Share2,
  Calendar,
  Mic,
  Film,
  Image,
  UsersRound,
  Zap,
  RotateCcw,
  Brain,
  GitBranch,
  Plug,
  MessageSquare,
  Phone,
  Receipt,
  DollarSign,
  Search,
  Layers,
  CreditCard,
  Bot,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  count?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface TrinitySidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

// ─── Navigation data ────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Clients",
    items: [
      { label: "Clients", href: "/dashboard/clients", icon: Users },
      { label: "CRM", href: "/dashboard/crm", icon: Briefcase },
      { label: "Leads", href: "/dashboard/leads", icon: Target },
      { label: "Proposals", href: "/dashboard/proposals", icon: FileCheck },
      { label: "Outreach Hub", href: "/dashboard/outreach-hub", icon: Send },
      { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
      { label: "Trinity AI", href: "/dashboard/trinity", icon: Brain },
    ],
  },
  {
    label: "AI & Create",
    items: [
      { label: "AI Studio", href: "/dashboard/ai-studio", icon: Sparkles, badge: "HOT" },
      { label: "AI Video", href: "/dashboard/ai-video", icon: Film, badge: "NEW" },
      { label: "Voice Studio", href: "/dashboard/voice-studio", icon: Mic },
      { label: "Agent Office", href: "/dashboard/agent-office", icon: UsersRound },
      { label: "AI Caller", href: "/dashboard/eleven-agents", icon: Phone },
      { label: "Copywriter", href: "/dashboard/copywriter", icon: Pen },
      { label: "Social Studio", href: "/dashboard/social-studio", icon: Share2 },
      { label: "Websites", href: "/dashboard/websites", icon: Globe },
      { label: "Thumbnails", href: "/dashboard/thumbnail-generator", icon: Image },
      { label: "Video Editor", href: "/dashboard/video-editor", icon: Film },
      { label: "AI Agents", href: "/dashboard/services", icon: Bot },
    ],
  },
  {
    label: "Automate",
    items: [
      { label: "Workflows", href: "/dashboard/workflows", icon: Zap },
      { label: "Automations", href: "/dashboard/automations", icon: RotateCcw },
      { label: "Flow Builder", href: "/dashboard/workflow-builder", icon: GitBranch },
      { label: "Dialer", href: "/dashboard/dialer", icon: Phone },
      { label: "Lead Finder", href: "/dashboard/scraper", icon: Search },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Integrations", href: "/dashboard/integrations-hub", icon: Plug },
      { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare },
      { label: "Telegram", href: "/dashboard/telegram-bot", icon: MessageSquare },
      { label: "Discord", href: "/dashboard/discord", icon: MessageSquare },
      { label: "Google Business", href: "/dashboard/google-business", icon: Globe },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
      { label: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      { label: "Financials", href: "/dashboard/financials", icon: DollarSign },
      { label: "Team", href: "/dashboard/team", icon: UsersRound },
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

// ─── Badge ───────────────────────────────────────────────────────────────────

function ItemBadge({ text }: { text: string }) {
  const isHot = text === "HOT"
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "1px 5px",
        borderRadius: 4,
        background: isHot ? "rgba(239,68,68,0.12)" : "rgba(212,255,0,0.12)",
        color: isHot ? "#F87171" : "#60A5FA",
        border: `1px solid ${isHot ? "rgba(239,68,68,0.20)" : "rgba(212,255,0,0.20)"}`,
        marginLeft: "auto",
        flexShrink: 0,
      }}
    >
      {text}
    </span>
  )
}

// ─── Single nav item ─────────────────────────────────────────────────────────

function NavItem({
  item,
  active,
}: {
  item: NavItem
  active: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px 7px 13px",
        borderRadius: 7,
        background: active
          ? "rgba(212,255,0,0.10)"
          : hovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        color: active ? "#E8EDF5" : hovered ? "#C4CDD8" : "#7A8499",
        textDecoration: "none",
        transition: "background 120ms ease, color 120ms ease",
        position: "relative",
        marginBottom: 1,
      }}
    >
      {/* Active left indicator */}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 16,
            borderRadius: "0 2px 2px 0",
            background: "#D4FF00",
          }}
        />
      )}
      <item.icon
        size={14}
        style={{
          color: active ? "#D4FF00" : hovered ? "#93A3B8" : "inherit",
          flexShrink: 0,
          transition: "color 120ms ease",
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {item.label}
      </span>
      {item.badge && <ItemBadge text={item.badge} />}
      {item.count != null && item.count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 5px",
            borderRadius: 10,
            background: "rgba(212,255,0,0.15)",
            color: "#60A5FA",
            marginLeft: "auto",
          }}
        >
          {item.count}
        </span>
      )}
    </Link>
  )
}

// ─── Sidebar body (shared by desktop + mobile drawer) ────────────────────────

function SidebarBody({ pathname }: { pathname: string }) {
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Brand header ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: "18px 14px 14px",
          borderBottom: "1px solid var(--sidebar-border)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(212,255,0,0.14)",
              border: "1px solid rgba(212,255,0,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Layers size={16} style={{ color: "#D4FF00" }} />
          </div>

          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#E8EDF5",
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              ShortStack OS
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "#3D4858",
                lineHeight: 1.1,
                fontWeight: 500,
              }}
            >
              Agency Operating System
            </div>
          </div>
        </Link>
      </div>

      {/* ── Nav groups ────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 7px 16px",
          scrollbarWidth: "none",
        }}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {/* Section label */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "#2D3748",
                padding: "14px 6px 4px",
              }}
            >
              {group.label}
            </div>

            {/* Items */}
            {group.items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </div>
        ))}

        {/* Bottom spacer */}
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}

// ─── Root component ──────────────────────────────────────────────────────────

export default function TrinitySidebar({
  mobileOpen = false,
  onMobileClose,
}: TrinitySidebarProps) {
  const pathname = usePathname() ?? ""

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:block"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 220,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          zIndex: 40,
          overflow: "hidden",
        }}
      >
        <SidebarBody pathname={pathname} />
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          {/* Backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onMobileClose}
          />

          {/* Drawer panel */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 240,
              background: "var(--sidebar-bg)",
              borderRight: "1px solid var(--sidebar-border)",
              overflow: "hidden",
            }}
          >
            {/* Close button */}
            <button
              onClick={onMobileClose}
              style={{
                position: "absolute",
                top: 14,
                right: 12,
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid var(--sidebar-border)",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B7280",
                zIndex: 2,
              }}
              aria-label="Close navigation"
            >
              <X size={14} />
            </button>

            <SidebarBody pathname={pathname} />
          </div>
        </div>
      )}
    </>
  )
}
