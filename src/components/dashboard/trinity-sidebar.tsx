"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  AppWindow,
  FolderOpen,
  BarChart3,
  Zap,
  Settings,
  ChevronDown,
  Check,
  HardDrive,
  X,
  Menu,
} from "lucide-react"
import BrainLogo from "@/components/brand/brain-logo"

// ─── Workspace options ────────────────────────────────────────────────────────

interface Workspace {
  id: string
  name: string
  abbr: string
  color: string
}

const WORKSPACES: Workspace[] = [
  { id: "trinity", name: "Trinity Marketing OS", abbr: "TM", color: "#3B82F6" },
  { id: "mochi", name: "Mochi AI Assistant", abbr: "MA", color: "#A78BFA" },
  { id: "nordctrl", name: "NORDCTRL Brand & Store", abbr: "NB", color: "#FB923C" },
]

// ─── Navigation items ─────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  matchPrefix?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Apps",
    href: "/dashboard/monitor",
    icon: AppWindow,
    matchPrefix: "/dashboard/monitor",
  },
  {
    label: "Files",
    href: "/dashboard/files",
    icon: FolderOpen,
    matchPrefix: "/dashboard/files",
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    matchPrefix: "/dashboard/analytics",
  },
  {
    label: "Automation",
    href: "/dashboard/automations",
    icon: Zap,
    matchPrefix: "/dashboard/automations",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    matchPrefix: "/dashboard/settings",
  },
]

// ─── Storage widget ───────────────────────────────────────────────────────────

function StorageWidget() {
  const usedGB = 102.4
  const totalGB = 256
  const pct = Math.round((usedGB / totalGB) * 100)

  return (
    <div className="px-3 pb-5">
      <div
        style={{
          background: "var(--sidebar-item-bg)",
          borderRadius: 12,
          padding: "12px 14px",
          border: "1px solid var(--sidebar-border)",
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <HardDrive
            size={14}
            style={{ color: "var(--sidebar-icon-active)", flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--sidebar-text-secondary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Storage
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--sidebar-text-primary)",
            }}
          >
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 99,
            background: "var(--sidebar-border)",
            overflow: "hidden",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 99,
              background:
                pct > 85
                  ? "linear-gradient(90deg, #F97316 0%, #EF4444 100%)"
                  : "linear-gradient(90deg, #60A5FA 0%, #818CF8 100%)",
              transition: "width 0.6s cubic-bezier(0.32,0.72,0,1)",
            }}
          />
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--sidebar-text-secondary)",
            margin: 0,
          }}
        >
          {usedGB} GB of {totalGB} GB used
        </p>
      </div>
    </div>
  )
}

// ─── WorkspaceSwitcher ────────────────────────────────────────────────────────

function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Workspace>(WORKSPACES[0])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest("[data-workspace-switcher]")) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div
      className="px-3 pt-4 pb-2"
      data-workspace-switcher
      style={{ position: "relative" }}
    >
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          borderRadius: 10,
          border: "1px solid var(--sidebar-border)",
          background: open ? "var(--sidebar-item-bg-active)" : "var(--sidebar-item-bg)",
          cursor: "pointer",
          transition: "background 180ms ease",
          textAlign: "left",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Workspace avatar */}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: active.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {active.abbr}
        </span>

        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--sidebar-text-primary)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {active.name}
        </span>

        <ChevronDown
          size={14}
          style={{
            color: "var(--sidebar-text-secondary)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% - 4px)",
            left: 12,
            right: 12,
            zIndex: 200,
            background: "var(--sidebar-dropdown-bg)",
            border: "1px solid var(--sidebar-border)",
            borderRadius: 12,
            padding: "6px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
            backdropFilter: "blur(20px)",
          }}
        >
          {WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              role="option"
              aria-selected={ws.id === active.id}
              onClick={() => {
                setActive(ws)
                setOpen(false)
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background:
                  ws.id === active.id ? "var(--sidebar-item-bg-active)" : "transparent",
                cursor: "pointer",
                transition: "background 150ms ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (ws.id !== active.id)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--sidebar-item-bg)"
              }}
              onMouseLeave={(e) => {
                if (ws.id !== active.id)
                  (e.currentTarget as HTMLElement).style.background = "transparent"
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: ws.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                {ws.abbr}
              </span>

              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--sidebar-text-primary)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {ws.name}
              </span>

              {ws.id === active.id && (
                <Check size={13} style={{ color: "var(--sidebar-icon-active)", flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href ||
        (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : false)

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      title={item.label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "10px 8px",
        borderRadius: 12,
        textDecoration: "none",
        background: isActive ? "var(--sidebar-item-bg-active)" : "transparent",
        border: isActive
          ? "1px solid var(--sidebar-border-active)"
          : "1px solid transparent",
        transition: "background 160ms ease, border-color 160ms ease",
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background = "transparent"
      }}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Active indicator dot */}
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: -2,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 20,
            borderRadius: "0 3px 3px 0",
            background: "var(--sidebar-icon-active)",
          }}
        />
      )}

      <Icon
        size={20}
        style={{
          color: isActive ? "var(--sidebar-icon-active)" : "var(--sidebar-icon-inactive)",
          transition: "color 160ms ease",
        }}
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "var(--sidebar-icon-active)" : "var(--sidebar-text-secondary)",
          letterSpacing: "0.01em",
          lineHeight: 1,
          transition: "color 160ms ease, font-weight 160ms ease",
        }}
      >
        {item.label}
      </span>
    </Link>
  )
}

// ─── Main TrinitySidebar component ───────────────────────────────────────────

interface TrinitySidebarProps {
  /** Controls mobile overlay visibility — parent manages this when using mobile hamburger */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function TrinitySidebar({
  mobileOpen = false,
  onMobileClose,
}: TrinitySidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        aria-label="Main navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 240,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          transform: mobileOpen ? "translateX(0)" : undefined,
          transition: "transform 280ms cubic-bezier(0.32,0.72,0,1)",
        }}
        className={
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }
      >
        {/* ── Header: Logo + title ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "18px 16px 12px",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <BrainLogo size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 800,
                color: "var(--sidebar-text-primary)",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
                fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
              }}
            >
              Trinity OS
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 500,
                color: "var(--sidebar-text-secondary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              2.0 Pro
            </p>
          </div>

          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="lg:hidden"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--sidebar-text-secondary)",
              borderRadius: 6,
            }}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Workspace switcher ── */}
        <WorkspaceSwitcher />

        {/* ── Divider ── */}
        <div
          style={{
            margin: "4px 16px 8px",
            height: 1,
            background: "var(--sidebar-border)",
          }}
        />

        {/* ── Icon nav ── */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "4px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          aria-label="Primary navigation"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname ?? ""} />
          ))}
        </nav>

        {/* ── Storage widget ── */}
        <div
          style={{
            marginTop: "auto",
            borderTop: "1px solid var(--sidebar-border)",
            paddingTop: 12,
          }}
        >
          <StorageWidget />
        </div>
      </aside>
    </>
  )
}

// ─── MobileMenuButton ─────────────────────────────────────────────────────────
// Exported separately so layout can render it inside the page header on mobile

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        cursor: "pointer",
        color: "var(--sidebar-text-primary)",
      }}
      aria-label="Open navigation menu"
    >
      <Menu size={18} />
    </button>
  )
}
