"use client";

/**
 * Admin-only: LLM Router dashboard.
 *
 * Shows:
 *   - Local vs Cloud call counts + percentage split
 *   - Dollars saved (counterfactual: had local calls gone to Haiku)
 *   - Actual cloud spend + fallback rate
 *   - Avg latency per tier
 *   - Last 50 calls with tier/task/model/latency
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import {
  Cpu,
  Cloud,
  DollarSign,
  RefreshCw,
  Lock,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface RecentRow {
  id: string;
  created_at: string;
  tier: "local" | "cloud";
  task_type: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  fallback_used: boolean;
  error_text: string | null;
}

interface StatsResponse {
  totals: {
    calls: number;
    localCount: number;
    cloudCount: number;
    fallbackCount: number;
    localPct: number;
    cloudPct: number;
    costUSD: number;
    savingsUSD: number;
    netMonthlyUSD: number;
    avgLatencyLocalMs: number;
    avgLatencyCloudMs: number;
  };
  recent: RecentRow[];
  routerMode: string;
  since: string;
}

function formatUSD(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default function LLMRouterDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/llm-router/stats");
      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = (await res.json()) as StatsResponse;
      setData(json);
      setState("ok");
    } catch {
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      router.push("/login");
      return;
    }
    if (profile.role !== "admin") {
      setState("forbidden");
      return;
    }
    load();
  }, [authLoading, profile, router, load]);

  if (authLoading || state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Loading LLM router stats…
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">The LLM-router dashboard is admin-gated.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <ArrowLeft size={12} /> Back to Dashboard
        </button>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <XCircle size={32} className="text-danger mx-auto" />
        <h1 className="text-lg font-bold">Couldn&apos;t load router stats</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const { totals, recent, routerMode } = data;
  const noCalls = totals.calls === 0;
  const bannerGradient: "purple" | "sunset" | "gold" = noCalls
    ? "gold"
    : totals.localPct >= 50
      ? "purple"
      : "sunset";

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-5">
      <PageHero
        icon={<Zap size={28} />}
        title="LLM Router"
        subtitle="Local (Ollama/RunPod) for bulk, cloud (Anthropic) for precision. Fallback telemetry + savings tracking."
        gradient={bannerGradient}
        eyebrow={`Admin · Router mode: ${routerMode}`}
        actions={
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Loading…" : "Refresh"}
          </button>
        }
      />

      {noCalls ? (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-gold shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-foreground">No router calls yet (last 30 days)</div>
            <div className="text-[11px] text-muted mt-0.5">
              Hit <code className="px-1 bg-surface-light rounded">/api/llm/bulk</code> or
              run AI lead scoring to start populating this dashboard.
            </div>
          </div>
        </div>
      ) : null}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-wider">
            <Cpu size={12} /> Local
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{totals.localPct}%</div>
          <div className="text-[11px] text-muted mt-0.5">
            {totals.localCount.toLocaleString()} of {totals.calls.toLocaleString()} calls
          </div>
          {totals.avgLatencyLocalMs > 0 && (
            <div className="text-[10px] text-muted mt-2">avg {totals.avgLatencyLocalMs}ms</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-wider">
            <Cloud size={12} /> Cloud
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{totals.cloudPct}%</div>
          <div className="text-[11px] text-muted mt-0.5">
            {totals.cloudCount.toLocaleString()} calls
            {totals.fallbackCount > 0 && (
              <span className="text-gold"> · {totals.fallbackCount} fallbacks</span>
            )}
          </div>
          {totals.avgLatencyCloudMs > 0 && (
            <div className="text-[10px] text-muted mt-2">avg {totals.avgLatencyCloudMs}ms</div>
          )}
        </div>

        <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-success text-[10px] uppercase tracking-wider">
            <DollarSign size={12} /> Saved
          </div>
          <div className="text-2xl font-bold text-success mt-1">
            {formatUSD(totals.savingsUSD)}
          </div>
          <div className="text-[11px] text-muted mt-0.5">last 30 days (vs all-cloud Haiku)</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-wider">
            <DollarSign size={12} /> Cloud spend
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {formatUSD(totals.costUSD)}
          </div>
          <div className="text-[11px] text-muted mt-0.5">actual Anthropic cost</div>
        </div>
      </div>

      {/* Recent calls table */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Recent calls</h2>
          <div className="text-[10px] text-muted">Last 50</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-light text-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Tier</th>
                <th className="text-left px-4 py-2 font-medium">Task</th>
                <th className="text-left px-4 py-2 font-medium">Model</th>
                <th className="text-right px-4 py-2 font-medium">Tokens</th>
                <th className="text-right px-4 py-2 font-medium">Latency</th>
                <th className="text-left px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {r.tier === "local" ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-info/15 text-info">
                        <Cpu size={10} /> local
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${r.fallback_used ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"}`}>
                        <Cloud size={10} /> cloud{r.fallback_used && " (fb)"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-foreground">{r.task_type}</td>
                  <td className="px-4 py-2 font-mono text-muted text-[10px]">{r.model}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">
                    {r.tokens_in}/{r.tokens_out}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{r.latency_ms}ms</td>
                  <td className="px-4 py-2 text-[10px] text-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted text-[11px]">
                    No calls logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[10px] text-muted">
        Kill-switch: set <code className="px-1 bg-surface-light rounded">LLM_ROUTER_MODE=cloud-only</code> to bypass local entirely.
      </div>
    </div>
  );
}
