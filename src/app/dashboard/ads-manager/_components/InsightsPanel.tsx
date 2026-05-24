"use client";

import { Check, CircleNotch, Lightbulb, Pause, Sparkle, TrendUp, X } from "@phosphor-icons/react";

/**
 * InsightsPanel — AI-generated optimization suggestions plus per-platform
 * time-series charts (spend / conversions / ROAS) over the last 30 days.
 */

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import toast from "react-hot-toast";
import { PLATFORM_COLORS, type InsightsResponse, type SuggestionRow } from "./types";
import AuditScoreCard from "./AuditScoreCard";

const SUGGESTION_LABELS: Record<SuggestionRow["suggestion_type"], string> = {
  reallocate: "Reallocate budget",
  pause: "Pause campaign",
  scale: "Scale up",
  optimize_creative: "Refresh creative",
};

const SUGGESTION_ICONS: Record<SuggestionRow["suggestion_type"], typeof Sparkle> = {
  reallocate: TrendUp,
  pause: Pause,
  scale: TrendUp,
  optimize_creative: Lightbulb,
};

const SUGGESTION_COLORS: Record<SuggestionRow["suggestion_type"], string> = {
  reallocate: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
  pause: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  scale: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  optimize_creative: "text-purple-400 border-purple-500/40 bg-purple-500/10",
};

export default function InsightsPanel() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ads-manager/insights", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: InsightsResponse = await res.json();
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ads-manager/insights/generate", {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || "Failed to generate suggestions");
        return;
      }
      toast.success(`Generated ${payload.generated || 0} suggestions`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function decide(id: string, decision: "accept" | "reject") {
    try {
      const res = await fetch(`/api/ads-manager/insights/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || "Failed to apply decision");
        return;
      }
      toast.success(decision === "accept" ? "Applied" : "Rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <CircleNotch className="animate-spin mr-2" size={16} />
        Loading insights...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        Failed to load insights: {error}
      </div>
    );
  }

  const { suggestions, charts } = data;

  return (
    <div className="space-y-6">
      {/* ── Account health scorecard (claude-ads 200+ checks) ── */}
      <AuditScoreCard />

      <div className="glass rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkle className="text-brand-accent" size={16} />
            <h3 className="text-sm font-medium">AI Optimization Suggestions</h3>
            {suggestions.length > 0 && (
              <span className="text-[11px] text-text-muted">
                ({suggestions.length} pending)
              </span>
            )}
          </div>
          <button
            onClick={() => void generate()}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded border border-[rgba(212,255,0,0.25)] bg-[rgba(212,255,0,0.08)] px-3 py-1.5 text-xs text-brand-accent hover:bg-[rgba(212,255,0,0.14)] disabled:opacity-50"
          >
            {generating ? (
              <CircleNotch className="animate-spin" size={12} />
            ) : (
              <Sparkle size={12} />
            )}
            {generating ? "Analyzing 30 days..." : "Generate suggestions"}
          </button>
        </div>

        {suggestions.length === 0 ? (
          <div className="text-sm text-text-muted py-6 text-center">
            No pending suggestions. Click Generate to analyze the last 30 days
            of campaign data and surface optimisation recs.
          </div>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const Icon = SUGGESTION_ICONS[s.suggestion_type];
              return (
                <li
                  key={s.id}
                  className={`rounded border ${SUGGESTION_COLORS[s.suggestion_type]} px-3 py-2.5`}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={16} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide">
                          {SUGGESTION_LABELS[s.suggestion_type]}
                        </span>
                        {s.platform && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: `${PLATFORM_COLORS[s.platform]}1a`,
                              color: PLATFORM_COLORS[s.platform],
                            }}
                          >
                            {s.platform}
                          </span>
                        )}
                        {s.potential_lift_pct !== null &&
                          s.potential_lift_pct !== undefined && (
                            <span className="text-[10px] text-text-muted ml-auto">
                              +{s.potential_lift_pct.toFixed(1)}% lift
                            </span>
                          )}
                      </div>
                      <p className="text-xs text-text/90 leading-relaxed">
                        {s.rationale || "(no rationale)"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => void decide(s.id, "accept")}
                        className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Check size={11} /> Apply
                      </button>
                      <button
                        onClick={() => void decide(s.id, "reject")}
                        className="inline-flex items-center gap-1 rounded border border-border-subtle bg-[rgba(212, 255, 0,0.04)] px-2 py-1 text-[11px] text-text-muted hover:bg-[rgba(212, 255, 0,0.08)] transition-colors"
                      >
                        <X size={11} /> Dismiss
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PlatformLineChart
          title="Spend over time"
          data={charts.spend}
          formatY={(v) => `$${Number(v)}`}
        />
        <PlatformLineChart
          title="Conversions over time"
          data={charts.conversions}
          formatY={(v) => `${Number(v)}`}
        />
        <PlatformLineChart
          title="ROAS over time"
          data={charts.roas}
          formatY={(v) => `${Number(v).toFixed(1)}x`}
        />
      </div>
    </div>
  );
}

function PlatformLineChart({
  title,
  data,
  formatY,
}: {
  title: string;
  data: Array<{ date: string; meta: number; google: number; tiktok: number }>;
  formatY: (v: number) => string;
}) {
  const empty = data.length === 0 || data.every((d) => !d.meta && !d.google && !d.tiktok);
  return (
    <div className="glass rounded-lg p-4">
      <h4 className="text-xs uppercase tracking-wide text-text-muted mb-3">{title}</h4>
      {empty ? (
        <div className="text-xs text-text-muted py-8 text-center">No data yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 255, 0,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#4A4A5A" }}
              tickLine={false}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#4A4A5A" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatY(Number(v))}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(13,17,32,0.95)",
                border: "1px solid rgba(212, 255, 0,0.18)",
                borderRadius: 6,
                fontSize: 11,
                color: "#F0F0F4",
              }}
              labelStyle={{ color: "#A8A8B2" }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line
              type="monotone"
              dataKey="meta"
              stroke={PLATFORM_COLORS.meta}
              strokeWidth={1.5}
              dot={false}
              name="Meta"
            />
            <Line
              type="monotone"
              dataKey="google"
              stroke={PLATFORM_COLORS.google}
              strokeWidth={1.5}
              dot={false}
              name="Google"
            />
            <Line
              type="monotone"
              dataKey="tiktok"
              stroke={PLATFORM_COLORS.tiktok}
              strokeWidth={1.5}
              dot={false}
              name="TikTok"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
