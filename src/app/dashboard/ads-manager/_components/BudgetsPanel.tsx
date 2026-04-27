"use client";

/**
 * BudgetsPanel — current vs AI-suggested per-platform allocation, with a
 * one-click rebalance button.
 */

import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  type AllocationSlice,
  type BudgetsResponse,
} from "./types";

const fmtCurrency = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface RebalancePayload {
  error?: string;
  applied?: unknown[];
  skipped?: unknown[];
}

export default function BudgetsPanel() {
  const [data, setData] = useState<BudgetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ads-manager/budgets", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: BudgetsResponse = await res.json();
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyRebalance() {
    setApplying(true);
    try {
      const res = await fetch("/api/ads-manager/budgets/rebalance", {
        method: "POST",
      });
      const payload = (await res.json()) as RebalancePayload;
      if (!res.ok) {
        toast.error(payload.error || "Rebalance failed");
        return;
      }
      const applied = payload.applied?.length ?? 0;
      const skipped = payload.skipped?.length ?? 0;
      toast.success(`Applied ${applied} change${applied === 1 ? "" : "s"}, skipped ${skipped}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <Loader2 className="animate-spin mr-2" size={16} />
        Loading budgets...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        Failed to load budgets: {error}
      </div>
    );
  }

  const { current, suggested, rationale, totalDailyBudget } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
            Total active daily budget
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {fmtCurrency(totalDailyBudget)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">
            Across {current.length} platform{current.length === 1 ? "" : "s"}
          </div>
          <div className="text-xs text-muted">
            Captures only campaigns with a daily-budget strategy.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-sm font-medium mb-3">Current allocation</h3>
          {current.length === 0 ? (
            <div className="text-sm text-muted py-12 text-center">
              No active daily-budget campaigns yet.
            </div>
          ) : (
            <AllocationPie slices={current} />
          )}
          <div className="mt-3 space-y-1.5">
            {current.map((s: AllocationSlice) => (
              <AllocationLegendRow key={s.platform} slice={s} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gold/30 bg-gold/[0.04] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium inline-flex items-center gap-1.5">
              <Sparkles size={14} className="text-gold" />
              AI-suggested allocation
            </h3>
            {suggested && suggested.length > 0 && (
              <button
                onClick={() => void applyRebalance()}
                disabled={applying}
                className="inline-flex items-center gap-1 rounded border border-gold/50 bg-gold/20 px-2.5 py-1 text-xs text-gold hover:bg-gold/30 disabled:opacity-50"
              >
                {applying ? (
                  <Loader2 className="animate-spin" size={12} />
                ) : (
                  <ArrowRight size={12} />
                )}
                Apply suggestions
              </button>
            )}
          </div>
          {!suggested || suggested.length === 0 ? (
            <div className="text-sm text-muted py-12 text-center">
              No reallocation suggestion yet. Visit the Insights tab and click
              Generate to ask Claude for one.
            </div>
          ) : (
            <>
              <AllocationPie slices={suggested} />
              <div className="mt-3 space-y-1.5">
                {suggested.map((s: AllocationSlice) => (
                  <AllocationLegendRow key={s.platform} slice={s} />
                ))}
              </div>
              {rationale && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted leading-relaxed">
                  {rationale}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AllocationPie({ slices }: { slices: AllocationSlice[] }) {
  if (slices.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="platform"
          innerRadius={50}
          outerRadius={75}
          stroke="rgba(0,0,0,0.4)"
        >
          {slices.map((s: AllocationSlice) => (
            <Cell key={s.platform} fill={PLATFORM_COLORS[s.platform]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgba(10,10,15,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            fontSize: 11,
          }}
          formatter={(v) => `$${Number(v).toFixed(2)}/day`}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
          formatter={(value: string) =>
            PLATFORM_LABELS[value as keyof typeof PLATFORM_LABELS] || value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AllocationLegendRow({ slice }: { slice: AllocationSlice }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: PLATFORM_COLORS[slice.platform] }}
        />
        {PLATFORM_LABELS[slice.platform]}
      </span>
      <span className="tabular-nums text-muted">
        {fmtCurrency(slice.amount)} / day · {slice.pct.toFixed(1)}%
      </span>
    </div>
  );
}
