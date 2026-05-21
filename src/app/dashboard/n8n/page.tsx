"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Webhook,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ────────────────────────────────────────────────────────────────────

interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string }>;
  nodes?: Array<{ type: string }>;
}

interface N8NExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status?: "success" | "error" | "running" | "waiting";
}

interface WorkflowWithExecution extends N8NWorkflow {
  lastExecution?: N8NExecution | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchN8NWorkflows(): Promise<WorkflowWithExecution[]> {
  const res = await fetch("/api/n8n/workflows", { cache: "no-store" });
  if (!res.ok) throw new Error(`n8n API error: ${res.status}`);
  const data = (await res.json()) as {
    workflows?: WorkflowWithExecution[];
    error?: string;
  };
  if (data.error) throw new Error(data.error);
  return data.workflows ?? [];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
        active
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-[rgba(99,146,255,0.06)] text-[var(--text-muted)] border border-[var(--border-subtle)]",
      ].join(" ")}
    >
      <span
        className={[
          "w-1.5 h-1.5 rounded-full",
          active ? "bg-emerald-400" : "bg-[var(--text-muted)]",
        ].join(" ")}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ExecutionStatus({
  execution,
}: {
  execution?: N8NExecution | null;
}) {
  if (!execution) {
    return <span className="text-[var(--text-muted)] text-xs">No runs</span>;
  }

  const status = execution.status ?? (execution.finished ? "success" : "running");
  const time = execution.stoppedAt ?? execution.startedAt;
  const timeStr = time
    ? new Date(time).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const cfg = {
    success: { icon: CheckCircle2, color: "text-emerald-400" },
    error: { icon: AlertCircle, color: "text-red-400" },
    running: { icon: Loader2, color: "text-brand-accent" },
    waiting: { icon: Clock, color: "text-yellow-400" },
  }[status] ?? { icon: Clock, color: "text-[var(--text-muted)]" };

  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${cfg.color}`}>
      <Icon
        size={12}
        className={status === "running" ? "animate-spin" : undefined}
      />
      {timeStr}
    </span>
  );
}

function WorkflowRow({ wf }: { wf: WorkflowWithExecution }) {
  const nodeCount = wf.nodes?.length ?? 0;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group border-b border-[var(--border-subtle)] hover:bg-[rgba(99,146,255,0.04)] transition-colors"
    >
      {/* Name + node count */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
            <Webhook size={14} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
              {wf.name}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {nodeCount} node{nodeCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge active={wf.active} />
      </td>

      {/* Last execution */}
      <td className="px-4 py-3">
        <ExecutionStatus execution={wf.lastExecution} />
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        {wf.tags && wf.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {wf.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[rgba(99,146,255,0.08)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
              >
                <Tag size={8} />
                {t.name}
              </span>
            ))}
            {wf.tags.length > 3 && (
              <span className="text-[10px] text-[var(--text-muted)]">
                +{wf.tags.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        )}
      </td>

      {/* Updated */}
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--text-muted)]">
          {new Date(wf.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </td>

      {/* Open in n8n */}
      <td className="px-4 py-3 text-right">
        <a
          href={`${process.env.NEXT_PUBLIC_N8N_URL ?? ""}/workflow/${wf.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-accent hover:text-[#60A5FA] transition-colors opacity-0 group-hover:opacity-100"
        >
          Open
          <ChevronRight size={12} />
        </a>
      </td>
    </motion.tr>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({
  workflows,
}: {
  workflows: WorkflowWithExecution[];
}) {
  const total = workflows.length;
  const active = workflows.filter((w) => w.active).length;
  const inactive = total - active;
  const withErrors = workflows.filter(
    (w) => w.lastExecution?.status === "error",
  ).length;

  const stats = [
    { label: "Total", value: total, color: "text-[var(--text-primary)]" },
    { label: "Active", value: active, color: "text-emerald-400" },
    { label: "Inactive", value: inactive, color: "text-[var(--text-muted)]" },
    { label: "Errors", value: withErrors, color: withErrors > 0 ? "text-red-400" : "text-[var(--text-muted)]" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass-panel rounded-xl px-4 py-3 border border-[var(--border-subtle)]"
        >
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-1">
            {s.label}
          </p>
          <p className={`text-2xl font-semibold font-display ${s.color}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function N8NPage() {
  const [workflows, setWorkflows] = useState<WorkflowWithExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchN8NWorkflows();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const filtered = workflows.filter((w) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && w.active) ||
      (filter === "inactive" && !w.active);
    const matchesSearch =
      !search || w.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <MotionPage>
      {/* ── Slim editorial header ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">Automations</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
            N8N Workflows
          </h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-16 max-w-screen-xl mx-auto">
        {/* Stats */}
        {!loading && !error && workflows.length > 0 && (
          <StatsStrip workflows={workflows} />
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 min-w-0 sm:max-w-xs rounded-lg bg-[var(--bg-surface-1)] border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-brand-accent/50 transition-colors"
          />

          {/* Filter pills */}
          <div className="tab-pill-strip">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`tab-pill capitalize${filter === f ? " active" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="btn-pill-ghost h-9 px-3 flex items-center gap-2 ml-auto"
            title="Refresh"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : undefined}
            />
            <span className="text-xs">Refresh</span>
          </button>

          {/* Open n8n */}
          {process.env.NEXT_PUBLIC_N8N_URL && (
            <a
              href={process.env.NEXT_PUBLIC_N8N_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill h-9 px-3 flex items-center gap-2 text-xs"
            >
              <ExternalLink size={14} />
              Open n8n
            </a>
          )}
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-brand-accent" />
          </div>
        )}

        {!loading && error && (
          <div className="glass-panel rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              Could not connect to n8n
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-4 max-w-sm mx-auto">
              {error}. Make sure <code className="font-mono">N8N_URL</code> and{" "}
              <code className="font-mono">N8N_API_KEY</code> are set in your
              Vercel environment.
            </p>
            <button
              onClick={() => void load()}
              className="btn-pill px-4 py-2 text-xs"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="glass-panel rounded-xl border border-[var(--border-subtle)] px-6 py-16 text-center">
            <Webhook size={32} className="text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">
              {search || filter !== "all"
                ? "No workflows match your filter"
                : "No workflows found in your n8n instance"}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="glass-panel rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {["Workflow", "Status", "Last Run", "Tags", "Updated", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((wf) => (
                  <WorkflowRow key={wf.id} wf={wf} />
                ))}
              </tbody>
            </table>

            <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[rgba(13,17,32,0.4)]">
              <p className="text-[11px] text-[var(--text-muted)]">
                {filtered.length} workflow{filtered.length !== 1 ? "s" : ""}
                {filter !== "all" && ` · filtered by ${filter}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </MotionPage>
  );
}
