"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLIENT_AGENTS,
  CLIENT_ZONES,
  clientAbsolutePosition,
  type ClientAgentDef,
} from "./client-roster";
import AgentAvatar, { type AgentStatus } from "./agent-avatar";
import AgentDrawer from "./agent-drawer";
import { RefreshCw, Loader2 } from "lucide-react";
import type { AgentDef } from "./roster";

// Client-portal variant of room-canvas.tsx. Same visual engine — drifting
// avatars in coloured zones, status pulled from a backend rollup, click-to-
// drawer — but scoped to a single client's view of work being done FOR them.
//
// Differences from the agency version:
//   - Reads /api/agent-room/client-status?client_id=… (not the global one)
//   - Uses CLIENT_AGENTS / CLIENT_ZONES (client-friendly subset)
//   - Drops the "Disabled (env-var missing)" track — clients shouldn't see
//     infra plumbing, so there's no disabled tier in the legend
//   - Reuses agent-avatar.tsx and agent-drawer.tsx as-is for layout polish

interface RunInfo {
  id: string;
  status: AgentStatus;
  last_run_at: string | null;
  last_status: string | null;
  last_description: string | null;
  error_count_1h: number;
  total_runs_1h: number;
}

interface ApiResponse {
  generated_at: string;
  client_id: string;
  agents: Record<string, RunInfo>;
  integrations: Record<string, "ok" | "missing">;
}

const ZONE_GRADIENT: Record<string, string> = {
  emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  purple: "from-purple-500/20 via-purple-500/5 to-transparent",
  blue: "from-blue-500/20 via-blue-500/5 to-transparent",
  amber: "from-amber-500/20 via-amber-500/5 to-transparent",
  rose: "from-rose-500/20 via-rose-500/5 to-transparent",
};

const ZONE_BORDER: Record<string, string> = {
  emerald: "border-emerald-400/20",
  purple: "border-purple-400/20",
  blue: "border-blue-400/20",
  amber: "border-amber-400/20",
  rose: "border-rose-400/20",
};

interface Props {
  clientId: string;
  /** Display name shown above the room ("Acme Co's room"). Optional. */
  clientName?: string | null;
}

export default function ClientRoomCanvas({ clientId, clientName }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClientAgentDef | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/agent-room/client-status?client_id=${encodeURIComponent(clientId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clientId]);

  const { statusByAgent, counts } = useMemo(() => {
    const map: Record<string, AgentStatus> = {};
    let live = 0,
      recent = 0,
      idle = 0,
      err = 0;
    for (const agent of CLIENT_AGENTS) {
      const log = data?.agents[agent.id];
      const status: AgentStatus = log ? log.status : "idle";
      map[agent.id] = status;
      if (status === "live") live++;
      else if (status === "recent") recent++;
      else if (status === "error") err++;
      else idle++;
    }
    return { statusByAgent: map, counts: { live, recent, idle, err } };
  }, [data]);

  const selectedRun =
    selected && data?.agents[selected.id] ? data.agents[selected.id] : null;
  const selectedStatus = selected
    ? statusByAgent[selected.id] ?? "idle"
    : "idle";

  // The drawer expects an AgentDef shape (zone: ZoneId from the agency
  // roster). The shapes are structurally compatible for everything the
  // drawer renders (id/name/role/href/emoji/kind), so we cast on the way
  // in. The drawer never reads zone — it's a render-time grouping concept
  // owned by the canvas.
  const drawerAgent = selected as unknown as AgentDef | null;

  return (
    <>
      {/* Legend bar */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-white/70">
        <LegendDot color="bg-emerald-400" label={`Live (${counts.live})`} />
        <LegendDot color="bg-amber-400" label={`Recent (${counts.recent})`} />
        <LegendDot color="bg-white/30" label={`Idle (${counts.idle})`} />
        <LegendDot color="bg-red-400" label={`Error (${counts.err})`} />
        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/50">
          {loading ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Loading…
            </>
          ) : error ? (
            <span className="text-red-400">Live feed offline: {error}</span>
          ) : (
            <>
              <RefreshCw
                size={11}
                className="animate-[spin_15s_linear_infinite]"
              />
              Auto-refresh every 15s
            </>
          )}
        </div>
      </div>

      {clientName && (
        <p className="text-[11px] text-muted">
          Live view of every agent working on{" "}
          <span className="font-semibold text-foreground">{clientName}</span>{" "}
          in the last hour.
        </p>
      )}

      {/* Room */}
      <div
        className="relative w-full rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black"
        style={{ aspectRatio: "16 / 9", minHeight: 520 }}
      >
        {/* Floor grid */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden
        >
          <defs>
            <pattern
              id="client-room-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#client-room-grid)" />
        </svg>

        {/* Zones */}
        {CLIENT_ZONES.map((zone) => (
          <div
            key={zone.id}
            className={`absolute rounded-xl border ${ZONE_BORDER[zone.color]} bg-gradient-to-br ${ZONE_GRADIENT[zone.color]}`}
            style={{
              left: `${zone.rect.x}%`,
              top: `${zone.rect.y}%`,
              width: `${zone.rect.w}%`,
              height: `${zone.rect.h}%`,
            }}
          >
            <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
              <span aria-hidden>{zone.icon}</span>
              <span>{zone.label}</span>
            </div>
            <div className="absolute top-7 left-3 text-[9px] text-white/40 max-w-[80%]">
              {zone.description}
            </div>
          </div>
        ))}

        {/* Agents */}
        {CLIENT_AGENTS.map((agent) => {
          const pos = clientAbsolutePosition(agent);
          // agent-avatar.tsx is generic over AgentDef shape — same fields
          // (id/name/emoji), so this cast is structural rather than
          // reshaping data.
          const agentForAvatar = agent as unknown as AgentDef;
          return (
            <AgentAvatar
              key={agent.id}
              agent={agentForAvatar}
              status={statusByAgent[agent.id]}
              x={pos.x}
              y={pos.y}
              onClick={() => setSelected(agent)}
              selected={selected?.id === agent.id}
            />
          );
        })}
      </div>

      {/* Drawer — reuses the agency drawer; renders run info + role + Open
          button when an href is set. */}
      <AgentDrawer
        agent={drawerAgent}
        status={selectedStatus}
        integrationEnvStatus={undefined}
        run={selectedRun}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
