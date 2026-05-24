"use client";
import { ChartBar, Envelope, Phone, Pulse, SquaresFour, Stack, Users } from "@phosphor-icons/react";

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
import { useAuth } from "@/lib/auth-context";
import { AGENTS, AGENT_BY_KEY } from "@/lib/pixel-office/agents";
import type { AgentAction } from "@/lib/pixel-office/event-mapper";
import AgentLegend from "@/components/pixel-office/agent-legend";
import AgentSidePanel from "@/components/pixel-office/agent-side-panel";
import OfficeEventFeed, {
  OnlineNow,
} from "@/components/pixel-office/office-event-feed";
import KumoScene from "@/components/agent-office/kumo-scene";
import { MotionPage } from "@/components/motion/motion-page";
import { NetworkAnimation } from "@/components/ui/21st-components";

// 3D scene: dynamically imported so Three.js doesn't bloat the initial bundle.
const AgentScene3D = dynamic(
  () => import("@/components/agent-office-3d/agent-scene-3d"),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center border border-border-subtle bg-white/[0.03]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600/30 border-t-indigo-500" />
          <p className="text-xs font-medium text-text-primary/40 tracking-widest uppercase">Loading 3D scene…</p>
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
      <MotionPage className="space-y-5"><div className="h-24 animate-pulse  bg-white/[0.05]" /><div className="h-[60vh] animate-pulse  bg-white/[0.05]" /></MotionPage>
    );
  }

  if (!user) {
    return (
      <div className="space-y-5">
        {/* -- Agent Office command strip -- */}
        <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Live Status</p>
            <h1 className="text-2xl font-display font-bold text-text-primary">Agent Office</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* -- Agent Office command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-400" />
              </span>
              LIVE
            </span>
          </p>
          <h1 className="text-2xl font-display font-bold text-text-primary">Agent Office</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* 2D / 3D toggle */}
            <div className="flex items-center rounded-lg border border-border-subtle bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode("kumo")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all ${viewMode === "kumo" ? "bg-brand-accent text-[#020711] shadow" : "text-text-muted hover:text-text-secondary"}`}
                title="2D Pixel view"
              >
                <SquaresFour size={10} />
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all ${viewMode === "3d" ? "bg-brand-accent text-[#020711] shadow" : "text-text-muted hover:text-text-secondary"}`}
                title="3D Scene view"
              >
                <Stack size={10} />
                3D
              </button>
            </div>
            <StatTile icon={<Phone size={11} />} label="Calls today" value={snapshot?.stats.callsToday ?? "—"} accent="#5e5bff" />
            <StatTile icon={<Users size={11} />} label="Leads scored" value={snapshot?.stats.leadsScored ?? "—"} accent="#7fe5b8" />
            <StatTile icon={<Envelope size={11} />} label="Emails sent" value={snapshot?.stats.emailsSent ?? "—"} accent="#ff8a4c" />
            <StatTile icon={<Pulse size={11} />} label="Trinity actions" value={snapshot?.stats.proposalsExecuted ?? "—"} accent="#D4FF00" />
            <StatTile icon={<ChartBar size={11} />} label="Posts published" value={snapshot?.stats.contentPosted ?? "—"} accent="#ffc062" />
          </div>
        </div>
      </div>

      {snapshotError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-600">
          Snapshot failed to load — {snapshotError}. The canvas will run on
          live data only until you reload.
        </div>
      )}

      {/* Main scene + right rail */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="min-w-0 flex-1 relative">
          {/* Subtle particle network behind the office canvas */}
          <NetworkAnimation
            className="absolute inset-0 z-0 rounded-xl opacity-35 pointer-events-none"
            backgroundColor="transparent"
            particleCount={30}
            maxDistance={120}
          />
          <div className="relative z-10">
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
      <div className="border border-border-subtle bg-white/[0.04] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-primary/55">
            Roster
          </div>
          {selectedAgentKey && (
            <button
              onClick={() => setSelectedAgentKey(null)}
              className="text-[10px] text-text-primary/45 underline hover:text-text-primary"
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
        <div className="text-[9px] uppercase tracking-wider text-text-muted">
          {label}
        </div>
        <div className="text-sm font-bold text-white">{value}</div>
      </div>
    </div>
  );
}
