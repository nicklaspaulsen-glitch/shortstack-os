"use client";

/**
 * /dashboard/agent-office — live AI team office.
 * Toggle between the SVG Kumo scene (2D, detailed) and the R3F 3D scene.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ <PageHero> compact (lime accent, eyebrow=LIVE)│
 *   ├────────────────────────────────────────┬─────┤
 *   │                                         │ rail│
 *   │  PixelOfficeCanvas (16:9)               │  +  │
 *   │                                         │ feed│
 *   │                                         │     │
 *   ├─────────────────────────────────────────┴─────┤
 *   │  AgentLegend (10 chips)                       │
 *   ├───────────────────────────────────────────────┤
 *   │  StatTiles row (6 metrics)                    │
 *   └───────────────────────────────────────────────┘
 *
 * When an agent is selected, the right rail swaps from "feed" mode to
 * "selected agent panel" mode — the user gets the agent's portrait,
 * current activity, and last 50 events.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Activity, Users, Phone, Mail, BarChart3, Boxes, LayoutGrid } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { useAuth } from "@/lib/auth-context";
import { AGENTS, AGENT_BY_KEY } from "@/lib/pixel-office/agents";
import type { AgentAction } from "@/lib/pixel-office/event-mapper";
import AgentLegend from "@/components/pixel-office/agent-legend";
import AgentSidePanel from "@/components/pixel-office/agent-side-panel";
import OfficeEventFeed, {
  OnlineNow,
} from "@/components/pixel-office/office-event-feed";
import KumoScene from "@/components/agent-office/kumo-scene";

// 3D scene: dynamically imported so Three.js doesn't bloat the initial bundle.
const AgentScene3D = dynamic(
  () => import("@/components/agent-office-3d/agent-scene-3d"),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center  border border-white/8 bg-[#070708]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1]" />
          <p className="text-xs font-medium text-white/40 tracking-widest uppercase">Loading 3D scene…</p>
        </div>
      </div>
    ),
  }
);

interface Snapshot {
  /** Effective owner id resolved server-side. Used as the realtime channel partition key. */
  ownerId: string;
  agents: { key: string; name: string; role: string; brand: string }[];
  recentEvents: Array<{
    id: string;
    agent_key: string;
    summary: string;
    ref_table: string | null;
    ref_id: string | null;
    created_at: string;
    event_type: string;
  }>;
  byAgent: Record<
    string,
    Array<{
      id: string;
      summary: string;
      ref_table: string | null;
      ref_id: string | null;
      created_at: string;
      event_type: string;
    }>
  >;
  stats: {
    callsToday: number;
    leadsScored: number;
    emailsSent: number;
    proposalsExecuted: number;
    contentPosted: number;
    thumbnailsRendered: number;
  };
  online: { online_at: string; presence_ref?: string }[];
}

export default function AgentOfficePage() {
  const { user, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const [feed, setFeed] = useState<AgentAction[]>([]);
  const [viewMode, setViewMode] = useState<"kumo" | "3d">("kumo");

  // Hydrate the snapshot once we know who's logged in.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/agent-office/snapshot");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(data);
          // Seed the feed from the recent events.
          setFeed(
            (data.recentEvents ?? []).map((e) => ({
              agentKey: e.agent_key,
              kind: "play_work",
              summary: e.summary,
              refTable: e.ref_table ?? "agent_activity_events",
              refId: e.ref_id ?? undefined,
              ts: e.created_at,
            })),
          );
        }
      } catch (err) {
        console.error("[agent-office] snapshot failed", err);
        if (!cancelled) {
          setSnapshotError(
            err instanceof Error ? err.message : "Failed to load snapshot",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Convert byAgent → AgentAction history maps for canvas hydration.
  const initialHistory = useMemo<Record<string, AgentAction[]>>(() => {
    if (!snapshot) return {};
    const out: Record<string, AgentAction[]> = {};
    for (const agent of AGENTS) {
      const events = snapshot.byAgent[agent.key] ?? [];
      out[agent.key] = events.map((e) => ({
        agentKey: agent.key,
        kind: "play_work",
        summary: e.summary,
        refTable: e.ref_table ?? "agent_activity_events",
        refId: e.ref_id ?? undefined,
        ts: e.created_at,
      }));
    }
    return out;
  }, [snapshot]);

  // Apr 28 v12: feed-based recent map for KumoScene activity rings.
  // Each agent_key → most-recent-event timestamp.
  const kumoRecent = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const e of feed) {
      const ts = Date.parse(e.ts);
      if (!isFinite(ts)) continue;
      const prev = out[e.agentKey] ?? 0;
      if (ts > prev) out[e.agentKey] = ts;
    }
    return out;
  }, [feed]);

  // Owner id is resolved server-side in /api/agent-office/snapshot — falls
  // back to the user id only as a defensive default while the snapshot
  // is loading. The realtime channel uses this partition key so we never
  // see another agency's events even if the channel is mis-filtered.
  const ownerId = snapshot?.ownerId ?? user?.id ?? null;

  const handleActionResolved = (key: string, action: AgentAction): void => {
    setFeed((prev) => [action, ...prev].slice(0, 50));
  };

  const selectedAgent = selectedAgentKey ? AGENT_BY_KEY[selectedAgentKey] : null;
  const liveCurrent = useMemo<AgentAction | null>(() => {
    if (!selectedAgentKey) return null;
    const recent = feed.find((e) => e.agentKey === selectedAgentKey);
    return recent ?? null;
  }, [feed, selectedAgentKey]);
  const liveHistory = useMemo<AgentAction[]>(() => {
    if (!selectedAgentKey) return [];
    return feed.filter((e) => e.agentKey === selectedAgentKey);
  }, [feed, selectedAgentKey]);

  if (authLoading) {
    return (
      <div className="fade-in space-y-5">
        <div className="h-24 animate-pulse  bg-white/5" />
        <div className="h-[60vh] animate-pulse  bg-white/5" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fade-in space-y-5">
        <PageHero
          eyebrow="Live"
          title="Agent Office"
          subtitle="Sign in to watch your AI team work."
          icon={<Sparkles size={26} />}
          gradient="gold"
        />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      {/* Hero strip with stat tiles inline */}
      <PageHero
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-400" />
            </span>
            LIVE
          </span>
        }
        title="Agent Office"
        subtitle="A pixel-art view of your AI team. Each character is driven by real database events — when something happens, that agent walks over and works on it."
        icon={<Sparkles size={26} />}
        gradient="gold"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* 2D / 3D toggle */}
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode("kumo")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all ${viewMode === "kumo" ? "bg-[#6366F1] text-white shadow" : "text-white/45 hover:text-white/70"}`}
                title="2D Pixel view"
              >
                <LayoutGrid size={10} />
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all ${viewMode === "3d" ? "bg-[#6366F1] text-white shadow" : "text-white/45 hover:text-white/70"}`}
                title="3D Scene view"
              >
                <Boxes size={10} />
                3D
              </button>
            </div>
            <StatTile
              icon={<Phone size={11} />}
              label="Calls today"
              value={snapshot?.stats.callsToday ?? "—"}
              accent="#5e5bff"
            />
            <StatTile
              icon={<Users size={11} />}
              label="Leads scored"
              value={snapshot?.stats.leadsScored ?? "—"}
              accent="#7fe5b8"
            />
            <StatTile
              icon={<Mail size={11} />}
              label="Emails sent"
              value={snapshot?.stats.emailsSent ?? "—"}
              accent="#ff8a4c"
            />
            <StatTile
              icon={<Activity size={11} />}
              label="Trinity actions"
              value={snapshot?.stats.proposalsExecuted ?? "—"}
              accent="#a78bfa"
            />
            <StatTile
              icon={<BarChart3 size={11} />}
              label="Posts published"
              value={snapshot?.stats.contentPosted ?? "—"}
              accent="#ffc062"
            />
          </div>
        }
      />

      {snapshotError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
          Snapshot failed to load — {snapshotError}. The canvas will run on
          live data only until you reload.
        </div>
      )}

      {/* Main scene + right rail */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="min-w-0 flex-1">
          {viewMode === "3d" ? (
            <AgentScene3D
              recent={kumoRecent}
              hovered={selectedAgentKey}
              setHovered={(k) => setSelectedAgentKey(k)}
              onAgentClick={(k) =>
                setSelectedAgentKey((prev) => (prev === k ? null : k))
              }
            />
          ) : (
            <KumoScene
              variant="full"
              recent={kumoRecent}
              hovered={selectedAgentKey}
              setHovered={(k) => setSelectedAgentKey(k)}
              onAgentClick={(k) =>
                setSelectedAgentKey((prev) => (prev === k ? null : k))
              }
            />
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[320px]">
          <OnlineNow rows={snapshot?.online ?? []} />
          {selectedAgent ? (
            <div className="flex-1">
              <AgentSidePanel
                agentKey={selectedAgent.key}
                liveHistory={liveHistory}
                liveCurrent={liveCurrent}
                onClose={() => setSelectedAgentKey(null)}
              />
            </div>
          ) : (
            <div className="flex-1">
              <OfficeEventFeed
                events={feed}
                onSelectAgent={(k) => setSelectedAgentKey(k)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Legend strip below canvas */}
      <div className=" border border-white/8 bg-[#0a0a0f]/60 p-3 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            Roster
          </div>
          {selectedAgentKey && (
            <button
              onClick={() => setSelectedAgentKey(null)}
              className="text-[10px] text-white/45 underline hover:text-white"
            >
              clear selection
            </button>
          )}
        </div>
        <AgentLegend
          selectedKey={selectedAgentKey}
          onSelect={(k) =>
            setSelectedAgentKey((prev) => (prev === k ? null : k))
          }
        />
      </div>
    </div>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
}

function StatTile({ icon, label, value, accent }: StatTileProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
      style={{
        background: `${accent}14`,
        borderColor: `${accent}40`,
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ background: `${accent}33`, color: accent }}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-wider text-white/50">
          {label}
        </div>
        <div className="text-sm font-bold text-white">{value}</div>
      </div>
    </div>
  );
}
