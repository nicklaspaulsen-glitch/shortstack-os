"use client";

/**
 * Admin/founder LLM cost dashboard.
 *
 * Aggregates the `llm_usage_events` table into:
 *   - This-month vs last-month total (with delta)
 *   - Daily spend sparkline (recharts)
 *   - Top tasks by cost
 *   - Top models by cost
 *   - Optimisation hints (e.g. "20% of code_review still on Sonnet — try qwen3-coder")
 *
 * All numbers are USD. The dashboard is gated to role === "admin" or "founder".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  ArrowLeft,
  Lock,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

interface OptimisationHint {
  severity: "low" | "medium" | "high";
  message: string;
  estimated_savings_usd?: number;
}

interface CostsResponse {
  this_month_usd: number;
  last_month_usd: number;
  delta_pct: number;
  total_calls_this_month: number;
  top_tasks: Array<{
    task_type: string;
    cost_usd: number;
    call_count: number;
    avg_cost_usd: number;
  }>;
  top_models: Array<{
    model: string;
    provider: string;
    cost_usd: number;
    call_count: number;
  }>;
  daily_series: Array<{ date: string; cost_usd: number; calls: number }>;
  hints: OptimisationHint[];
}

type ViewState = "loading" | "ok" | "forbidden" | "error";

function formatUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function formatDelta(pct: number): { label: string; type: "positive" | "negative" | "neutral" } {
  if (Number.isNaN(pct) || !Number.isFinite(pct)) return { label: "—", type: "neutral" };
  const arrow = pct >= 0 ? "+" : "";
  // For costs, negative delta is GOOD (saving money). Flip the colours.
  return {
    label: `${arrow}${pct.toFixed(1)}%`,
    type: pct < 0 ? "positive" : pct > 5 ? "negative" : "neutral",
  };
}

const SEVERITY_STYLES: Record<OptimisationHint["severity"], string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-success/40 bg-success/10 text-success",
};

export default function LlmCostsDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CostsResponse | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/llm-costs");
      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = (await res.json()) as CostsResponse;
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
    if (profile.role !== "admin" && profile.role !== "founder") {
      setState("forbidden");
      return;
    }
    load();
  }, [authLoading, profile, router, load]);

  const totalEstimatedSavings = useMemo(() => {
    if (!data) return 0;
    return data.hints.reduce(
      (acc, h) => acc + (h.estimated_savings_usd ?? 0),
      0,
    );
  }, [data]);

  if (authLoading || state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Loading LLM cost dashboard…
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">
          The LLM cost dashboard is restricted to admin/founder roles.
        </p>
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
        <h1 className="text-lg font-bold">Couldn&apos;t load LLM cost data</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const delta = formatDelta(data.delta_pct);

  return (
    <div className="space-y-6 pb-12">
      <PageHero
        title="LLM Cost Dashboard"
        subtitle="Smart routing has saved you real money — see exactly where."
        eyebrow="Admin"
        gradient="purple"
        icon={<Sparkles size={28} />}
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

      {/* Top stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="This month"
          value={formatUsd(data.this_month_usd)}
          icon={<Zap size={16} />}
          premium
        />
        <StatCard
          label="Last month"
          value={formatUsd(data.last_month_usd)}
        />
        <StatCard
          label="Delta vs last month"
          value={delta.label}
          changeType={delta.type}
          icon={delta.type === "positive" ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
        />
        <StatCard
          label="Calls this month"
          value={data.total_calls_this_month.toLocaleString()}
        />
      </div>

      {/* Daily spend sparkline */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Daily spend (this month)</h2>
            <p className="text-[11px] text-muted">USD per UTC day</p>
          </div>
        </header>
        {data.daily_series.length === 0 ? (
          <p className="text-xs text-muted py-8 text-center">
            No usage events yet this month — once the smart router takes over, daily spend will appear here.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_series}>
                <defs>
                  <linearGradient id="spend-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.08} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-muted"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-muted"
                  tickFormatter={(v: number) => formatUsd(v)}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) => formatUsd(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="cost_usd"
                  stroke="#A855F7"
                  fill="url(#spend-gradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Top tasks + Top models — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <header className="mb-4">
            <h2 className="text-sm font-semibold">Top tasks by cost</h2>
            <p className="text-[11px] text-muted">This month</p>
          </header>
          {data.top_tasks.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">
              No task data yet.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_tasks} layout="vertical">
                  <CartesianGrid strokeOpacity={0.08} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickFormatter={(v: number) => formatUsd(v)}
                  />
                  <YAxis
                    dataKey="task_type"
                    type="category"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value) => formatUsd(Number(value))}
                  />
                  <Bar dataKey="cost_usd" fill="#C9A84C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <header className="mb-4">
            <h2 className="text-sm font-semibold">Top models by cost</h2>
            <p className="text-[11px] text-muted">This month</p>
          </header>
          {data.top_models.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">
              No model data yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium text-right">Calls</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_models.map((m) => (
                    <tr key={m.model} className="border-b border-border/40">
                      <td className="py-2 font-mono text-[11px]">{m.model}</td>
                      <td className="py-2 text-muted">{m.provider}</td>
                      <td className="py-2 text-right">{m.call_count.toLocaleString()}</td>
                      <td className="py-2 text-right font-medium">
                        {formatUsd(m.cost_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Optimisation hints */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Optimisation hints</h2>
            <p className="text-[11px] text-muted">
              Heuristic suggestions for cutting spend further
              {totalEstimatedSavings > 0 ? (
                <>
                  {" "}— estimated potential savings: <strong className="text-success">{formatUsd(totalEstimatedSavings)}</strong>
                </>
              ) : null}
            </p>
          </div>
        </header>
        <ul className="space-y-2">
          {data.hints.map((h, idx) => (
            <li
              key={idx}
              className={`text-xs px-3 py-2 rounded-xl border ${SEVERITY_STYLES[h.severity]}`}
            >
              <div className="flex items-start gap-2">
                <span className="uppercase tracking-wide text-[10px] font-semibold opacity-80">
                  {h.severity}
                </span>
                <span className="flex-1">{h.message}</span>
                {typeof h.estimated_savings_usd === "number" && h.estimated_savings_usd > 0 ? (
                  <span className="text-[11px] font-mono whitespace-nowrap">
                    ~{formatUsd(h.estimated_savings_usd)} / mo
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
