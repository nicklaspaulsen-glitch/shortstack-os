"use client";

import { useEffect, useState } from "react";
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
  Users,
  Target,
  Zap,
  Activity,
  TrendingUp,
  ArrowUpRight,
  UserPlus,
  Clock,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import TrinityOrb from "@/components/dashboard/trinity-orb";

// ─── Below-the-fold lazy ──────────────────────────────────────────────────────
const DowntimeBanner = dynamic(
  () => import("@/components/dashboard/downtime-banner"),
  { ssr: false }
);

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

// ─── useAgencyStats ───────────────────────────────────────────────────────────

function useAgencyStats() {
  const [stats, setStats] = useState<{
    clients: number;
    workflows: number;
    leads: number;
  } | null>(null);

  useEffect(() => {
    const db = createSupabaseClient();
    Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }),
      db.from("workflows").select("id", { count: "exact", head: true }).eq("enabled", true),
      db.from("leads").select("id", { count: "exact", head: true }),
    ])
      .then(([c, w, l]) => {
        setStats({
          clients: c.count ?? 0,
          workflows: w.count ?? 0,
          leads: l.count ?? 0,
        });
      })
      .catch(() => {
        // non-fatal — leave stats null so the UI shows dashes
      });
  }, []);

  return stats;
}

// ─── Stat Card (Realtyhub-inspired) ──────────────────────────────────────────

interface RHStatCardProps {
  label: string;
  value: string | number;
  sub: string;
  pct: number;
  change: string;
  changeUp: boolean;
  color: string;
  icon: React.ElementType;
}

function RHStatCard({
  label,
  value,
  sub,
  pct,
  change,
  changeUp,
  color,
  icon: Icon,
}: RHStatCardProps) {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -28,
          right: -28,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Icon + change badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${color}18`,
            border: `1px solid ${color}28`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "3px 9px",
            borderRadius: 99,
            background: changeUp
              ? "rgba(34,197,94,0.12)"
              : "rgba(248,113,113,0.12)",
            border: `1px solid ${
              changeUp ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)"
            }`,
            fontSize: 11,
            fontWeight: 700,
            color: changeUp ? "#22C55E" : "#F87171",
          }}
        >
          {changeUp && <TrendingUp size={10} />}
          {change}
        </span>
      </div>

      {/* Number + label */}
      <div style={{ position: "relative" }}>
        <p
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            color: "var(--sidebar-text-primary)",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </p>
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--sidebar-text-primary)",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 11,
            color: "var(--sidebar-text-secondary)",
          }}
        >
          {sub}
        </p>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "var(--sidebar-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}BB, ${color})`,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

// ─── Pipeline Board ───────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  label: string;
  color: string;
  count: number;
  contacts: string[];
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "new",
    label: "New Lead",
    color: "#60A5FA",
    count: 8,
    contacts: ["Sarah Johnson", "Mike Thompson", "Emma Williams"],
  },
  {
    id: "contacted",
    label: "Contacted",
    color: "#A78BFA",
    count: 5,
    contacts: ["John Davies", "Lisa Martinez", "Tom Kim"],
  },
  {
    id: "proposal",
    label: "Proposal Sent",
    color: "#F59E0B",
    count: 3,
    contacts: ["Amy Rodriguez", "Brad Peterson"],
  },
  {
    id: "won",
    label: "Closed Won",
    color: "#22C55E",
    count: 12,
    contacts: ["Dan Foster", "Eva Singh", "Frank Gomez"],
  },
];

function PipelineBoard() {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            Pipeline Overview
          </span>
        </div>
        <Link
          href="/dashboard/crm"
          style={{
            fontSize: 11,
            color: "var(--sidebar-icon-active)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          Full CRM <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Kanban columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
        }}
      >
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.id}>
            {/* Stage label + count */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: 12, fontWeight: 600, color: stage.color }}
              >
                {stage.label}
              </span>
              <span
                style={{
                  padding: "1px 8px",
                  borderRadius: 99,
                  background: `${stage.color}18`,
                  border: `1px solid ${stage.color}30`,
                  fontSize: 11,
                  fontWeight: 700,
                  color: stage.color,
                }}
              >
                {stage.count}
              </span>
            </div>

            {/* Accent bar */}
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: stage.color,
                opacity: 0.3,
                marginBottom: 10,
              }}
            />

            {/* Contact chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {stage.contacts.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--sidebar-border)",
                    fontSize: 12,
                    color: "var(--sidebar-text-primary)",
                    cursor: "pointer",
                    transition: "border-color 150ms ease, background 150ms ease",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c}
                </div>
              ))}
              {stage.count > stage.contacts.length && (
                <div
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: `1px dashed ${stage.color}40`,
                    fontSize: 11,
                    color: stage.color,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  +{stage.count - stage.contacts.length} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New Enquiries ────────────────────────────────────────────────────────────

interface Enquiry {
  initials: string;
  name: string;
  service: string;
  time: string;
  status: string;
  color: string;
}

const ENQUIRIES: Enquiry[] = [
  {
    initials: "SJ",
    name: "Sarah Johnson",
    service: "Social Media Package",
    time: "2m ago",
    status: "NEW",
    color: "#60A5FA",
  },
  {
    initials: "MT",
    name: "Mike Thompson",
    service: "SEO Audit",
    time: "15m ago",
    status: "PENDING",
    color: "#A78BFA",
  },
  {
    initials: "EW",
    name: "Emma Williams",
    service: "PPC Campaign",
    time: "1h ago",
    status: "REVIEW",
    color: "#F59E0B",
  },
  {
    initials: "JD",
    name: "John Davies",
    service: "Email Marketing",
    time: "3h ago",
    status: "NEW",
    color: "#22C55E",
  },
];

function NewEnquiries() {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={15} style={{ color: "var(--sidebar-icon-active)" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--sidebar-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            New Enquiries
          </span>
        </div>
        <Link
          href="/dashboard/leads"
          style={{
            fontSize: 11,
            color: "var(--sidebar-icon-active)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          View all <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ENQUIRIES.map((e) => (
          <div
            key={e.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--sidebar-border)",
              cursor: "pointer",
              transition: "border-color 150ms ease, background 150ms ease",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: `${e.color}18`,
                border: `1.5px solid ${e.color}35`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: e.color,
                flexShrink: 0,
              }}
            >
              {e.initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--sidebar-text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {e.name}
              </p>
              <p
                style={{
                  margin: "1px 0 0",
                  fontSize: 11,
                  color: "var(--sidebar-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {e.service}
              </p>
            </div>

            {/* Status + time */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 3,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 99,
                  background: `${e.color}18`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: e.color,
                  letterSpacing: "0.04em",
                }}
              >
                {e.status}
              </span>
              <span
                style={{ fontSize: 10, color: "var(--sidebar-text-secondary)" }}
              >
                {e.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

interface FollowUp {
  client: string;
  action: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  due: string;
}

const FOLLOWUP_COLOR: Record<string, string> = {
  HIGH: "#F87171",
  MEDIUM: "#F59E0B",
  LOW: "#60A5FA",
};

const FOLLOWUPS: FollowUp[] = [
  {
    client: "Acme Corp",
    action: "Send proposal follow-up email",
    priority: "HIGH",
    due: "Overdue",
  },
  {
    client: "Brand Co",
    action: "Review content calendar",
    priority: "MEDIUM",
    due: "Today",
  },
  {
    client: "Growth Labs",
    action: "Invoice overdue follow-up",
    priority: "HIGH",
    due: "Overdue",
  },
  {
    client: "StartupX",
    action: "Monthly check-in call",
    priority: "LOW",
    due: "This week",
  },
  {
    client: "Blue Ocean",
    action: "Campaign performance review",
    priority: "MEDIUM",
    due: "Friday",
  },
];

function FollowUps() {
  return (
    <div
      style={{
        background: "var(--sidebar-item-bg)",
        border: "1px solid var(--sidebar-border)",
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={15} style={{ color: "var(--sidebar-icon-active)" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--sidebar-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Follow-ups
          </span>
        </div>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 99,
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.25)",
            fontSize: 11,
            fontWeight: 700,
            color: "#F87171",
          }}
        >
          2 overdue
        </span>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FOLLOWUPS.map((f, i) => {
          const color = FOLLOWUP_COLOR[f.priority];
          const isOverdue = f.due === "Overdue";
          const isToday = f.due === "Today";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${isOverdue ? "rgba(248,113,113,0.18)" : "var(--sidebar-border)"}`,
                cursor: "pointer",
                transition: "border-color 150ms ease",
              }}
            >
              {/* Priority badge */}
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: `${color}14`,
                  border: `1px solid ${color}30`,
                  fontSize: 10,
                  fontWeight: 700,
                  color,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                  marginTop: 1,
                  lineHeight: 1.6,
                }}
              >
                {f.priority}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--sidebar-text-primary)",
                  }}
                >
                  {f.client}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: "var(--sidebar-text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.action}
                </p>
              </div>

              {/* Due label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isOverdue || isToday ? 700 : 400,
                  color: isOverdue
                    ? "#F87171"
                    : isToday
                    ? "#F59E0B"
                    : "var(--sidebar-text-secondary)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {f.due}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main agency dashboard ────────────────────────────────────────────────────

function AgencyDashboard() {
  const { profile, refreshProfile } = useAuth();
  const firstName =
    profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];
  const stats = useAgencyStats();

  // Stripe checkout success toast
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get("subscribed");
    if (subscribed) {
      const planLabel =
        subscribed.charAt(0).toUpperCase() + subscribed.slice(1);
      toast.success(`Welcome to ${planLabel}! Your plan is active.`, {
        duration: 5000,
      });
      const t = setTimeout(() => {
        refreshProfile().catch(() => {});
      }, 1500);
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribed");
      window.history.replaceState({}, "", url.toString());
      return () => clearTimeout(t);
    }
  }, [refreshProfile]);

  const statCards: RHStatCardProps[] = [
    {
      label: "Active Clients",
      value: stats?.clients ?? "—",
      sub: "total registered",
      pct: stats ? Math.min(Math.round((stats.clients / 50) * 100), 100) : 60,
      change: "+12%",
      changeUp: true,
      color: "#14B8A6",
      icon: Users,
    },
    {
      label: "Total Leads",
      value: stats?.leads ?? "—",
      sub: "in pipeline",
      pct: stats ? Math.min(Math.round((stats.leads / 100) * 100), 100) : 75,
      change: "+8%",
      changeUp: true,
      color: "#A78BFA",
      icon: Target,
    },
    {
      label: "Workflows",
      value: stats?.workflows ?? "—",
      sub: "automations running",
      pct: stats
        ? Math.min(Math.round((stats.workflows / 20) * 100), 100)
        : 45,
      change: "+3",
      changeUp: true,
      color: "#F97316",
      icon: Zap,
    },
    {
      label: "AI Credits",
      value: "∞",
      sub: "unlimited plan",
      pct: 100,
      change: "Pro",
      changeUp: true,
      color: "#22C55E",
      icon: Sparkles,
    },
  ];

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
              const e = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
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

      {/* ── Row 1: 4 stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {statCards.map((card) => (
          <RHStatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Row 2: Pipeline kanban ── */}
      <div style={{ marginBottom: 20 }}>
        <PipelineBoard />
      </div>

      {/* ── Row 3: Enquiries + Follow-ups ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        <NewEnquiries />
        <FollowUps />
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
  const firstName =
    profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="relative inline-block">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {profile?.full_name}
        </h1>
        <div
          className="h-[2px] mt-1 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--brand-accent, #2563EB) 0%, transparent 70%)",
          }}
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
            {
              label: "My Services",
              icon: <Briefcase size={22} />,
              color: "text-brand-accent",
              route: "/dashboard/portal",
            },
            {
              label: "Invoices",
              icon: <FileText size={22} />,
              color: "text-info",
              route: "/dashboard/portal/billing",
            },
            {
              label: "Content",
              icon: <Sparkles size={22} />,
              color: "text-brand-accent",
              route: "/dashboard/portal/content",
            },
            {
              label: "Contact Us",
              icon: <Send size={22} />,
              color: "text-success",
              route: "/dashboard/portal/support",
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => router.push(item.route)}
              className="card-hover p-6 text-center group spotlight-card"
            >
              <span
                className={`${item.color} inline-block mb-2 group-hover:scale-110 transition-transform`}
              >
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
