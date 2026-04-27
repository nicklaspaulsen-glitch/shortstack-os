"use client";

/**
 * AI Sales Coach — overview page.
 *
 * Three tabs share the same data source (`GET /api/coach/analyses`):
 *   - Recent Calls: list with score badges, click-through to detail.
 *   - By Rep: groups analyses by rep_id, shows trend strip per rep.
 *   - Leaderboard: top reps by avg score this period.
 *
 * The hero uses the gold gradient with the Award icon — coaching is a
 * premium-feel surface, kept consistent with the meetings + voice-receptionist
 * pages on the agency side. No PageHero overrides — this page reads as a
 * sibling of the rest of the dashboard family.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Loader2,
  Sparkles,
  TrendingUp,
  Phone,
  Mail,
  Video,
  ArrowRight,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

interface CoachAnalysisRow {
  id: string;
  source_type: "voice_call" | "meeting" | "email_thread";
  source_id: string;
  rep_id: string | null;
  metrics: Record<string, number>;
  insights: Array<{ category: string; text: string; severity?: number | null }>;
  next_actions: Array<{ text: string; due?: string | null }>;
  overall_score: number | null;
  cost_usd: number | null;
  created_at: string;
}

interface LeaderboardEntry {
  rep_id: string;
  rep_name: string | null;
  rep_email: string | null;
  analyses_count: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
}

interface ListResponse {
  ok: boolean;
  analyses: CoachAnalysisRow[];
  total: number;
  stats: {
    total_analyses: number;
    analyses_this_week: number;
    avg_score: number;
    top_rep_id: string | null;
    top_rep_score: number;
  };
}

interface LeaderboardResponse {
  ok: boolean;
  period: string;
  leaderboard: LeaderboardEntry[];
  total_reps: number;
}

type Tab = "recent" | "by-rep" | "leaderboard";

const SOURCE_ICONS = {
  voice_call: Phone,
  meeting: Video,
  email_thread: Mail,
} as const;

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return iso;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ScoreBadge({ score }: { score: number | null }) {
  const value = score ?? 0;
  const tone =
    value >= 80
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : value >= 60
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
      title={`Coach score: ${value}/100`}
    >
      {value}
    </span>
  );
}

export default function CoachPage() {
  const [tab, setTab] = useState<Tab>("recent");
  const [data, setData] = useState<ListResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "all">("week");

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/analyses?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      console.error("[coach] list failed", err);
      setError(err instanceof Error ? err.message : "Failed to load analyses");
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/coach/leaderboard?period=${period}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = (await res.json()) as LeaderboardResponse;
      setLeaderboard(json);
    } catch (err) {
      console.error("[coach] leaderboard failed", err);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAnalyses(), loadLeaderboard()]).finally(() => setLoading(false));
  }, [loadAnalyses, loadLeaderboard]);

  const repBuckets = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, CoachAnalysisRow[]>();
    for (const row of data.analyses) {
      const key = row.rep_id ?? "__owner";
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([repId, rows]) => ({
      repId,
      rows,
      avg: Math.round(
        rows.reduce((s, r) => s + (r.overall_score ?? 0), 0) / rows.length,
      ),
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHero
        title="AI Sales Coach"
        subtitle="Personalized feedback on every call and email — talk-time, objections, next-best-action."
        gradient="gold"
        icon={<Award className="h-6 w-6" />}
        eyebrow="Coaching"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Calls analyzed this week"
          value={data?.stats.analyses_this_week ?? 0}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Average coach score"
          value={data?.stats.avg_score ?? 0}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Top performer score"
          value={data?.stats.top_rep_score ?? 0}
          icon={<Award className="h-4 w-4" />}
          premium
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-2">
        {(
          [
            { id: "recent", label: "Recent Calls" },
            { id: "by-rep", label: "By Rep" },
            { id: "leaderboard", label: "Leaderboard" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analyses…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && tab === "recent" && data && (
        <div className="space-y-2">
          {data.analyses.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center text-white/60">
              <Sparkles className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p className="text-base font-medium text-white">No analyses yet.</p>
              <p className="mt-1 text-sm">
                The coach runs hourly on new voice calls and meetings. Trigger one manually from a
                call detail page.
              </p>
            </div>
          ) : (
            data.analyses.map((row) => {
              const Icon = SOURCE_ICONS[row.source_type] ?? Sparkles;
              const topInsight = row.insights[0];
              const talkRatio = Math.round(((row.metrics?.talk_ratio ?? 0) as number) * 100);
              return (
                <Link
                  key={row.id}
                  href={`/dashboard/coach/analyses/${row.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/80">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {row.source_type === "voice_call"
                          ? "Voice call"
                          : row.source_type === "meeting"
                            ? "Meeting"
                            : "Email thread"}
                      </span>
                      <span className="text-xs text-white/40">
                        {formatRelativeTime(row.created_at)}
                      </span>
                    </div>
                    {topInsight ? (
                      <p className="truncate text-xs text-white/60">
                        {topInsight.category.replace("_", " ")}: {topInsight.text}
                      </p>
                    ) : (
                      <p className="text-xs text-white/40">No qualitative findings.</p>
                    )}
                  </div>
                  <div className="hidden text-xs text-white/50 sm:block">
                    Talk {talkRatio}%
                  </div>
                  <ScoreBadge score={row.overall_score} />
                  <ArrowRight className="h-4 w-4 text-white/30 transition-colors group-hover:text-white/70" />
                </Link>
              );
            })
          )}
        </div>
      )}

      {!loading && tab === "by-rep" && data && (
        <div className="space-y-3">
          {repBuckets.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-6 py-8 text-center text-white/60">
              No rep-level data yet.
            </div>
          ) : (
            repBuckets.map((bucket) => (
              <div
                key={bucket.repId}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {bucket.repId === "__owner" ? "Unassigned" : bucket.repId.slice(0, 8)}
                    </div>
                    <div className="text-xs text-white/50">
                      {bucket.rows.length} analyses • avg {bucket.avg}
                    </div>
                  </div>
                  <ScoreBadge score={bucket.avg} />
                </div>
                <div className="mt-3 flex items-center gap-1">
                  {bucket.rows.slice(0, 20).reverse().map((row) => {
                    const value = row.overall_score ?? 0;
                    const color = value >= 80 ? "bg-emerald-400" : value >= 60 ? "bg-amber-400" : "bg-rose-400";
                    return (
                      <span
                        key={row.id}
                        title={`${value} • ${formatRelativeTime(row.created_at)}`}
                        className={`h-6 w-1.5 rounded-sm ${color}`}
                        style={{ opacity: 0.4 + (value / 100) * 0.6 }}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && tab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(
              [
                { id: "week", label: "This week" },
                { id: "month", label: "Month" },
                { id: "quarter", label: "Quarter" },
                { id: "all", label: "All time" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  period === p.id
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {!leaderboard || leaderboard.leaderboard.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-6 py-8 text-center text-white/60">
              Leaderboard requires at least 3 analyses per rep. Once your team accumulates more
              calls, rankings will appear here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Rep</th>
                    <th className="px-4 py-2 text-right">Calls</th>
                    <th className="px-4 py-2 text-right">Avg</th>
                    <th className="px-4 py-2 text-right">Best</th>
                    <th className="px-4 py-2 text-right">Worst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.leaderboard.map((entry, idx) => (
                    <tr key={entry.rep_id} className="text-white/80">
                      <td className="px-4 py-3 font-semibold text-white/60">{idx + 1}</td>
                      <td className="px-4 py-3 text-white">
                        {entry.rep_name || entry.rep_email || entry.rep_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-right text-white/70">
                        {entry.analyses_count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreBadge score={entry.avg_score} />
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-300/80">
                        {entry.best_score}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-300/80">
                        {entry.worst_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
