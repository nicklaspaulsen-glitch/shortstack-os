"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { Monitor, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { getPlatformIcon } from "@/components/ui/platform-icons";

interface AgentService {
  id: string;
  integration_name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  last_check_at: string | null;
  last_healthy_at: string | null;
  error_message: string | null;
  response_time_ms: number | null;
}

function StatusChip({ status }: { status: AgentService["status"] }) {
  const map: Record<string, { cls: string; label: string; icon: typeof CheckCircle }> = {
    healthy: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Healthy", icon: CheckCircle },
    degraded: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Degraded", icon: AlertTriangle },
    down: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Down", icon: XCircle },
    unknown: { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30", label: "Unknown", icon: Clock },
  };
  const { cls, label, icon: Icon } = map[status] ?? map.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AgentDesktopPage() {
  const [agents, setAgents] = useState<AgentService[]>([]);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_health")
      .select("id, integration_name, status, last_check_at, last_healthy_at, error_message, response_time_ms")
      .order("integration_name");
    setAgents((data as AgentService[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleRestart = useCallback(async (agent: AgentService) => {
    setRestarting(r => ({ ...r, [agent.id]: true }));
    await fetch("/api/admin/agent-restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_name: agent.integration_name }),
    });
    setTimeout(() => {
      setRestarting(r => ({ ...r, [agent.id]: false }));
      load();
    }, 1500);
  }, [load]);

  const counts = {
    healthy: agents.filter(a => a.status === "healthy").length,
    degraded: agents.filter(a => a.status === "degraded").length,
    down: agents.filter(a => a.status === "down").length,
    unknown: agents.filter(a => a.status === "unknown").length,
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Agent Desktop"
        subtitle="All deployed AI agents and integrations — status, heartbeat, and controls."
        icon={<Monitor className="w-6 h-6" />}
        gradient="blue"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors border border-white/15"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Healthy", count: counts.healthy, cls: "text-emerald-400" },
          { label: "Degraded", count: counts.degraded, cls: "text-amber-400" },
          { label: "Down", count: counts.down, cls: "text-red-400" },
          { label: "Unknown", count: counts.unknown, cls: "text-slate-400" },
        ].map(({ label, count, cls }) => (
          <div key={label} className="card-premium p-4 text-center">
            <div className={`text-2xl font-bold ${cls}`}>{count}</div>
            <div className="text-xs text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-premium p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
              <div className="h-3 bg-white/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="card-premium p-10 text-center text-muted">
          <Monitor className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No agents found in system_health table.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div key={agent.id} className="card-premium p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Brand icon for the integration. getPlatformIcon
                      normalizes input like "Claude (Anthropic)" /
                      "GoHighLevel" / "ElevenLabs" and falls back to a
                      colored letter tile when no brand match exists. */}
                  <span className="shrink-0 inline-flex">
                    {getPlatformIcon(agent.integration_name, 22)}
                  </span>
                  <span className="font-semibold text-white text-sm truncate">{agent.integration_name}</span>
                </div>
                <StatusChip status={agent.status} />
              </div>

              <div className="space-y-1 text-xs text-muted">
                <div className="flex justify-between">
                  <span>Last heartbeat</span>
                  <span className="text-white/70">{timeAgo(agent.last_check_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last healthy</span>
                  <span className="text-white/70">{timeAgo(agent.last_healthy_at)}</span>
                </div>
                {agent.response_time_ms != null && (
                  <div className="flex justify-between">
                    <span>Response time</span>
                    <span className="text-white/70">{agent.response_time_ms}ms</span>
                  </div>
                )}
              </div>

              {agent.error_message && (
                <div className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20 truncate">
                  {agent.error_message}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleRestart(agent)}
                  disabled={restarting[agent.id]}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-xs font-medium border border-blue-500/25 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${restarting[agent.id] ? "animate-spin" : ""}`} />
                  {restarting[agent.id] ? "Restarting…" : "Restart"}
                </button>
                <Link
                  href="/dashboard/monitor"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium border border-white/10 transition-colors"
                >
                  <Activity className="w-3 h-3" />
                  Logs
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
