"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, TrendingUp, Trophy } from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALL_PLATFORMS, PLATFORM_META } from "@/lib/social-studio/constants";
import type {
  HeatmapCell,
  PlatformWeeklyCount,
  TopPost,
} from "@/lib/social-studio/types";
import PlatformChip from "./PlatformChip";

interface StatsResponse {
  weekly: PlatformWeeklyCount[];
  top_posts: TopPost[];
  heatmap: HeatmapCell[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function intensityColor(v: number): string {
  if (v <= 0) return "rgba(161,161,170,0.05)";
  // Map 0..1 onto a soft gold ramp.
  const alpha = 0.1 + v * 0.7;
  return `rgba(201, 168, 76, ${alpha.toFixed(3)})`;
}

export default function Tab4Stats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/social/stats");
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const json = (await res.json()) as StatsResponse;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const weeklyForChart = useMemo(() => {
    if (!data) return [];
    return data.weekly.map((w) => {
      const label = (() => {
        const d = new Date(w.week);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      })();
      return { ...w, label };
    });
  }, [data]);

  const heatmapByDay = useMemo(() => {
    if (!data) return [] as HeatmapCell[][];
    const grid: HeatmapCell[][] = Array.from({ length: 7 }, () => []);
    for (const cell of data.heatmap) {
      grid[cell.day].push(cell);
    }
    for (const row of grid) row.sort((a, b) => a.hour - b.hour);
    return grid;
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-surface p-8 flex items-center justify-center text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" />
        Crunching the numbers…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/40 bg-surface p-8 text-center text-xs text-muted">
        No stats yet — once you publish posts via Zernio they&apos;ll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-gold" />
          <h3 className="text-sm font-semibold tracking-tight">Posts per platform — last 12 weeks</h3>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={weeklyForChart} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,15,15,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {ALL_PLATFORMS.map((p) => (
                <Area
                  key={p}
                  dataKey={p}
                  stackId="1"
                  fill={PLATFORM_META[p].color}
                  stroke={PLATFORM_META[p].color}
                  fillOpacity={0.35}
                  strokeOpacity={0.8}
                  name={PLATFORM_META[p].label}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/40 bg-surface p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-gold" />
            <h3 className="text-sm font-semibold tracking-tight">Top posts by engagement</h3>
          </div>
          {data.top_posts.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">
              No published posts in the last 12 weeks.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="text-left py-2 font-medium">Post</th>
                  <th className="text-left py-2 font-medium">Platforms</th>
                  <th className="text-left py-2 font-medium">Published</th>
                  <th className="text-right py-2 font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {data.top_posts.map((p) => (
                  <tr key={p.id} className="border-t border-border/20 hover:bg-elevated/40">
                    <td className="py-2 pr-2 max-w-[260px] truncate" title={p.caption ?? ""}>
                      {p.caption ?? "(no caption)"}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {p.platforms.map((pl) => <PlatformChip key={pl} platform={pl} />)}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-muted">
                      {p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 text-right font-medium">{p.engagement_total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-border/40 bg-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-gold" />
            <h3 className="text-sm font-semibold tracking-tight">Best post times</h3>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Day × hour heatmap — colour intensity scales with engagement of posts published in that slot.
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid" style={{ gridTemplateColumns: "32px repeat(24, minmax(14px, 1fr))", gap: 2 }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-[8px] text-muted text-center">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
                {heatmapByDay.map((row, dayIdx) => (
                  <div key={dayIdx} className="contents">
                    <div className="text-[10px] text-muted self-center">{DAYS[dayIdx]}</div>
                    {row.map((cell) => (
                      <div
                        key={`${cell.day}-${cell.hour}`}
                        title={`${DAYS[cell.day]} ${cell.hour}:00 — ${cell.count} engagement`}
                        className="rounded-sm border border-border/20"
                        style={{
                          height: 18,
                          background: intensityColor(cell.intensity),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
