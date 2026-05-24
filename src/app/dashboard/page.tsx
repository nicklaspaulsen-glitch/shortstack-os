"use client";
import { ArrowUpRight, Bell, Briefcase, Clock, FileText, Lightning, MagnifyingGlass, Moon, PaperPlaneTilt, Pulse, Sparkle, Sun, Target, TrendUp, UserPlus, Users } from "@phosphor-icons/react";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
      db.from("workflows").select("id", { count: "exact", head: true }).eq("active", true),
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
  change?: string;
  changeUp?: boolean;
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
        {change && (
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
            {changeUp && <TrendUp size={10} />}
            {change}
          </span>
        )}
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

// ─── Pipeline Board (live Supabase data) ─────────────────────────────────────

interface LiveStage {
  id: string;
  label: string;
  color: string;
  count: number;
}

const STAGE_META: LiveStage[] = [
  { id: "new",          label: "New",        color: "#D4FF00", count: 0 },
  { id: "called",       label: "Contacted",  color: "#A78BFA", count: 0 },
  { id: "replied",      label: "Replied",    color: "#F59E0B", count: 0 },
  { id: "booked",       label: "Booked",     color: "#22C55E", count: 0 },
];

function PipelineBoard() {
  const [stages, setStages] = useState<LiveStage[]>(STAGE_META);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = createSupabaseClient();
    Promise.all(
      STAGE_META.map((s) =>
        db.from("leads").select("id", { count: "exact", head: true }).eq("status", s.id)
      )
    ).then((results) => {
      setStages(
        STAGE_META.map((s, i) => ({ ...s, count: results[i].count ?? 0 }))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const total = stages.reduce((sum, s) => sum + s.count, 0);

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
          <Pulse size={15} style={{ color: "var(--sidebar-icon-active)" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--sidebar-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Lead Pipeline
          </span>
          {!loading && (
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 99,
                background: "rgba(212,255,0,0.08)",
                border: "1px solid rgba(212,255,0,0.18)",
                fontSize: 11,
                fontWeight: 700,
                color: "#D4FF00",
              }}
            >
              {total} total
            </span>
          )}
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
          All leads <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Stage columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
        }}
      >
        {stages.map((stage) => {
          const barPct = total > 0 ? (stage.count / total) * 100 : 0;
          return (
            <Link
              key={stage.id}
              href={`/dashboard/leads?status=${stage.id}`}
              style={{ textDecoration: "none" }}
            >
              <div>
                {/* Stage label + count */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: stage.color }}>
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
                    {loading ? "…" : stage.count}
                  </span>
                </div>

                {/* Proportional bar */}
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "var(--sidebar-border)",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: loading ? "0%" : `${barPct}%`,
                      background: stage.color,
                      borderRadius: 2,
                      transition: "width 600ms cubic-bezier(0.32,0.72,0,1)",
                    }}
                  />
                </div>

                {/* Go-to hint */}
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--sidebar-text-secondary)",
                    margin: 0,
                  }}
                >
                  {loading ? "" : stage.count === 0 ? "none yet" : `${stage.count} lead${stage.count === 1 ? "" : "s"}`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── New Enquiries (live Supabase data) ──────────────────────────────────────

interface RecentLead {
  id: string;
  business_name: string | null;
  source: string | null;
  scraped_at: string;
  status: string;
  lead_score: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#D4FF00",
  called: "#A78BFA",
  replied: "#F59E0B",
  booked: "#22C55E",
  converted: "#D4FF00",
  closed_won: "#D4FF00",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function NewEnquiries() {
  const [leads, setLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = createSupabaseClient();
    db.from("leads")
      .select("id, business_name, source, scraped_at, status, lead_score")
      .order("scraped_at", { ascending: false })
      .limit(5)
      .then(({ data }: { data: RecentLead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            Recent Leads
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
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 56,
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--sidebar-border)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            color: "var(--sidebar-text-secondary)",
            fontSize: 13,
          }}
        >
          No leads yet.{" "}
          <Link href="/dashboard/leads" style={{ color: "var(--sidebar-icon-active)" }}>
            Add your first
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leads.map((lead) => {
            const color = STATUS_COLORS[lead.status] ?? "#D4FF00";
            const ini = initials(lead.business_name);
            return (
              <Link
                key={lead.id}
                href="/dashboard/leads"
                style={{ textDecoration: "none" }}
              >
                <div
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
                      background: `${color}18`,
                      border: `1.5px solid ${color}35`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color,
                      flexShrink: 0,
                    }}
                  >
                    {ini}
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
                      {lead.business_name ?? "Unnamed lead"}
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
                      {lead.source ?? "Direct"}
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
                        background: `${color}18`,
                        fontSize: 10,
                        fontWeight: 700,
                        color,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {lead.status}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--sidebar-text-secondary)" }}>
                      {timeAgo(lead.scraped_at)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Stale Leads — untouched leads needing follow-up ─────────────────────────

interface StaleLead {
  id: string;
  business_name: string | null;
  source: string | null;
  scraped_at: string;
  lead_score: number | null;
}

function FollowUps() {
  const [stale, setStale] = useState<StaleLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = createSupabaseClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.from("leads")
      .select("id, business_name, source, scraped_at, lead_score")
      .eq("status", "new")
      .lt("scraped_at", cutoff)
      .order("scraped_at", { ascending: true })
      .limit(5)
      .then(({ data }: { data: StaleLead[] | null }) => {
        setStale(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            Needs Follow-up
          </span>
        </div>
        {!loading && stale.length > 0 && (
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
            {stale.length} untouched
          </span>
        )}
        {!loading && stale.length === 0 && (
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
            View leads <ArrowUpRight size={11} />
          </Link>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 52,
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--sidebar-border)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : stale.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--sidebar-text-primary)", fontWeight: 600 }}>
            All caught up
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--sidebar-text-secondary)" }}>
            No leads have been waiting more than 24 hours.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stale.map((lead) => {
            const ageH = Math.floor((Date.now() - new Date(lead.scraped_at).getTime()) / 3600000);
            const isOld = ageH >= 48;
            return (
              <Link key={lead.id} href="/dashboard/leads" style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${isOld ? "rgba(248,113,113,0.18)" : "var(--sidebar-border)"}`,
                    cursor: "pointer",
                    transition: "border-color 150ms ease",
                  }}
                >
                  {/* Age badge */}
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: isOld ? "rgba(248,113,113,0.12)" : "rgba(245,158,11,0.12)",
                      border: `1px solid ${isOld ? "rgba(248,113,113,0.25)" : "rgba(245,158,11,0.25)"}`,
                      fontSize: 10,
                      fontWeight: 700,
                      color: isOld ? "#F87171" : "#F59E0B",
                      flexShrink: 0,
                      marginTop: 1,
                      lineHeight: 1.6,
                    }}
                  >
                    {ageH >= 24 * 2 ? `${Math.floor(ageH / 24)}d` : `${ageH}h`}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--sidebar-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lead.business_name ?? "Unnamed lead"}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "var(--sidebar-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lead.source ?? "Direct"} · no action yet
                    </p>
                  </div>

                  {/* Score if available */}
                  {lead.lead_score !== null && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#D4FF00",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {lead.lead_score}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
      color: "#14B8A6",
      icon: Users,
    },
    {
      label: "Total Leads",
      value: stats?.leads ?? "—",
      sub: "in pipeline",
      pct: stats ? Math.min(Math.round((stats.leads / 100) * 100), 100) : 75,
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
      color: "#F97316",
      icon: Lightning,
    },
    {
      label: "AI Credits",
      value: "∞",
      sub: "unlimited plan",
      pct: 100,
      change: "Pro",
      changeUp: true,
      color: "#22C55E",
      icon: Sparkle,
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
          {/* MagnifyingGlass trigger */}
          <button
            aria-label="MagnifyingGlass (⌘K)"
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
            <MagnifyingGlass size={14} />
            <span className="hidden sm:inline">MagnifyingGlass</span>
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
              background: "linear-gradient(135deg, #6366F1, #A78BFA)",
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">

        {statCards.map((card) => (
          <RHStatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Row 2: Pipeline kanban ── */}
      <div style={{ marginBottom: 20 }}>
        <PipelineBoard />
      </div>

      {/* ── Row 3: Enquiries + Follow-ups ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

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
              "linear-gradient(90deg, var(--brand-accent, #D4FF00) 0%, transparent 70%)",
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
              icon: <Sparkle size={22} />,
              color: "text-brand-accent",
              route: "/dashboard/portal/content",
            },
            {
              label: "Contact Us",
              icon: <PaperPlaneTilt size={22} />,
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
