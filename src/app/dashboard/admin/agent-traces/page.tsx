"use client";

/**
 * Admin/founder agent-traces dashboard.
 *
 * Lists every traced LLM call from `agent_trace_index` (mirror of Langfuse).
 * Each row deep-links into the Langfuse dashboard via `langfuse_url` so
 * deep inspection lives in Langfuse — this page is just for filtering and
 * surface-level health.
 *
 * Filter chips: by surface, by status (success / error / fallback)
 *
 * Stat tiles (24h window): total calls, total cost, error rate, avg latency.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

interface TraceRow {
  id: string;
  langfuse_trace_id: string;
  langfuse_url: string;
  agent_surface: string;
  related_subject_kind: string | null;
  related_subject_id: string | null;
  task_type: string | null;
  total_tokens: number | null;
  total_cost_usd: number | null;
  latency_ms: number | null;
  status: "success" | "error" | "fallback" | null;
  error_message: string | null;
  created_at: string;
}

interface TracesResponse {
  success: boolean;
  data: TraceRow[];
  meta: {
    total: number;
    since: string;
    stats: {
      total_calls: number;
      total_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number;
      error_rate: number;
    };
  };
}

type ViewState = "loading" | "ok" | "forbidden" | "error";

const SURFACE_CHIPS = [
  { id: "all", label: "All surfaces" },
  { id: "cold_email", label: "Cold email" },
  { id: "sales_coach", label: "Sales coach" },
  { id: "trinity_autonomous", label: "Trinity" },
  { id: "outreach_thread_summary", label: "Outreach summary" },
  { id: "lead_research", label: "Lead research" },
] as const;

const STATUS_CHIPS = [
  { id: "all", label: "All statuses" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
  { id: "fallback", label: "Fallback" },
] as const;

function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "$0";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function formatLatency(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AgentTracesDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [resp, setResp] = useState<TracesResponse | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [surface, setSurface] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (surface !== "all") params.set("surface", surface);
      if (status !== "all") params.set("status", status);
      params.set("limit", "100");
      const res = await fetch(`/api/agent-traces?${params.toString()}`);
      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = (await res.json()) as TracesResponse;
      setResp(json);
      setState("ok");
    } catch {
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, [surface, status]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      router.push("/login");
      return;
    }
    if (profile.role !== "admin" && profile.role !== "founder") {
      setState("forbidden");
      return;
    }
    load();
  }, [authLoading, profile, router, load]);

  const stats = useMemo(() => resp?.meta.stats, [resp]);

  if (authLoading || state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Loading agent traces…
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">
          The agent traces dashboard is restricted to admin/founder roles.
        </p>
      </div>
    );
  }

  if (state === "error" || !resp) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <h1 className="text-lg font-bold">Couldn&apos;t load agent traces</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHero
        title="Agent Traces"
        subtitle="Every traced LLM call across ShortStack — latency, cost, errors. Click any row to open the full trace in Langfuse."
        eyebrow="Admin"
        gradient="purple"
        icon={<Activity size={28} />}
        actions={
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {/* Stat tiles (24h window) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="LLM calls (24h)"
          value={(stats?.total_calls ?? 0).toLocaleString()}
          premium
        />
        <StatCard
          label="Total cost (24h)"
          value={formatUsd(stats?.total_cost_usd ?? 0)}
        />
        <StatCard
          label="Error rate (24h)"
          value={`${((stats?.error_rate ?? 0) * 100).toFixed(1)}%`}
          changeType={
            (stats?.error_rate ?? 0) > 0.05
              ? "negative"
              : (stats?.error_rate ?? 0) > 0
                ? "neutral"
                : "positive"
          }
          icon={(stats?.error_rate ?? 0) > 0.05 ? <AlertTriangle size={16} /> : undefined}
        />
        <StatCard
          label="Avg latency"
          value={formatLatency(stats?.avg_latency_ms ?? 0)}
        />
      </div>

      {/* Filter chips */}
      <section className=" border border-border bg-surface p-5 space-y-3">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Surface</p>
          <div className="flex flex-wrap gap-2">
            {SURFACE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setSurface(chip.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  surface === chip.id
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border bg-background/60 text-muted hover:bg-surface-light"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setStatus(chip.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  status === chip.id
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border bg-background/60 text-muted hover:bg-surface-light"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Trace table */}
      <section className=" border border-border bg-surface overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Recent traces</h2>
            <p className="text-[11px] text-muted">
              Showing up to 100. Click a row to open the full trace in Langfuse.
            </p>
          </div>
        </header>
        {resp.data.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs text-muted">
            No traces in this window.
            {!stats?.total_calls && (
              <p className="mt-2">
                If <code className="text-[11px]">LANGFUSE_PUBLIC_KEY</code> /
                <code className="text-[11px]"> LANGFUSE_SECRET_KEY</code> are unset,
                tracing soft-fails (LLM still works, no rows are written).
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Surface</th>
                  <th className="text-left px-4 py-2 font-medium">Task</th>
                  <th className="text-left px-4 py-2 font-medium">Subject</th>
                  <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2 font-medium">Cost</th>
                  <th className="text-right px-4 py-2 font-medium">Latency</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {resp.data.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => window.open(row.langfuse_url, "_blank", "noopener")}
                    className="border-b border-border/40 hover:bg-surface-light cursor-pointer transition"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {formatRelativeTime(row.created_at)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {row.agent_surface}
                        <ExternalLink size={10} className="text-muted" />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{row.task_type ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {row.related_subject_kind
                        ? `${row.related_subject_kind}${
                            row.related_subject_id
                              ? ` · ${row.related_subject_id.slice(0, 8)}`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {(row.total_tokens ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatUsd(row.total_cost_usd)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatLatency(row.latency_ms)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          OK
                        </span>
                      ) : row.status === "error" ? (
                        <span
                          className="inline-flex items-center gap-1 text-danger"
                          title={row.error_message ?? undefined}
                        >
                          <AlertTriangle size={10} /> Error
                        </span>
                      ) : (
                        <span className="text-warning">Fallback</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
