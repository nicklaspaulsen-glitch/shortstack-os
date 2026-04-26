"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { ShieldCheck, CheckCircle, XCircle, Terminal, TrendingUp, TrendingDown, Minus, Play, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface TestResult {
  id: string;
  run_id: string;
  run_started_at: string;
  route_path: string;
  method: string;
  expected_status: number;
  actual_status: number;
  ok: boolean;
  response_shape_match: boolean | null;
  error_text: string | null;
  duration_ms: number | null;
  checked_at: string;
}

interface RouteSummary {
  route_path: string;
  method: string;
  latest: TestResult;
  total: number;
  passed: number;
  recentRuns: boolean[];
  trend: "up" | "down" | "flat";
}

function Sparkline({ runs }: { runs: boolean[] }) {
  const w = 60, h = 20, dotR = 3;
  if (runs.length === 0) return null;
  const step = runs.length > 1 ? (w - dotR * 2) / (runs.length - 1) : 0;
  return (
    <svg width={w} height={h} className="inline-block shrink-0">
      {runs.map((ok, i) => (
        <circle key={i} cx={dotR + i * step} cy={ok ? 5 : 15} r={dotR} fill={ok ? "#34d399" : "#f87171"} />
      ))}
      {runs.map((ok, i) =>
        i < runs.length - 1 ? (
          <line
            key={`l${i}`}
            x1={dotR + i * step} y1={ok ? 5 : 15}
            x2={dotR + (i + 1) * step} y2={runs[i + 1] ? 5 : 15}
            stroke={ok && runs[i + 1] ? "#34d399" : "#f87171"}
            strokeWidth={1.5} strokeOpacity={0.5}
          />
        ) : null
      )}
    </svg>
  );
}

export default function AgentSupervisorPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("self_test_results")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(500);
    setResults((data as TestResult[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Admin trigger — calls /api/admin/self-test/run which re-invokes the
  // cron server-side with CRON_SECRET. Sweep takes 30-60s; we keep the
  // button busy and reload results when it returns.
  const runNow = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const t = toast.loading("Running self-test sweep — ~60s…");
    try {
      const res = await fetch("/api/admin/self-test/run", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Self-test failed (HTTP ${res.status})`, { id: t });
      } else {
        const passed = json?.result?.passed ?? "?";
        const failed = json?.result?.failed ?? "?";
        toast.success(`Self-test done: ${passed} passing, ${failed} failing`, { id: t });
        await load();
      }
    } catch (err) {
      toast.error(`Network error: ${String(err).slice(0, 80)}`, { id: t });
    } finally {
      setRunning(false);
    }
  }, [load, running]);

  // Build per-route summary
  const summaryMap: Record<string, RouteSummary> = {};
  for (const r of results) {
    const key = `${r.method}:${r.route_path}`;
    if (!summaryMap[key]) {
      summaryMap[key] = { route_path: r.route_path, method: r.method, latest: r, total: 0, passed: 0, recentRuns: [], trend: "flat" };
    }
    const s = summaryMap[key];
    s.total++;
    if (r.ok) s.passed++;
    if (s.recentRuns.length < 10) s.recentRuns.push(r.ok);
  }
  for (const s of Object.values(summaryMap)) {
    const half = Math.floor(s.recentRuns.length / 2);
    if (half > 0) {
      const first = s.recentRuns.slice(0, half).filter(Boolean).length / half;
      const second = s.recentRuns.slice(half).filter(Boolean).length / half;
      s.trend = second > first ? "up" : second < first ? "down" : "flat";
    }
  }

  const routes = Object.values(summaryMap).sort((a, b) => {
    if (!a.latest.ok && b.latest.ok) return -1;
    if (a.latest.ok && !b.latest.ok) return 1;
    return a.route_path.localeCompare(b.route_path);
  });

  const totalPass = routes.filter(r => r.latest.ok).length;
  const totalFail = routes.filter(r => !r.latest.ok).length;
  const latestRunAt = results[0] ? new Date(results[0].run_started_at).toLocaleString() : null;

  return (
    <div className="space-y-6">
      <PageHero
        title="Agent Supervisor"
        subtitle="Self-test results per route — latest run, pass/fail counts, trend."
        icon={<ShieldCheck className="w-6 h-6" />}
        gradient="green"
        actions={
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white text-sm font-medium hover:bg-white/25 transition-all disabled:opacity-60"
            title="Run all self-test routes now (~60s)"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Running…" : "Run now"}
          </button>
        }
      />

      {/* Trigger callout */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
        <Terminal className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Run tests:</span>{" "}
          Use the &quot;Run now&quot; button above (admin only) — or wait for the
          nightly cron at 03:15 UTC. cURL alternative:
          <code className="ml-2 text-xs bg-black/30 px-2 py-0.5 rounded font-mono">
            curl -X POST /api/cron/self-test -H &quot;Authorization: Bearer $CRON_SECRET&quot;
          </code>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-premium p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="card-premium p-12 text-center text-muted">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-white/60 mb-1">No test results yet</p>
          <p className="text-sm">Run the self-test cron to populate this view.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Routes tested", value: routes.length, cls: "text-white" },
              { label: "Passing", value: totalPass, cls: "text-emerald-400" },
              { label: "Failing", value: totalFail, cls: "text-red-400" },
              { label: "Last run", value: latestRunAt?.split(",")[1]?.trim() ?? "—", cls: "text-white/70" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="card-premium p-4 text-center">
                <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                <div className="text-xs text-muted mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="card-premium overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Latest run per route</span>
              {latestRunAt && <span className="text-xs text-muted">Run at {latestRunAt}</span>}
            </div>
            <div className="divide-y divide-white/5">
              {routes.map(r => (
                <div key={`${r.method}:${r.route_path}`} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
                  {r.latest.ok
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60 shrink-0">{r.method}</span>
                  <span className="text-sm text-white/90 font-mono flex-1 min-w-0 truncate">{r.route_path}</span>
                  <div className="flex items-center gap-3 text-xs text-muted shrink-0">
                    <span>
                      {r.latest.expected_status} →{" "}
                      <span className={r.latest.ok ? "text-emerald-400" : "text-red-400"}>{r.latest.actual_status}</span>
                    </span>
                    {r.latest.duration_ms != null && <span>{r.latest.duration_ms}ms</span>}
                    <span className="text-white/50">{r.passed}/{r.total} ok</span>
                    <Sparkline runs={[...r.recentRuns].reverse()} />
                    {r.trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                    {r.trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    {r.trend === "flat" && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                  {r.latest.error_text && (
                    <div className="w-full text-xs text-red-400/70 font-mono bg-red-500/5 px-2 py-1 rounded truncate">
                      {r.latest.error_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
