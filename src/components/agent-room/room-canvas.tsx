"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENTS, ZONES, absolutePosition, type AgentDef } from "./roster";
import AgentAvatar, { type AgentStatus } from "./agent-avatar";
import AgentDrawer from "./agent-drawer";
import { RefreshCw, Loader2 } from "lucide-react";

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
  agents: Record<string, RunInfo>;
  integrations: Record<string, "ok" | "missing">;
}

// Map zone colors to tailwind gradient stops used for the zone backgrounds.
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

export default function RoomCanvas() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentDef | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/agent-room/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStatus();
    // 15-second polling — cheap (single indexed trinity_log query + env
    // reads) and keeps the room feeling alive.
    const interval = setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { statusByAgent, counts } = useMemo(() => {
    const map: Record<string, AgentStatus> = {};
    let live = 0, recent = 0, idle = 0, err = 0, disabled = 0;
    for (const agent of AGENTS) {
      const log = data?.agents[agent.id];
      const envGate = data?.integrations[agent.id];

      let status: AgentStatus;
      if (envGate === "missing") {
        status = "disabled";
      } else if (log) {
        status = log.status;
      } else {
        status = "idle";
      }
      map[agent.id] = status;
      if (status === "live") live++;
      else if (status === "recent") recent++;
      else if (status === "idle") idle++;
      else if (status === "error") err++;
      else disabled++;
    }
    return { statusByAgent: map, counts: { live, recent, idle, err, disabled } };
  }, [data]);

  const selectedRun = selected && data?.agents[selected.id] ? data.agents[selected.id] : null;
  const selectedEnv = selected ? data?.integrations[selected.id] : undefined;
  const selectedStatus = selected ? statusByAgent[selected.id] ?? "idle" : "idle";

  return (
    <>
      {/* Legend bar */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-white/70">
        <LegendDot color="bg-emerald-400" label={`Live (${counts.live})`} />
        <LegendDot color="bg-amber-400" label={`Recent (${counts.recent})`} />
        <LegendDot color="bg-white/30" label={`Idle (${counts.idle})`} />
        <LegendDot color="bg-red-400" label={`Error (${counts.err})`} />
        <LegendDot color="bg-slate-500" label={`Disabled (${counts.disabled})`} />
        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/50">
          {loading ? (
            <>
              <Loader2 size={11} className="animate-spin" /> Loading…
            </>
          ) : error ? (
            <span className="text-red-400">Live feed offline: {error}</span>
          ) : (
            <>
              <RefreshCw size={11} className="animate-[spin_15s_linear_infinite]" />
              Auto-refresh every 15s
            </>
          )}
        </div>
      </div>

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
            <pattern id="room-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#room-grid)" />
        </svg>

        {/* Zones */}
        {ZONES.map(zone => (
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
        {AGENTS.map(agent => {
          const pos = absolutePosition(agent);
          return (
            <AgentAvatar
              key={agent.id}
              agent={agent}
              status={statusByAgent[agent.id]}
              x={pos.x}
              y={pos.y}
              onClick={() => setSelected(agent)}
              selected={selected?.id === agent.id}
            />
          );
        })}
      </div>

      {/* Drawer */}
      <AgentDrawer
        agent={selected}
        status={selectedStatus}
        integrationEnvStatus={selectedEnv}
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
