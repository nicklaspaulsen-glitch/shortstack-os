"use client";
import { ChartBar, CurrencyDollar, Phone, Pulse, Sparkle, Users } from "@phosphor-icons/react";

/**
 * /dashboard/3d — Agency Metrics in 3D.
 *
 * Six floating orbs, each representing a live KPI pulled from
 * /api/agent-command.  Sphere radius scales with the normalised value;
 * each orb bobs on a sine-wave and carries a branded accent color.
 *
 * R3F Canvas is dynamic-imported (no SSR) so Three.js never hits the
 * server build.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentCommandStats {
  tasksQueued?: number;
  leadsInPipeline?: number;
  revenueThisMonth?: number;
  activeAgents?: number;
}

interface OfficeStat {
  callsToday?: number;
  leadsScored?: number;
  emailsSent?: number;
  proposalsExecuted?: number;
  contentPosted?: number;
  thumbnailsRendered?: number;
}

interface DashboardStats {
  revenueThisMonth: number;
  leadsInPipeline: number;
  leadsScored: number;
  callsToday: number;
  contentPosted: number;
  tasksQueued: number;
}

// ── Orb definitions ───────────────────────────────────────────────────────────

const ORB_DEFINITIONS = [
  {
    key: "revenue",
    label: "Revenue",
    sublabel: "this month",
    color: "#D4FF00",
    icon: CurrencyDollar,
    format: (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`,
    phaseOffset: 0,
  },
  {
    key: "pipeline",
    label: "Pipeline",
    sublabel: "leads",
    color: "#5E5BFF",
    icon: Users,
    format: (v: number) => String(v),
    phaseOffset: 1.05,
  },
  {
    key: "leadsScored",
    label: "Leads Scored",
    sublabel: "today",
    color: "#7FE5B8",
    icon: Pulse,
    format: (v: number) => String(v),
    phaseOffset: 2.09,
  },
  {
    key: "calls",
    label: "Calls",
    sublabel: "today",
    color: "#FF8A4C",
    icon: Phone,
    format: (v: number) => String(v),
    phaseOffset: 3.14,
  },
  {
    key: "content",
    label: "Content",
    sublabel: "published",
    color: "#FFC062",
    icon: Sparkle,
    format: (v: number) => String(v),
    phaseOffset: 4.19,
  },
  {
    key: "tasks",
    label: "Tasks",
    sublabel: "queued",
    color: "#A78BFA",
    icon: ChartBar,
    format: (v: number) => String(v),
    phaseOffset: 5.24,
  },
] as const;

type OrbKey = (typeof ORB_DEFINITIONS)[number]["key"];

// ── R3F Scene (dynamic, no SSR) ───────────────────────────────────────────────

const MetricOrbScene = dynamic(
  () => import("@/components/dashboard-3d/metric-orb-scene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center bg-white/[0.02]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4FF00]/30 border-t-[#D4FF00]" />
          <p className="text-[11px] font-medium tracking-widest uppercase text-text-muted/60">
            Loading 3D scene
          </p>
        </div>
      </div>
    ),
  },
);

// ── Data helpers ──────────────────────────────────────────────────────────────

function statsToValues(s: DashboardStats): Record<OrbKey, number> {
  return {
    revenue: s.revenueThisMonth,
    pipeline: s.leadsInPipeline,
    leadsScored: s.leadsScored,
    calls: s.callsToday,
    content: s.contentPosted,
    tasks: s.tasksQueued,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard3DPage() {
  const [stats, setStats] = useState<DashboardStats>({
    revenueThisMonth: 0,
    leadsInPipeline: 0,
    leadsScored: 0,
    callsToday: 0,
    contentPosted: 0,
    tasksQueued: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cmdRes, snapRes] = await Promise.all([
          fetch("/api/agent-command"),
          fetch("/api/agent-office/snapshot"),
        ]);
        const cmd = cmdRes.ok
          ? ((await cmdRes.json()) as { stats?: AgentCommandStats })
          : null;
        const snap = snapRes.ok
          ? ((await snapRes.json()) as { stats?: OfficeStat })
          : null;
        if (!cancelled) {
          setStats({
            revenueThisMonth: cmd?.stats?.revenueThisMonth ?? 0,
            leadsInPipeline: cmd?.stats?.leadsInPipeline ?? 0,
            leadsScored: snap?.stats?.leadsScored ?? 0,
            callsToday: snap?.stats?.callsToday ?? 0,
            contentPosted: snap?.stats?.contentPosted ?? 0,
            tasksQueued: cmd?.stats?.tasksQueued ?? 0,
          });
        }
      } catch (err) {
        console.error("[dashboard/3d] failed to load stats", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const values = statsToValues(stats);

  // Normalise values 0–1 relative to the max across all orbs (floor 0.2 so
  // even zero-value orbs stay visible).
  const maxVal = Math.max(...Object.values(values), 1);
  const normalised: Record<OrbKey, number> = Object.fromEntries(
    (Object.entries(values) as [OrbKey, number][]).map(([k, v]) => [
      k,
      0.2 + (v / maxVal) * 0.8,
    ]),
  ) as Record<OrbKey, number>;

  return (
    <MotionPage className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">
            Live Metrics
          </p>
          <h1 className="text-2xl font-display font-bold text-text-primary">
            Agency 3D
          </h1>
        </div>
        {loading && (
          <span className="text-[11px] text-text-muted animate-pulse">Loading stats…</span>
        )}
      </div>

      {/* ── 3D Canvas ──────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-border-subtle bg-[#020711]">
        <MetricOrbScene orbs={ORB_DEFINITIONS} normalised={normalised} values={values} />
      </div>

      {/* ── Stat grid (mirrors the 3D orbs) ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ORB_DEFINITIONS.map((orb) => {
          const raw = values[orb.key];
          const Icon = orb.icon;
          return (
            <div
              key={orb.key}
              className="flex flex-col gap-1.5 rounded-xl border px-4 py-3"
              style={{
                background: `${orb.color}0d`,
                borderColor: `${orb.color}30`,
              }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: `${orb.color}22`, color: orb.color }}
              >
                <Icon size={14} />
              </div>
              <div className="leading-none">
                <div
                  className="text-xl font-bold font-display tabular-nums"
                  style={{ color: orb.color }}
                >
                  {loading ? "—" : orb.format(raw)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                  {orb.label}
                  <span className="ml-1 normal-case opacity-60">{orb.sublabel}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MotionPage>
  );
}
