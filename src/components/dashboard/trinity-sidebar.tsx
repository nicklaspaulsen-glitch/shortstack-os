"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ChevronDown,
  Menu,
  X,
  Settings,
  Bell,
  Search,
  // Sales / clients
  Briefcase,
  TrendingUp,
  Send,
  Target,
  CreditCard,
  FileCheck,
  // Create
  Pen,
  Sparkles,
  Palette,
  Globe,
  Share2,
  ClipboardList,
  Calendar,
  // AI / Visual
  Mic,
  Film,
  Image,
  Bot,
  UsersRound,
  // Automate
  Zap,
  RotateCcw,
  Brain,
  GitBranch,
  // Connect
  Plug,
  MessageSquare,
  Phone,
  // Manage
  Receipt,
  DollarSign,
} from "lucide-react"
import BrainLogo from "@/components/brand/brain-logo"

// ─── Nav group type ───────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

interface NavGroup {
  label: string
  href?: string
  items: NavItem[]
}

// ─── Navigation structure ─────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Clients",
    href: "/dashboard/clients",
    items: [
      { label: "Clients", href: "/dashboard/clients", icon: Users },
      { label: "CRM", href: "/dashboard/crm", icon: Briefcase },
      { label: "Leads", href: "/dashboard/leads", icon: Target },
      { label: "Deals", href: "/dashboard/deals", icon: CreditCard },
      { label: "Proposals", href: "/dashboard/proposals", icon: FileCheck },
      { label: "Outreach Hub", href: "/dashboard/outreach-hub", icon: Send },
      { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
      { label: "Inbox", href: "/dashboard/inbox", icon: MessageSquare },
      { label: "Trinity", href: "/dashboard/trinity", icon: Brain },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "AI Copywriter", href: "/dashboard/copywriter", icon: Pen },
      { label: "Script Lab", href: "/dashboard/script-lab", icon: Sparkles },
      { label: "Social Manager", href: "/dashboard/social-manager", icon: Share2 },
      { label: "Content Plan", href: "/dashboard/content-plan", icon: Calendar },
      { label: "Brand Kit", href: "/dashboard/brand-kit", icon: Palette },
      { label: "Websites", href: "/dashboard/websites", icon: Globe },
      { label: "Landing Pages", href: "/dashboard/landing-pages", icon: LayoutDashboard },
      { label: "Intake Forms", href: "/dashboard/intake", icon: ClipboardList },
      { label: "Social Studio", href: "/dashboard/social-studio", icon: Sparkles },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "AI Studio", href: "/dashboard/ai-studio", icon: Sparkles, badge: "HOT" },
      { label: "AI Video Gen", href: "/dashboard/ai-video", icon: Film, badge: "NEW" },
      { label: "Voice Studio", href: "/dashboard/voice-studio", icon: Mic },
      { label: "Thumbnails", href: "/dashboard/thumbnail-generator", icon: Image },
      { label: "Video Editor", href: "/dashboard/video-editor", icon: Film },
      { label: "AI Agents", href: "/dashboard/services", icon: Bot },
      { label: "Agent Office", href: "/dashboard/agent-office", icon: UsersRound },
      { label: "AI Caller", href: "/dashboard/eleven-agents", icon: Phone },
    ],
  },
  {
    label: "Automate",
    items: [
      { label: "Workflows", href: "/dashboard/workflows", icon: Zap },
      { label: "Automations", href: "/dashboard/automations", icon: RotateCcw },
      { label: "Flow Builder", href: "/dashboard/workflow-builder", icon: GitBranch },
      { label: "Lead Finder", href: "/dashboard/scraper", icon: Search },
      { label: "Dialer", href: "/dashboard/dialer", icon: Phone },
      { label: "Voice AI", href: "/dashboard/voice-receptionist", icon: Mic },
      { label: "DM Controller", href: "/dashboard/dm-controller", icon: Send },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Integrations Hub", href: "/dashboard/integrations-hub", icon: Plug },
      { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare },
      { label: "Telegram", href: "/dashboard/telegram-bot", icon: MessageSquare },
      { label: "Discord", href: "/dashboard/discord", icon: MessageSquare },
      { label: "Google Business", href: "/dashboard/google-business", icon: Globe },
      { label: "Notion Sync", href: "/dashboard/notion-sync", icon: FileCheck },
      { label: "API Docs", href: "/dashboard/api-docs", icon: FileCheck },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      { label: "Financials", href: "/dashboard/financials", icon: DollarSign },
      { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
      { label: "Team", href: "/dashboard/team", icon: UsersRound },
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

// ─── Dropdown menu ────────────────────────────────────────────────────────────

function NavDropdown({
  group,
  pathname,
  onClose,
}: {
  group: NavGroup
  pathname: string
  onClose: () => void
}) {
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))

  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: 240,
        background: "var(--sidebar-dropdown-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 14,
        padding: "6px",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow:
          "0 4px 6px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        zIndex: 200,
      }}
    >
      {/* Column of items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {group.items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 9,
                textDecoration: "none",
                background: active ? "var(--sidebar-item-bg-active)" : "transparent",
                transition: "background 140ms ease",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"
              }}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={15}
                style={{
                  color: active ? "var(--sidebar-icon-active)" : "var(--sidebar-text-secondary)",
                  flexShrink: 0,
                }}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--sidebar-text-primary)" : "var(--sidebar-text-secondary)",
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </span>
              {item.badge && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    padding: "2px 5px",
                    borderRadius: 4,
                    background: item.badge === "HOT"
                      ? "rgba(239,68,68,0.18)"
                      : "rgba(59,130,246,0.18)",
                    color: item.badge === "HOT" ? "#F87171" : "#60A5FA",
                    border: `1px solid ${item.badge === "HOT" ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.25)"}`,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Nav group trigger ────────────────────────────────────────────────────────

function NavGroupTrigger({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isGroupActive = group.items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          borderRadius: 8,
          border: "none",
          background: open || isGroupActive
            ? "var(--sidebar-item-bg-active)"
            : "transparent",
          cursor: "pointer",
          transition: "background 140ms ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!open && !isGroupActive)
            (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
        }}
        onMouseLeave={(e) => {
          if (!open && !isGroupActive)
            (e.currentTarget as HTMLElement).style.background = "transparent"
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: isGroupActive ? 600 : 500,
            color: isGroupActive
              ? "var(--sidebar-icon-active)"
              : "var(--sidebar-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {group.label}
        </span>
        <ChevronDown
          size={13}
          style={{
            color: isGroupActive ? "var(--sidebar-icon-active)" : "var(--sidebar-text-secondary)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms ease",
          }}
        />
      </button>

      {open && (
        <NavDropdown group={group} pathname={pathname} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean
  onClose: () => void
  pathname: string
}) {
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 300,
          zIndex: 50,
          background: "var(--sidebar-dropdown-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          overflowY: "auto",
          padding: "16px 0 32px",
        }}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 16px",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <Link
            href="/dashboard"
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
          >
            <BrainLogo size={22} />
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--sidebar-text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              ShortStack OS
            </span>
          </Link>
          <button
            onClick={onClose}
            style={{
              background: "var(--sidebar-item-bg)",
              border: "1px solid var(--sidebar-border)",
              borderRadius: 8,
              padding: "5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "var(--sidebar-text-secondary)",
            }}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dashboard link */}
        <div style={{ padding: "12px 10px 0" }}>
          <Link
            href="/dashboard"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 10px",
              borderRadius: 10,
              textDecoration: "none",
              background: isActive("/dashboard") && pathname === "/dashboard"
                ? "var(--sidebar-item-bg-active)"
                : "transparent",
              marginBottom: 4,
            }}
          >
            <LayoutDashboard
              size={16}
              style={{ color: "var(--sidebar-icon-active)" }}
              strokeWidth={2}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--sidebar-text-primary)",
              }}
            >
              Dashboard
            </span>
          </Link>
        </div>

        {/* Groups */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ padding: "12px 10px 0" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--sidebar-text-secondary)",
                padding: "0 10px 6px",
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    background: active ? "var(--sidebar-item-bg-active)" : "transparent",
                    marginBottom: 1,
                  }}
                >
                  <Icon
                    size={15}
                    style={{
                      color: active ? "var(--sidebar-icon-active)" : "var(--sidebar-text-secondary)",
                      flexShrink: 0,
                    }}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--sidebar-text-primary)" : "var(--sidebar-text-secondary)",
                    }}
                  >
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        padding: "2px 5px",
                        borderRadius: 4,
                        background: item.badge === "HOT"
                          ? "rgba(239,68,68,0.18)"
                          : "rgba(59,130,246,0.18)",
                        color: item.badge === "HOT" ? "#F87171" : "#60A5FA",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Main TrinitySidebar (now floating top navbar) ────────────────────────────

interface TrinitySidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function TrinitySidebar({
  mobileOpen = false,
  onMobileClose,
}: TrinitySidebarProps) {
  const pathname = usePathname() ?? ""
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sync with parent mobileOpen prop
  useEffect(() => {
    setDrawerOpen(mobileOpen)
  }, [mobileOpen])

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false)
    onMobileClose?.()
  }, [onMobileClose])

  // Close drawer on route change
  useEffect(() => {
    handleDrawerClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <>
      {/* ── Floating top navbar ───────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        style={{
          position: "fixed",
          top: 10,
          left: 12,
          right: 12,
          height: 52,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 12,
          paddingRight: 12,
          background: "var(--sidebar-bg)",
          border: "1px solid var(--sidebar-border)",
          borderRadius: 16,
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {/* ── Logo + brand name ──────────────────────────────────────── */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            textDecoration: "none",
            marginRight: 6,
            flexShrink: 0,
          }}
          aria-label="ShortStack OS — go to dashboard"
        >
          <BrainLogo size={22} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--sidebar-text-primary)",
              letterSpacing: "-0.025em",
              whiteSpace: "nowrap",
            }}
          >
            ShortStack <span style={{ color: "var(--sidebar-icon-active)", fontWeight: 800 }}>OS</span>
          </span>
        </Link>

        {/* ── Separator ─────────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            width: 1,
            height: 20,
            background: "var(--sidebar-border)",
            marginRight: 4,
            flexShrink: 0,
          }}
        />

        {/* ── Dashboard pill ─────────────────────────────────────────── */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 10px",
            borderRadius: 8,
            textDecoration: "none",
            background: pathname === "/dashboard" ? "var(--sidebar-item-bg-active)" : "transparent",
            flexShrink: 0,
            transition: "background 140ms ease",
          }}
          onMouseEnter={(e) => {
            if (pathname !== "/dashboard")
              (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
          }}
          onMouseLeave={(e) => {
            if (pathname !== "/dashboard")
              (e.currentTarget as HTMLElement).style.background = "transparent"
          }}
          aria-current={pathname === "/dashboard" ? "page" : undefined}
        >
          <LayoutDashboard
            size={15}
            style={{ color: pathname === "/dashboard" ? "var(--sidebar-icon-active)" : "var(--sidebar-text-secondary)" }}
            strokeWidth={pathname === "/dashboard" ? 2.2 : 1.8}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: pathname === "/dashboard" ? 600 : 500,
              color: pathname === "/dashboard" ? "var(--sidebar-icon-active)" : "var(--sidebar-text-primary)",
              whiteSpace: "nowrap",
            }}
          >
            Home
          </span>
        </Link>

        {/* ── Group dropdowns (hidden on mobile) ─────────────────────── */}
        <div
          className="hidden lg:flex"
          style={{ alignItems: "center", gap: 2, flex: 1, overflow: "hidden" }}
        >
          {NAV_GROUPS.map((group) => (
            <NavGroupTrigger key={group.label} group={group} pathname={pathname} />
          ))}
        </div>

        {/* ── Right side actions ─────────────────────────────────────── */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {/* Search / command palette trigger */}
          <button
            onClick={() => {
              // Dispatch Cmd+K shortcut to open CommandPalette
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--sidebar-border)",
              background: "transparent",
              cursor: "pointer",
              transition: "background 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent"
            }}
            aria-label="Open command palette (⌘K)"
          >
            <Search size={14} style={{ color: "var(--sidebar-text-secondary)" }} />
            <span
              className="hidden lg:inline"
              style={{ fontSize: 12, color: "var(--sidebar-text-secondary)" }}
            >
              Search
            </span>
            <kbd
              className="hidden xl:inline"
              style={{
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 4,
                border: "1px solid var(--sidebar-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--sidebar-text-secondary)",
                fontFamily: "inherit",
              }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <Link
            href="/dashboard/notifications"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--sidebar-border)",
              background: "transparent",
              textDecoration: "none",
              transition: "background 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent"
            }}
            aria-label="Notifications"
          >
            <Bell size={15} style={{ color: "var(--sidebar-text-secondary)" }} />
          </Link>

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              border: pathname.startsWith("/dashboard/settings")
                ? "1px solid var(--sidebar-border-active)"
                : "1px solid var(--sidebar-border)",
              background: pathname.startsWith("/dashboard/settings")
                ? "var(--sidebar-item-bg-active)"
                : "transparent",
              textDecoration: "none",
              transition: "background 140ms ease, border-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/dashboard/settings"))
                (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/dashboard/settings"))
                (e.currentTarget as HTMLElement).style.background = "transparent"
            }}
            aria-label="Settings"
          >
            <Settings
              size={15}
              style={{
                color: pathname.startsWith("/dashboard/settings")
                  ? "var(--sidebar-icon-active)"
                  : "var(--sidebar-text-secondary)",
              }}
            />
          </Link>

          {/* Mobile hamburger */}
          <button
            className="flex lg:hidden"
            onClick={() => setDrawerOpen(true)}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--sidebar-border)",
              background: "transparent",
              cursor: "pointer",
            }}
            aria-label="Open navigation menu"
          >
            <Menu size={16} style={{ color: "var(--sidebar-text-secondary)" }} />
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ────────────────────────────────────────────── */}
      <MobileDrawer open={drawerOpen} onClose={handleDrawerClose} pathname={pathname} />
    </>
  )
}
