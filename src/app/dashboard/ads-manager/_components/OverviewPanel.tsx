"use client";

/**
 * OverviewPanel — top-level Ads Manager dashboard.
 *
 * Renders:
 *   - 4 stat tiles: total spend / active campaigns / avg ROAS / best platform
 *   - Per-platform sub-tiles (Meta / Google / TikTok)
 *   - 30-day spend chart (recharts area chart)
 *   - Top 5 campaigns table
 *
 * Reads from /api/ads-manager/overview.
 */

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, Target, TrendingUp, Trophy, Loader2 } from "lucide-react";
import StatCard from "@/components/ui/stat-card";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  type OverviewResponse,
  type Platform,
} from "./types";

const fmtCurrency = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{
        background: `${PLATFORM_COLORS[platform]}1a`,
        color: PLATFORM_COLORS[platform],
        border: `1px solid ${PLATFORM_COLORS[platform]}40`,
      }}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export default function OverviewPanel() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ads-manager/overview", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: OverviewResponse = await res.json();
        if (!cancelled) {
          setData(payload);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load overview");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <Loader2 className="animate-spin mr-2" size={16} />
        Loading overview...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        Failed to load overview: {error}
      </div>
    );
  }

  const { totals, perPlatform, dailySeries, topCampaigns, bestPlatform } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total spend (30d)"
          value={fmtCurrency(totals.spend)}
          icon={<DollarSign size={14} />}
          premium
        />
        <StatCard
          label="Active campaigns"
          value={totals.campaigns}
          icon={<Target size={14} />}
        />
        <StatCard
          label="Avg ROAS"
          value={totals.roas !== null ? `${totals.roas.toFixed(2)}x` : "-"}
          icon={<TrendingUp size={14} />}
          changeType={totals.roas && totals.roas >= 2 ? "positive" : "neutral"}
        />
        <StatCard
          label="Best platform"
          value={bestPlatform ? PLATFORM_LABELS[bestPlatform] : "-"}
          icon={<Trophy size={14} />}
          premium
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(perPlatform) as Platform[]).map((p) => {
          const pp = perPlatform[p];
          const hasData = pp.spend > 0 || pp.campaigns > 0;
          return (
            <div
              key={p}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
              style={{ borderLeftColor: PLATFORM_COLORS[p], borderLeftWidth: 3 }}
            >
              <div className="flex items-center justify-between mb-2">
                <PlatformBadge platform={p} />
                <span className="text-[11px] text-muted">{pp.campaigns} active</span>
              </div>
              <div className="text-2xl font-semibold mb-1">
                {fmtCurrency(pp.spend)}
              </div>
              <div className="flex gap-3 text-[11px] text-muted">
                <span>
                  CTR: <span className="text-text">{pp.ctr.toFixed(2)}%</span>
                </span>
                <span>
                  ROAS:{" "}
                  <span className="text-text">
                    {pp.roas !== null ? `${pp.roas.toFixed(2)}x` : "-"}
                  </span>
                </span>
              </div>
              {!hasData && (
                <div className="mt-2 text-[11px] text-muted/70">
                  No spend yet - connect or sync.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Last 30 days spend</h3>
          <span className="text-[11px] text-muted">
            {dailySeries.length} days of data
          </span>
        </div>
        {dailySeries.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center">
            No daily metrics in cache yet. The nightly cron at /api/cron/refresh-ads-metrics
            populates this once you have connected accounts.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailySeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                tickLine={false}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,15,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value) => fmtCurrency(Number(value))}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#C9A84C"
                strokeWidth={2}
                fill="url(#spendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-medium">Top 5 campaigns by spend</h3>
        </div>
        {topCampaigns.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center">
            No campaigns yet. Connect Meta, Google, or TikTok in the Connect tab.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted bg-white/[0.01]">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Campaign</th>
                <th className="text-left px-4 py-2 font-medium">Platform</th>
                <th className="text-right px-4 py-2 font-medium">Spend</th>
                <th className="text-right px-4 py-2 font-medium">ROAS</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-2 truncate max-w-xs">{c.name}</td>
                  <td className="px-4 py-2">
                    <PlatformBadge platform={c.platform} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtCurrency(c.spend)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.roas !== null ? `${c.roas.toFixed(2)}x` : "-"}
                  </td>
                  <td className="px-4 py-2 capitalize text-muted">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
