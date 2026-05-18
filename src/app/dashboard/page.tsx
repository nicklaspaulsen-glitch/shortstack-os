"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Briefcase,
  FileText,
  Send,
  Sparkles,
  Bell,
  Sun,
  Moon,
  Search,
  FilePlus2,
  Upload,
  AppWindow,
  MessageSquare,
  Zap,
  StickyNote,
  Cpu,
  MemoryStick,
  Wifi,
  Activity,
  ChevronRight,
  ArrowUpRight,
  Play,
  Compass,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import BrainLogo from "@/components/brand/brain-logo";
import TrinityOrb from "@/components/dashboard/trinity-orb";

// ─── Below-the-fold lazy ──────────────────────────────────────────────────────
const DowntimeBanner = dynamic(() => import("@/components/dashboard/downtime-banner"), { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name}` : time;
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.getAttribute("data-theme") !== "light";
  });

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        cursor: "pointer",
        color: "var(--sidebar-text-secondary)",
        transition: "background 160ms ease",
        flexShrink: 0,
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

interface QuickAction {
  label: string
  icon: React.ElementType
  href: string
  color: string
  bgFrom: string
  bgTo: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Document",
    icon: FilePlus2,
    href: "/dashboard/ai-studio",
    color: "#60A5FA",
    bgFrom: "rgba(59,130,246,0.12)",
    bgTo: "rgba(99,102,241,0.08)",
  },
  {
    label: "Upload File",
    icon: Upload,
    href: "/dashboard/files",
    color: "#34D399",
    bgFrom: "rgba(52,211,153,0.10)",
    bgTo: "rgba(16,185,129,0.06)",
  },
  {
    label: "Create App",
    icon: AppWindow,
    href: "/dashboard/monitor",
    color: "#A78BFA",
    bgFrom: "rgba(167,139,250,0.12)",
    bgTo: "rgba(139,92,246,0.07)",
  },
  {
    label: "AI Chat",
    icon: MessageSquare,
    href: "/dashboard/conversations",
    color: "#F59E0B",
    bgFrom: "rgba(245,158,11,0.10)",
    bgTo: "rgba(217,119,6,0.06)",
  },
  {
    label: "Automation",
    icon: Zap,
    href: "/dashboard/automations",
    color: "#F472B6",
    bgFrom: "rgba(244,114,182,0.10)",
    bgTo: "rgba(236,72,153,0.06)",
  },
  {
    label: "New Note",
    icon: StickyNote,
    href: "/dashboard/outreach-hub",
    color: "#FB923C",
    bgFrom: "rgba(251,146,60,0.10)",
    bgTo: "rgba(249,115,22,0.06)",
  },
];

// ─── System overview tiles ────────────────────────────────────────────────────

interface SysTile {
  label: string
  icon: React.ElementType
  value: number
  unit: string
  color: string
}

function useFakeMetrics() {
  const [vals, setVals] = useState({ cpu: 34, mem: 61, net: 2.4 });

  useEffect(() => {
    const id = setInterval(() => {
      setVals((v) => ({
        cpu: Math.max(10, Math.min(90, v.cpu + (Math.random() - 0.5) * 8)),
        mem: Math.max(40, Math.min(85, v.mem + (Math.random() - 0.5) * 3)),
        net: Math.max(0.5, Math.min(12, v.net + (Math.random() - 0.5) * 1.2)),
      }));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return vals;
}

function MiniGauge({ pct, color }: { pct: number; color: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - pct / 100);

  return (
    <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--sidebar-border)" strokeWidth={3} />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32,0.72,0,1)" }}
      />
    </svg>
  );
}

function SystemOverview() {
  const { cpu, mem, net } = useFakeMetrics();
  const tiles: SysTile[] = [
    { label: "CPU", icon: Cpu, value: Math.round(cpu), unit: "%", color: "#60A5FA" },
    { label: "Memory", icon: MemoryStick, value: Math.round(mem), unit: "%", color: "#A78BFA" },
    { label: "Network", icon: Wifi, value: parseFloat(net.toFixed(1)), unit: " MB/s", color: "#34D399" },
  ];

  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity size={15} style={{ color: "var(--sidebar-icon-active)" }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--sidebar-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          System Overview
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-2">
            <MiniGauge pct={t.label === "Network" ? Math.min(100, (t.value / 15) * 100) : t.value} color={t.color} />
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "var(--sidebar-text-primary)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {t.value}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--sidebar-text-secondary)" }}>
                {t.unit}
              </span>
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--sidebar-text-secondary)" }}>{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Apps ──────────────────────────────────────────────────────────────

const RECENT_APPS = [
  { name: "AI Studio", href: "/dashboard/ai-studio", color: "#60A5FA", abbr: "AI" },
  { name: "Voice Studio", href: "/dashboard/voice-studio", color: "#A78BFA", abbr: "VS" },
  { name: "Analytics", href: "/dashboard/analytics", color: "#34D399", abbr: "AN" },
  { name: "CRM", href: "/dashboard/crm", color: "#F59E0B", abbr: "CR" },
  { name: "Automations", href: "/dashboard/automations", color: "#F472B6", abbr: "AU" },
];

function RecentApps() {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AppWindow size={15} style={{ color: "var(--sidebar-icon-active)" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--sidebar-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Recent Apps
          </span>
        </div>
        <Link
          href="/dashboard/monitor"
          style={{
            fontSize: 11,
            color: "var(--sidebar-icon-active)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          See all <ArrowUpRight size={11} />
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {RECENT_APPS.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              textDecoration: "none",
              border: "1px solid transparent",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg-active)"
              ;(e.currentTarget as HTMLElement).style.borderColor = "var(--sidebar-border)"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent"
              ;(e.currentTarget as HTMLElement).style.borderColor = "transparent"
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: app.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {app.abbr}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--sidebar-text-primary)",
              }}
            >
              {app.name}
            </span>
            <ChevronRight size={12} style={{ color: "var(--sidebar-text-secondary)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_ITEMS = [
  { text: "AI Studio generated a new social post", time: "2m ago", color: "#60A5FA" },
  { text: "Voice clone completed for client", time: "18m ago", color: "#A78BFA" },
  { text: "New lead captured via outreach", time: "1h ago", color: "#34D399" },
  { text: "Workflow automation triggered", time: "2h ago", color: "#F59E0B" },
  { text: "Analytics report refreshed", time: "3h ago", color: "#F472B6" },
];

function ActivityFeed() {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity size={15} style={{ color: "var(--sidebar-icon-active)" }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--sidebar-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Activity Feed
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {ACTIVITY_ITEMS.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: item.color,
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: "var(--sidebar-text-primary)",
                  lineHeight: 1.4,
                }}
              >
                {item.text}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--sidebar-text-secondary)",
                  marginTop: 1,
                }}
              >
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Storage donut ────────────────────────────────────────────────────────────

function StorageDonut() {
  const segments = [
    { label: "Documents", pct: 35, color: "#60A5FA" },
    { label: "Media", pct: 28, color: "#A78BFA" },
    { label: "Backups", pct: 15, color: "#34D399" },
    { label: "Other", pct: 22, color: "#F59E0B" },
  ];

  const r = 38;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Cpu size={15} style={{ color: "var(--sidebar-icon-active)" }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--sidebar-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Storage Breakdown
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width={96} height={96} viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--sidebar-border)" strokeWidth={10} />
            {segments.map((s, i) => {
              const dash = (s.pct / 100) * circ;
              const gap = circ - dash;
              const el = (
                <circle
                  key={i}
                  cx="48"
                  cy="48"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={10}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={circ - offset}
                  strokeLinecap="round"
                  transform="rotate(-90 48 48)"
                />
              );
              offset += dash;
              return el;
            })}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--sidebar-text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              68%
            </span>
            <span style={{ fontSize: 10, color: "var(--sidebar-text-secondary)" }}>used</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--sidebar-text-primary)", flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-text-secondary)" }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main agency dashboard ────────────────────────────────────────────────────

function AgencyDashboard() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  // Stripe checkout success toast
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get("subscribed");
    if (subscribed) {
      const planLabel = subscribed.charAt(0).toUpperCase() + subscribed.slice(1);
      toast.success(`Welcome to ${planLabel}! Your plan is active.`, { duration: 5000 });
      const t = setTimeout(() => {
        refreshProfile().catch(() => {});
      }, 1500);
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribed");
      window.history.replaceState({}, "", url.toString());
      return () => clearTimeout(t);
    }
  }, [refreshProfile]);

  return (
    <div className="min-h-screen" style={{ paddingBottom: 48 }}>
      <DowntimeBanner />

      {/* ── Top strip: greeting + toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(20px, 3vw, 26px)",
              fontWeight: 800,
              color: "var(--sidebar-text-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
            }}
          >
            {greeting(firstName)} 👋
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--sidebar-text-secondary)",
            }}
          >
            {formatDate()}
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search trigger */}
          <button
            aria-label="Search (⌘K)"
            onClick={() => {
              const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              document.dispatchEvent(e);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--sidebar-item-bg)",
              border: "1px solid var(--sidebar-border)",
              cursor: "pointer",
              color: "var(--sidebar-text-secondary)",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            <Search size={14} />
            <span className="hidden sm:inline">Search</span>
            <kbd
              style={{
                display: "none",
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 5,
                background: "var(--sidebar-border)",
                color: "var(--sidebar-text-secondary)",
                fontFamily: "monospace",
              }}
              className="sm:inline-block"
            >
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <button
            aria-label="Notifications"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--sidebar-item-bg)",
              border: "1px solid var(--sidebar-border)",
              cursor: "pointer",
              color: "var(--sidebar-text-secondary)",
              position: "relative",
            }}
          >
            <Bell size={16} />
            {/* Unread dot */}
            <span
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#F472B6",
                border: "1.5px solid var(--color-background, #020711)",
              }}
            />
          </button>

          <ThemeToggle />

          {/* Avatar */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
              cursor: "pointer",
            }}
            title={profile?.full_name || "Profile"}
          >
            {(firstName || profile?.full_name || "A").charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
        className="grid-cols-1 md:grid-cols-2"
      >
        {/* ── Left: hero card ── */}
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(30,41,80,0.95) 0%, rgba(20,28,60,0.95) 100%)",
            border: "1px solid rgba(99,146,255,0.18)",
            borderRadius: 20,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            position: "relative",
            overflow: "hidden",
            minHeight: 240,
          }}
        >
          {/* Background glow */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: -30,
              left: 20,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Brain + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
            <BrainLogo size={52} />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(160,190,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Operating System
              </p>
              <h2
                style={{
                  margin: "2px 0 0",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#F0F0F4",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
                }}
              >
                Trinity OS
              </h2>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 3,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "linear-gradient(90deg, #60A5FA, #A78BFA)",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "0.04em",
                }}
              >
                2.0 PRO
              </span>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "rgba(200,210,240,0.8)",
              lineHeight: 1.55,
              position: "relative",
              zIndex: 1,
              flex: 1,
            }}
          >
            Your agency command center. Manage clients, AI agents,
            automations, and campaigns from one intelligent workspace.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 1 }}>
            <Link
              href="/dashboard/agent-office"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #3B82F6, #6366F1)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                transition: "opacity 160ms ease",
              }}
            >
              <Compass size={14} />
              Explore Features
            </Link>
            <Link
              href="/dashboard/ai-studio"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(200,210,240,0.9)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 160ms ease",
              }}
            >
              <Play size={13} />
              Watch Overview
            </Link>
          </div>
        </div>

        {/* ── Right: Quick Actions ── */}
        <div
          style={{
            background: "var(--sidebar-item-bg)",
            border: "1px solid var(--sidebar-border)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} style={{ color: "var(--sidebar-icon-active)" }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--sidebar-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Quick Actions
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "14px 14px",
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${action.bgFrom}, ${action.bgTo})`,
                    border: `1px solid ${action.color}22`,
                    textDecoration: "none",
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"
                    ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${action.color}28`
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "none"
                    ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                  }}
                >
                  <Icon size={20} style={{ color: action.color }} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--sidebar-text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2: System Overview + Recent Apps ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
        className="grid-cols-1 md:grid-cols-2"
      >
        <SystemOverview />
        <RecentApps />
      </div>

      {/* ── Row 3: Activity Feed + Storage ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
        className="grid-cols-1 md:grid-cols-2"
      >
        <ActivityFeed />
        <StorageDonut />
      </div>
    </div>
  );
}

// ─── Client portal view (preserved) ──────────────────────────────────────────

/**
 * ClientDashboard — client portal users see a simpler "your services" surface.
 * The agency-owner redesign doesn't touch this view.
 */
function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="relative inline-block">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {profile?.full_name}
        </h1>
        <div
          className="h-[2px] mt-1 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--brand-accent, #2563EB) 0%, transparent 70%)" }}
          aria-hidden
        />
        <p className="text-sm text-text-muted mt-1.5">Your client portal</p>
      </div>

      <TrinityOrb
        firstName={firstName}
        suggestions={[
          "Show me what's happening with my account",
          "What's in my content plan this week?",
          "Draft a message to my account manager",
          "When's my next scheduled post?",
          "Summarise my latest results",
        ]}
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "My Services", icon: <Briefcase size={22} />, color: "text-brand-accent", route: "/dashboard/portal" },
            { label: "Invoices", icon: <FileText size={22} />, color: "text-info", route: "/dashboard/portal/billing" },
            { label: "Content", icon: <Sparkles size={22} />, color: "text-brand-accent", route: "/dashboard/portal/content" },
            { label: "Contact Us", icon: <Send size={22} />, color: "text-success", route: "/dashboard/portal/support" },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => router.push(item.route)}
              className="card-hover p-6 text-center group spotlight-card"
            >
              <span className={`${item.color} inline-block mb-2 group-hover:scale-110 transition-transform`}>
                {item.icon}
              </span>
              <span className="text-sm font-medium block">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Route entry ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = (profile as { role?: string } | null)?.role;

  if (role === "client") {
    return <ClientDashboard />;
  }

  return <AgencyDashboard />;
}
