"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { X, ArrowUpRight, Activity, AlertTriangle, Clock, Zap } from "lucide-react";
import type { AgentDef } from "./roster";
import type { AgentStatus } from "./agent-avatar";

interface RunInfo {
  last_run_at: string | null;
  last_status: string | null;
  last_description: string | null;
  error_count_1h: number;
  total_runs_1h: number;
}

interface Props {
  agent: AgentDef | null;
  status: AgentStatus;
  integrationEnvStatus?: "ok" | "missing";
  run: RunInfo | null;
  onClose: () => void;
}

// Slide-in right-side drawer. Shows the agent's role, latest activity,
// error count, and either a "Open agent" link (workers) or a "Configure"
// hint (integrations missing env).
export default function AgentDrawer({ agent, status, integrationEnvStatus, run, onClose }: Props) {
  return (
    <AnimatePresence>
      {agent && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-label={`${agent.name} details`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-slate-950 border-l border-white/10 z-50 overflow-y-auto"
          >
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-2xl">
                    {agent.emoji}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{agent.name}</h2>
                    <p className="text-xs text-white/60">{agent.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status pill */}
              <StatusPill status={status} />

              {/* Integration env-var hint */}
              {agent.kind !== "worker" && integrationEnvStatus === "missing" && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    Missing environment variables — the integration is
                    offline until you set them in Vercel.
                  </div>
                </div>
              )}

              {/* Runs summary */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  icon={<Zap size={12} />}
                  label="Runs / hr"
                  value={run?.total_runs_1h ?? 0}
                  tint="text-emerald-400"
                />
                <StatCard
                  icon={<AlertTriangle size={12} />}
                  label="Errors / hr"
                  value={run?.error_count_1h ?? 0}
                  tint={run && run.error_count_1h > 0 ? "text-red-400" : "text-white/70"}
                />
                <StatCard
                  icon={<Clock size={12} />}
                  label="Last seen"
                  value={run?.last_run_at ? relativeTime(run.last_run_at) : "—"}
                  tint="text-white/70"
                  small
                />
              </div>

              {/* Last description */}
              {run?.last_description && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">
                    Most recent activity
                  </h3>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs leading-relaxed">
                    <p>{run.last_description}</p>
                    {run.last_status && (
                      <p className="mt-1.5 text-[10px] text-white/50">
                        status: {run.last_status}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {agent.href && (
                <Link
                  href={agent.href}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold/15 border border-gold/30 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/25 transition-colors"
                >
                  Open {agent.name}
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusPill({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { bg: string; label: string; icon: React.ReactNode }> = {
    live: {
      bg: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
      label: "Live — ran in the last 5 min",
      icon: <Activity size={12} />,
    },
    recent: {
      bg: "bg-amber-400/15 text-amber-300 border-amber-400/30",
      label: "Recent — ran in the last hour",
      icon: <Clock size={12} />,
    },
    idle: {
      bg: "bg-white/5 text-white/60 border-white/10",
      label: "Idle — no runs in the last hour",
      icon: <Clock size={12} />,
    },
    error: {
      bg: "bg-red-400/15 text-red-300 border-red-400/30",
      label: "Error — half or more recent runs failed",
      icon: <AlertTriangle size={12} />,
    },
    disabled: {
      bg: "bg-slate-700/50 text-slate-300 border-slate-600/40",
      label: "Disabled — no credentials configured",
      icon: <AlertTriangle size={12} />,
    },
  };
  const s = map[status];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${s.bg}`}>
      {s.icon}
      {s.label}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint: string;
  small?: boolean;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
      <div className={`flex items-center gap-1 ${tint}`}>
        {icon}
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`${small ? "text-xs" : "text-lg"} font-semibold mt-0.5`}>{value}</p>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
}
