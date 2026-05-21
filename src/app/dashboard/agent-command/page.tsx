"use client";

/**
 * /dashboard/agent-command — Agent Command Center
 *
 * Live dashboard showing everything the autonomous agent system is doing
 * and planning to do. Four panels:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Hero stats (4 counters + loop toggle)              │
 *   ├─────────────────────────┬───────────────────────────┤
 *   │  Live Activity Feed     │  Pipeline Kanban Summary  │
 *   │  (realtime events)      │  (stage counts)           │
 *   ├─────────────────────────┴───────────────────────────┤
 *   │  Task Queue (last 50 tasks — status, type, agent)   │
 *   ├─────────────────────────────────────────────────────┤
 *   │  Work Requests (open client proposals)              │
 *   └─────────────────────────────────────────────────────┘
 *
 * Supabase realtime subscription on `agent_activity_events` keeps the
 * feed live without polling.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MotionPage } from "@/components/motion/motion-page";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type LoopSettings = {
  enabled: boolean;
  max_leads_per_run: number;
  auto_gen_content: boolean;
  auto_publish: boolean;
  notify_telegram: boolean;
  follow_up_day_2: number;
  follow_up_day_3: number;
  last_run_at: string | null;
  last_run_result: Record<string, unknown>;
  paused_until: string | null;
};

type Stats = {
  tasksQueued: number;
  leadsInPipeline: number;
  revenueThisMonth: number;
  activeAgents: number;
};

type Task = {
  id: string;
  task_type: string;
  status: string;
  priority: number;
  agent_key: string | null;
  error_message: string | null;
  pipeline_id: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
};

type Event = {
  id: string;
  agent_key: string;
  event_type: string;
  summary: string;
  created_at: string;
};

type WorkRequest = {
  id: string;
  client_id: string;
  service_type: string;
  brief: string;
  urgency: string;
  proposal_status: string;
  created_at: string;
};

type StageCounts = Record<string, number>;

type CommandData = {
  ownerId: string;
  loopSettings: LoopSettings;
  stats: Stats;
  stageCounts: StageCounts;
  recentTasks: Task[];
  recentEvents: Event[];
  workRequests: WorkRequest[];
};

// ── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "outreach_pending", label: "Pending", color: "text-text-muted" },
  { key: "outreach_sent", label: "Contacted", color: "text-indigo-400" },
  { key: "replied", label: "Replied", color: "text-brand-accent" },
  { key: "qualifying", label: "Qualifying", color: "text-violet-400" },
  { key: "qualified", label: "Qualified", color: "text-success" },
  { key: "scripting", label: "Scripting", color: "text-yellow-400" },
  { key: "content_ready", label: "Content Ready", color: "text-orange-400" },
  { key: "closed", label: "Closed", color: "text-brand-accent" },
  { key: "editing", label: "Editing", color: "text-pink-400" },
  { key: "payment_sent", label: "Invoice Sent", color: "text-emerald-400" },
  { key: "delivered", label: "Delivered", color: "text-success" },
  { key: "dead", label: "Dead", color: "text-red-400/60" },
];

const AGENT_COLORS: Record<string, string> = {
  Aria: "text-indigo-400 bg-indigo-400/10",
  NEXUS: "text-violet-400 bg-violet-400/10",
  system: "text-text-muted bg-surface-light",
  default: "text-text-secondary bg-surface-light",
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  queued: { color: "text-text-muted", icon: <Clock size={10} /> },
  running: { color: "text-indigo-400", icon: <Loader2 size={10} className="animate-spin" /> },
  completed: { color: "text-success", icon: <CheckCircle2 size={10} /> },
  failed: { color: "text-red-400", icon: <AlertCircle size={10} /> },
  cancelled: { color: "text-text-muted", icon: <AlertCircle size={10} /> },
  skipped: { color: "text-text-muted", icon: <ChevronRight size={10} /> },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function agentChip(key: string | null) {
  const k = key ?? "system";
  const cls = AGENT_COLORS[k] ?? AGENT_COLORS.default;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
      {k}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AgentCommandPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-command");
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as CommandData;
      setData(json);
      setLiveEvents(json.recentEvents);
    } catch (err) {
      console.error("[agent-command] fetch failed:", err);
      toast.error("Failed to load command center");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    // Refresh stats every 30s without full realtime sub needed
    const interval = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!data?.ownerId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`cmd-events-${data.ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_activity_events",
          filter: `agency_owner_id=eq.${data.ownerId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const e = payload.new as unknown as Event;
          setLiveEvents((prev) => [e, ...prev].slice(0, 100));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.ownerId]);

  // Auto-scroll feed
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [liveEvents.length]);

  // ── Loop toggle ────────────────────────────────────────────────────────────

  async function toggleLoop() {
    if (!data) return;
    const newEnabled = !data.loopSettings.enabled;
    setToggling(true);
    try {
      const res = await fetch("/api/agent-command", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) throw new Error("Failed");
      setData((prev) =>
        prev ? { ...prev, loopSettings: { ...prev.loopSettings, enabled: newEnabled } } : prev,
      );
      toast.success(newEnabled ? "Autonomous loop started" : "Loop paused");
    } catch {
      toast.error("Failed to toggle loop");
    } finally {
      setToggling(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-brand-accent" size={24} />
      </div>
    );
  }

  const s = data?.stats ?? { tasksQueued: 0, leadsInPipeline: 0, revenueThisMonth: 0, activeAgents: 0 };
  const loopOn = data?.loopSettings.enabled ?? false;

  return (
    <MotionPage>
      <div className="min-h-screen bg-bg-base text-text-primary px-4 py-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Slim editorial header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">Autonomous</p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
              Agent Command Center
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void fetchData()}
              className="btn-pill-ghost text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => void toggleLoop()}
              disabled={toggling}
              className={`btn-pill text-xs flex items-center gap-1.5 min-w-[120px] ${
                loopOn ? "bg-red-500/20 text-red-400 border border-red-500/30" : ""
              }`}
            >
              {toggling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : loopOn ? (
                <Pause size={12} />
              ) : (
                <Play size={12} />
              )}
              {loopOn ? "Pause Loop" : "Start Loop"}
            </button>
          </div>
        </div>

        {/* ── Loop status strip ──────────────────────────────────────────── */}
        {loopOn && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-accent/[0.08] border border-brand-accent/20 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse shrink-0" />
            <p className="text-xs text-brand-accent font-medium">
              Autonomous loop active — running every 5 minutes
            </p>
            {data?.loopSettings.last_run_at && (
              <span className="text-[10px] text-text-muted ml-auto">
                Last run: {relativeTime(data.loopSettings.last_run_at)}
              </span>
            )}
          </div>
        )}

        {/* ── Hero stats row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Zap size={16} className="text-yellow-400" />}
            label="Tasks Queued"
            value={s.tasksQueued.toString()}
            bg="bg-yellow-400/[0.06]"
            border="border-yellow-400/20"
          />
          <StatCard
            icon={<Users size={16} className="text-brand-accent" />}
            label="Leads in Pipeline"
            value={s.leadsInPipeline.toString()}
            bg="bg-brand-accent/[0.06]"
            border="border-brand-accent/20"
          />
          <StatCard
            icon={<TrendingUp size={16} className="text-success" />}
            label="Revenue (30d)"
            value={fmtCurrency(s.revenueThisMonth)}
            bg="bg-success/[0.06]"
            border="border-success/20"
          />
          <StatCard
            icon={<Activity size={16} className="text-violet-400" />}
            label="Active Agents"
            value={s.activeAgents.toString()}
            bg="bg-violet-400/[0.06]"
            border="border-violet-400/20"
          />
        </div>

        {/* ── Two-column: feed + pipeline ──────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Live activity feed */}
          <div className="lg:col-span-3 glass-panel rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Activity size={14} className="text-brand-accent" />
                Live Activity Feed
              </h2>
              <span className="text-[10px] text-text-muted">
                {liveEvents.length} events
              </span>
            </div>
            <div
              ref={feedRef}
              className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin"
            >
              {liveEvents.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">
                  Waiting for agent activity…
                </p>
              ) : (
                liveEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-border-subtle/40 last:border-0">
                    <div className="shrink-0 mt-0.5">{agentChip(e.agent_key)}</div>
                    <p className="text-[11px] text-text-secondary flex-1 leading-relaxed">
                      {e.summary}
                    </p>
                    <span className="text-[9px] text-text-muted shrink-0 mt-0.5">
                      {relativeTime(e.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pipeline stage counts */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target size={14} className="text-brand-accent" />
              Pipeline Stages
            </h2>
            <div className="flex flex-col gap-1">
              {PIPELINE_STAGES.filter((st) => (data?.stageCounts[st.key] ?? 0) > 0 || st.key === "outreach_pending").map((st) => {
                const count = data?.stageCounts[st.key] ?? 0;
                const total = s.leadsInPipeline || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={st.key} className="flex items-center gap-2">
                    <span className={`text-[10px] w-24 shrink-0 ${st.color}`}>
                      {st.label}
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-accent/50 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Task queue ───────────────────────────────────────────────── */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bot size={14} className="text-brand-accent" />
              Task Queue
            </h2>
            <span className="text-[10px] text-text-muted">
              Last 50 tasks
            </span>
          </div>
          {!data?.recentTasks.length ? (
            <p className="text-xs text-text-muted text-center py-6">
              No tasks yet — start the autonomous loop to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-text-muted text-left border-b border-border-subtle">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Agent</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentTasks ?? []).map((t) => {
                    const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.queued;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border-subtle/40 last:border-0 hover:bg-surface-light/30"
                      >
                        <td className="py-1.5 pr-3 font-mono text-text-secondary">
                          {t.task_type}
                        </td>
                        <td className="py-1.5 pr-3">{agentChip(t.agent_key)}</td>
                        <td className={`py-1.5 pr-3 ${sc.color} flex items-center gap-1`}>
                          {sc.icon}
                          {t.status}
                          {t.error_message && (
                            <span className="text-red-400 truncate max-w-[120px]" title={t.error_message}>
                              : {t.error_message}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {t.duration_ms ? `${(t.duration_ms / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="py-1.5 text-text-muted">
                          {relativeTime(t.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Work requests ────────────────────────────────────────────── */}
        {(data?.workRequests.length ?? 0) > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-brand-accent" />
              <h2 className="text-sm font-semibold">Open Client Work Requests</h2>
              <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-bold">
                {data?.workRequests.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {(data?.workRequests ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-3 bg-surface-light/50 rounded-lg border border-border-subtle"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold capitalize">
                        {r.service_type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          r.urgency === "urgent"
                            ? "bg-red-400/10 text-red-400"
                            : r.urgency === "flexible"
                            ? "bg-text-muted/10 text-text-muted"
                            : "bg-brand-accent/10 text-brand-accent"
                        }`}
                      >
                        {r.urgency}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary truncate">{r.brief}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        r.proposal_status === "sent"
                          ? "bg-success/10 text-success"
                          : r.proposal_status === "generating"
                          ? "bg-yellow-400/10 text-yellow-400"
                          : "bg-surface-light text-text-muted"
                      }`}
                    >
                      {r.proposal_status.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-text-muted">
                      {relativeTime(r.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Loop settings ────────────────────────────────────────────── */}
        <LoopSettings
          settings={data?.loopSettings ?? null}
          onSave={async (patch) => {
            const res = await fetch("/api/agent-command", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            });
            if (!res.ok) throw new Error("Failed");
            await fetchData();
          }}
        />
      </div>
    </MotionPage>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-3`}>
      <div className={`${bg} rounded-lg p-2 shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-display font-bold">{value}</p>
        <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function LoopSettings({
  settings,
  onSave,
}: {
  settings: LoopSettings | null;
  onSave: (patch: Partial<LoopSettings>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [maxLeads, setMaxLeads] = useState(settings?.max_leads_per_run ?? 20);
  const [autoGen, setAutoGen] = useState(settings?.auto_gen_content ?? false);
  const [autoPublish, setAutoPublish] = useState(settings?.auto_publish ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setMaxLeads(settings.max_leads_per_run);
      setAutoGen(settings.auto_gen_content);
      setAutoPublish(settings.auto_publish);
    }
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        max_leads_per_run: maxLeads,
        auto_gen_content: autoGen,
        auto_publish: autoPublish,
      });
      toast.success("Loop settings saved");
      setOpen(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-text-primary"
      >
        <span className="flex items-center gap-2">
          <Zap size={14} className="text-brand-accent" />
          Loop Configuration
        </span>
        <ChevronRight
          size={14}
          className={`text-text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Max leads per run</span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                className="input-base w-full text-sm"
              />
            </label>
            <div className="space-y-2 pt-4">
              <Toggle
                label="Auto-generate content"
                checked={autoGen}
                onChange={setAutoGen}
              />
              <Toggle
                label="Auto-publish approved content"
                checked={autoPublish}
                onChange={setAutoPublish}
                disabled={!autoGen}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="btn-pill text-xs flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Save settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${disabled ? "opacity-40" : ""}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-colors duration-200 relative ${
          checked ? "bg-brand-accent" : "bg-surface-light border border-border-subtle"
        }`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="text-xs text-text-secondary">{label}</span>
    </label>
  );
}
