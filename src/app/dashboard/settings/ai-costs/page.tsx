"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, DollarSign, Zap, Database, TrendingDown, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StatsPayload {
  range: string;
  since: string;
  is_admin: boolean;
  totals: {
    calls: number;
    batched_calls: number;
    cache_hit_calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
    estimated_cost_usd: number;
    baseline_cost_usd: number;
    savings_usd: number;
    savings_pct: number;
  };
  by_endpoint: Array<{ endpoint: string; calls: number; cost: number; savings: number }>;
  by_day: Array<{ date: string; cost: number; savings: number }>;
  recent_jobs: Array<{
    batch_id: string;
    endpoint: string;
    model: string;
    item_count: number;
    status: string;
    successful: number | null;
    failed: number | null;
    submitted_at: string;
    completed_at: string | null;
  }>;
  optimizations_disabled: boolean;
}

function fmtMoney(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AiCostsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-costs/stats?range=${range}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load stats");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            AI cost optimization
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor Anthropic prompt caching (90% off) + Message Batches API (50% off) savings.
          </p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-md border transition ${
                range === r
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                  : "border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {data?.optimizations_disabled && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
          <div>
            <strong className="text-yellow-300">Optimizations disabled.</strong>{" "}
            <span className="text-yellow-100/80">
              DISABLE_AI_OPTIMIZATIONS=true is active — all calls run synchronously without caching
              or batching. Unset to re-enable cost savings.
            </span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading stats…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Headline metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              label="Actual spend"
              value={fmtMoney(data.totals.estimated_cost_usd)}
              sub={`${data.range} · ${data.totals.calls} calls`}
            />
            <MetricCard
              icon={<TrendingDown className="w-4 h-4 text-purple-400" />}
              label="Saved"
              value={fmtMoney(data.totals.savings_usd)}
              sub={`${data.totals.savings_pct}% off baseline`}
              highlight
            />
            <MetricCard
              icon={<Zap className="w-4 h-4 text-yellow-400" />}
              label="Cache hits"
              value={data.totals.cache_hit_calls.toString()}
              sub={`${fmtNum(data.totals.cache_read_tokens)} tokens reused`}
            />
            <MetricCard
              icon={<Database className="w-4 h-4 text-blue-400" />}
              label="Batched calls"
              value={data.totals.batched_calls.toString()}
              sub="50% discount applied"
            />
          </div>

          {/* Baseline vs actual */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">
              Baseline vs. actual (past {data.range})
            </h2>
            <div className="space-y-2">
              <CostBar label="Without optimizations" value={data.totals.baseline_cost_usd} max={data.totals.baseline_cost_usd} color="bg-red-400/40" />
              <CostBar label="With caching + batching" value={data.totals.estimated_cost_usd} max={data.totals.baseline_cost_usd} color="bg-emerald-400/60" />
              <CostBar label="You saved" value={data.totals.savings_usd} max={data.totals.baseline_cost_usd} color="bg-purple-400/60" />
            </div>
          </div>

          {/* By endpoint */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Spend by endpoint</h2>
            {data.by_endpoint.length === 0 ? (
              <p className="text-sm text-gray-500">No AI calls in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-white/5">
                    <th className="py-2 pr-4">Endpoint</th>
                    <th className="py-2 pr-4 text-right">Calls</th>
                    <th className="py-2 pr-4 text-right">Cost</th>
                    <th className="py-2 pr-4 text-right">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_endpoint.map((e) => (
                    <tr key={e.endpoint} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-200">{e.endpoint}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{e.calls}</td>
                      <td className="py-2 pr-4 text-right text-gray-200">{fmtMoney(e.cost)}</td>
                      <td className="py-2 pr-4 text-right text-purple-300">{fmtMoney(e.savings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent batch jobs */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent batch jobs</h2>
            {data.recent_jobs.length === 0 ? (
              <p className="text-sm text-gray-500">No batch jobs submitted yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-white/5">
                    <th className="py-2 pr-4">Endpoint</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Items</th>
                    <th className="py-2 pr-4 text-right">OK / Fail</th>
                    <th className="py-2 pr-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_jobs.map((j) => (
                    <tr key={j.batch_id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-200">{j.endpoint}</td>
                      <td className="py-2 pr-4">
                        <StatusPill status={j.status} />
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300">{j.item_count}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">
                        {j.successful ?? 0} / {j.failed ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-400">
                        {new Date(j.submitted_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Explainer */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-sm text-gray-400 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
              <div>
                <strong className="text-gray-200">Prompt caching:</strong> reusable system
                prompts (Smart Manage 15-action catalog, lead-scoring rubric, daily briefing
                template) are cached server-side by Anthropic — cache hits cost 10% of input rate.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
              <div>
                <strong className="text-gray-200">Message Batches API:</strong> nightly sweeps
                (daily briefings for every admin, lead-scoring of stale leads) are bundled into
                one batch per run for 50% off. Results are applied by the process-batches cron
                every 10 minutes.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-purple-500/30 bg-purple-500/5"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${highlight ? "text-purple-200" : "text-white"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function CostBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-mono">{fmtMoney(value)}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    canceled: "bg-gray-500/15 text-gray-300 border-gray-500/20",
    expired: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
    failed: "bg-red-500/15 text-red-300 border-red-500/20",
  };
  const cls = styles[status] || "bg-white/5 text-gray-300 border-white/10";
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${cls}`}>
      {status}
    </span>
  );
}
