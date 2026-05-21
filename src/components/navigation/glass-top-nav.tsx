"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Film,
  Image,
  Share2,
  Settings,
  Zap,
  Search,
  Bell,
  Moon,
  Sun,
  MessageSquare,
  Wand2,
  Layers,
  Scissors,
  FolderOpen,
  Palette,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ── Nav map ────────────────────────────────────────────────────────────────

interface NavPill {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

/** "Create" row — content production tools */
const CREATE_PILLS: NavPill[] = [
  { label: "Studio",      href: "/dashboard/ai-studio",      icon: Layers },
  { label: "Thumbs",      href: "/dashboard/thumbnail-generator", icon: Image, badge: "42" },
  { label: "Video",       href: "/dashboard/ai-video",       icon: Film },
  { label: "Editor",      href: "/dashboard/video-editor",   icon: Scissors },
  { label: "Social",      href: "/dashboard/social-studio",  icon: Share2,   badge: "11" },
  { label: "Stats",       href: "/dashboard/analytics",      icon: BarChart3 },
];

/** "System" row — business infrastructure */
const SYSTEM_PILLS: NavPill[] = [
  { label: "Library",     href: "/dashboard/content-library", icon: FolderOpen },
  { label: "Comments",    href: "/dashboard/conversations",  icon: MessageSquare, badge: "4" },
  { label: "Brand kit",   href: "/dashboard/brand-kit",      icon: Palette },
  { label: "Automations", href: "/dashboard/automations",    icon: Zap,          badge: "5" },
  { label: "Settings",    href: "/dashboard/settings",       icon: Settings },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

// ── Pill component ─────────────────────────────────────────────────────────

function NavPillBtn({ pill, pathname }: { pill: NavPill; pathname: string }) {
  const active = isActive(pill.href, pathname);
  const Icon = pill.icon;
  return (
    <Link
      href={pill.href}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
        transition-all duration-150 whitespace-nowrap relative
        ${active
          ? "bg-[#D4FF00] text-[#0a0a0a] border-transparent shadow-[0_6px_14px_-6px_rgba(212,255,0,0.5)]"
          : "text-[rgba(240,240,244,0.65)] hover:text-[#F0F0F4] hover:bg-[rgba(255,255,255,0.05)] border border-transparent hover:border-[rgba(255,255,255,0.08)]"
        }
      `}
    >
      <Icon size={12} strokeWidth={2} />
      {pill.label}
      {pill.badge && (
        <span className="ml-0.5 text-[9px] font-bold px-1 py-0.5 rounded-full bg-[rgba(212,255,0,0.2)] text-[#D4FF00]">
          {pill.badge}
        </span>
      )}
    </Link>
  );
}

// ── Row label ─────────────────────────────────────────────────────────────

function RowLabel({ children }: { children: string }) {
  return (
    <span
      className="shrink-0 text-[9px] font-mono uppercase tracking-[0.18em] text-[rgba(240,240,244,0.28)] select-none"
      style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
    >
      {children}
    </span>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function GlassTopNav() {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "";
  const { profile } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [theme, setTheme] = useState<"noir" | "light">("noir");
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Theme toggle (noir / light)
  const toggleTheme = useCallback(() => {
    const next = theme === "noir" ? "light" : "noir";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, [theme]);

  // User initials
  const initials = profile
    ? `${profile.full_name?.split(" ")[0]?.[0] ?? ""}${profile.full_name?.split(" ")[1]?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  return (
    <nav
      aria-label="Main navigation"
      className="glass-top-nav"
    >
      {/* ── Row 1: Brand + Search + Utilities ───────────────────────────────── */}
      <div className="gtn-row gtn-row-1">
        {/* Brand */}
        <Link href="/dashboard" className="gtn-brand" aria-label="ShortStack dashboard home">
          <span className="gtn-brand-logo" aria-hidden="true">
            {/* Original ShortStack mark — 3-tier stacked lens/pillow glyph */}
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none">
              <path d="M 56 72 Q 56 50 84 50 Q 128 42 172 50 Q 200 50 200 72 Q 200 94 172 94 Q 128 102 84 94 Q 56 94 56 72 Z" fill="#D4FF00" opacity="0.4"/>
              <path d="M 56 128 Q 56 106 84 106 Q 128 98 172 106 Q 200 106 200 128 Q 200 150 172 150 Q 128 158 84 150 Q 56 150 56 128 Z" fill="#D4FF00" opacity="0.65"/>
              <path d="M 56 184 Q 56 162 84 162 Q 128 154 172 162 Q 200 162 200 184 Q 200 206 172 206 Q 128 214 84 206 Q 56 206 56 184 Z" fill="#D4FF00" opacity="0.9"/>
            </svg>
          </span>
          <span className="gtn-brand-name">
            <span className="gtn-brand-main">ShortStack</span>
            <span className="gtn-brand-sub">OS · v4</span>
          </span>
        </Link>

        {/* Search bar */}
        <div className="gtn-search" role="search">
          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className={`gtn-search-btn ${searchOpen ? "gtn-search-open" : ""}`}
            aria-label="Search (Ctrl+K)"
          >
            <Search size={12} strokeWidth={2} className="gtn-search-icon" />
            {searchOpen ? (
              <input
                ref={searchRef}
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onBlur={() => { if (!searchVal) setSearchOpen(false); }}
                className="gtn-search-input"
                placeholder="Search anything…"
                aria-label="Search"
              />
            ) : (
              <span className="gtn-search-placeholder">Search…</span>
            )}
            <kbd className="gtn-search-kbd">⌘K</kbd>
          </button>
        </div>

        {/* Utilities */}
        <div className="gtn-utilities" role="toolbar" aria-label="Navigation utilities">
          {/* Dashboard home shortcut */}
          <Link
            href="/dashboard"
            className={`gtn-util-btn ${pathname === "/dashboard" ? "gtn-util-active" : ""}`}
            aria-label="Dashboard home"
            title="Dashboard"
          >
            <LayoutDashboard size={14} strokeWidth={1.8} />
          </Link>

          {/* Analytics */}
          <Link
            href="/dashboard/analytics"
            className={`gtn-util-btn ${isActive("/dashboard/analytics", pathname) ? "gtn-util-active" : ""}`}
            aria-label="Analytics"
            title="Analytics"
          >
            <BarChart3 size={14} strokeWidth={1.8} />
          </Link>

          {/* Notifications */}
          <button className="gtn-util-btn gtn-notif" aria-label="Notifications">
            <Bell size={14} strokeWidth={1.8} />
            <span className="gtn-notif-dot" aria-hidden="true" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="gtn-util-btn"
            aria-label={theme === "noir" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "noir" ? "Light mode" : "Dark mode"}
          >
            {theme === "noir" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>

          {/* Avatar / account */}
          <Link
            href="/dashboard/settings"
            className="gtn-avatar"
            aria-label={`Account settings — ${profile?.full_name ?? "User"}`}
            title="Account"
          >
            {initials}
          </Link>
        </div>
      </div>

      {/* ── Row 2: Create tools ─────────────────────────────────────────────── */}
      <div className="gtn-row gtn-row-2">
        <RowLabel>create</RowLabel>
        <div className="gtn-pills" role="navigation" aria-label="Content creation tools">
          {CREATE_PILLS.map(p => (
            <NavPillBtn key={p.href} pill={p} pathname={pathname} />
          ))}
        </div>
        <div className="gtn-quickbar">
          <Link
            href="/dashboard/ai-studio"
            className="gtn-action-btn gtn-action-primary"
            aria-label="Generate with AI Studio"
          >
            <Wand2 size={11} strokeWidth={2} />
            Generate
          </Link>
          <span className="gtn-render-chip" title="3 renders in flight" aria-label="3 renders in flight">
            <span className="gtn-render-dot" aria-hidden="true" />
            <span>3 renders</span>
          </span>
        </div>
      </div>

      {/* ── Row 3: System ───────────────────────────────────────────────────── */}
      <div className="gtn-row gtn-row-3">
        <RowLabel>system</RowLabel>
        <div className="gtn-pills" role="navigation" aria-label="System tools">
          {SYSTEM_PILLS.map(p => (
            <NavPillBtn key={p.href} pill={p} pathname={pathname} />
          ))}
        </div>
        <div className="gtn-quickbar">
          <Link
            href="/dashboard/social-studio"
            className="gtn-action-btn gtn-action-ghost"
            aria-label="Schedule posts"
          >
            <Plus size={11} strokeWidth={2} />
            Schedule
          </Link>
          <span className="gtn-render-chip" title="System health" aria-label="All systems operational">
            <span className="gtn-render-dot gtn-render-dot-ok" aria-hidden="true" />
            <span>all systems</span>
          </span>
        </div>
      </div>
    </nav>
  );
}
