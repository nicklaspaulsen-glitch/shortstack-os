"use client";

/**
 * Admin-only: Tier-1 self-test dashboard.
 *
 * Shows:
 *   - Latest run: pass/fail totals + per-route red/green table + latency.
 *   - Trend: 14-run pass/fail sparkline.
 *   - "Run now" button that kicks /api/cron/self-test with CRON_SECRET.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  ShieldCheck,
  ArrowLeft,
  Lock,
  AlertTriangle,
} from "lucide-react";

interface Row {
  id: string;
  route_path: string;
  method: string;
  expected_status: number | null;
  actual_status: number | null;
  ok: boolean;
  response_shape_match: boolean | null;
  error_text: string | null;
  duration_ms: number;
  checked_at: string;
}

interface LatestResponse {
  latest_run: {
    run_id: string;
    started_at: string;
    rows: Row[];
    passed: number;
    failed: number;
  } | null;
  trend: { run_id: string; started_at: string; pass: number; fail: number }[];
  note?: string;
}

export default function SelfTestDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<LatestResponse | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "failed">("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/self-test/latest");
      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = (await res.json()) as LatestResponse;
      setData(json);
      setState("ok");
    } catch {
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Admin-only: invoke the cron immediately. Needs CRON_SECRET which we can't
  // expose to the browser; the user pastes it once into a localStorage key.
  const runNow = useCallback(async () => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("self_test_cron_secret") : null;
    let secret = stored;
    if (!secret) {
      secret = typeof window !== "undefined"
        ? window.prompt("Paste CRON_SECRET (stored locally for next time):")
        : null;
      if (!secret) return;
      try { localStorage.setItem("self_test_cron_secret", secret); } catch { /* ignore */ }
    }

    setRunning(true);
    const t = toast.loading("Running self-test sweep… up to 2 min.");
    try {
      const res = await fetch("/api/cron/self-test", {
        headers: { authorization: `Bearer ${secret}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          try { localStorage.removeItem("self_test_cron_secret"); } catch { /* ignore */ }
          toast.error("CRON_SECRET rejected — cleared cache, try again.", { id: t });
        } else {
          toast.error(`Run failed: HTTP ${res.status}`, { id: t });
        }
        return;
      }
      const { passed, failed, total } = json as { passed: number; failed: number; total: number };
      toast.success(`Done — ${passed}/${total} passed, ${failed} failed.`, { id: t });
      await load();
    } catch (err) {
      toast.error(`Run threw: ${String(err).slice(0, 80)}`, { id: t });
    } finally {
      setRunning(false);
    }
  }, [load]);

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
        Loading self-test results…
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">The self-test dashboard is admin-gated.</p>
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
        <h1 className="text-lg font-bold">Couldn&apos;t load self-test results</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const { latest_run, trend, note } = data;
  const total = latest_run ? latest_run.passed + latest_run.failed : 0;
  const allGreen = latest_run ? latest_run.failed === 0 : false;
  const bannerGradient: "purple" | "sunset" | "gold" = !latest_run
    ? "gold"
    : allGreen
      ? "purple"
      : "sunset";

  const visibleRows = latest_run
    ? filter === "failed"
      ? latest_run.rows.filter((r) => !r.ok)
      : latest_run.rows
    : [];

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-5">
      <PageHero
        icon={<ShieldCheck size={28} />}
        title="Self-Test (Tier 1)"
        subtitle="Nightly API contract check — every public route hit with fixtures, status + shape asserted."
        gradient={bannerGradient}
        eyebrow="Admin · Bug-hunt agent"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={runNow}
              disabled={running || refreshing}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/15 border border-white/30 text-white/95 hover:bg-white/25 disabled:opacity-50 font-medium"
            >
              <Play size={12} className={running ? "animate-pulse" : ""} />
              {running ? "Running…" : "Run now"}
            </button>
            <button
              onClick={load}
              disabled={refreshing || running}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Loading…" : "Refresh"}
            </button>
          </div>
        }
      />

      {/* Verdict banner */}
      {!latest_run ? (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-gold shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-foreground">No runs yet</div>
            <div className="text-[11px] text-muted mt-0.5">
              {note || "Click 'Run now' to kick the first sweep, or wait for the 03:15 UTC cron."}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 ${
            allGreen
              ? "border-success/30 bg-success/5"
              : "border-danger/30 bg-danger/5"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              allGreen ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
            }`}
          >
            {allGreen ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground">
              {allGreen ? "All routes green" : `${latest_run.failed} failing route${latest_run.failed === 1 ? "" : "s"}`}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              {latest_run.passed}/{total} passed · last run {new Date(latest_run.started_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Trend */}
      {trend.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-bold mb-3 text-foreground">Last 14 runs</h2>
          <div className="flex items-end gap-1 h-12">
            {trend.map((t) => {
              const total = t.pass + t.fail;
              const failPct = total > 0 ? (t.fail / total) * 100 : 0;
              const height = Math.max(10, Math.min(100, (total / 40) * 100));
              return (
                <div
                  key={t.run_id}
                  className="flex-1 rounded-t relative group"
                  style={{
                    height: `${height}%`,
                    background: failPct > 0
                      ? `linear-gradient(to top, rgb(239 68 68 / 0.6) ${failPct}%, rgb(34 197 94 / 0.5) ${failPct}%)`
                      : "rgb(34 197 94 / 0.5)",
                  }}
                  title={`${new Date(t.started_at).toLocaleString()} · ${t.pass} pass / ${t.fail} fail`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Results table */}
      {latest_run && (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Route results</h2>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                onClick={() => setFilter("all")}
                className={`px-2 py-1 rounded ${filter === "all" ? "bg-surface-light text-foreground" : "text-muted"}`}
              >
                All ({latest_run.rows.length})
              </button>
              <button
                onClick={() => setFilter("failed")}
                className={`px-2 py-1 rounded ${filter === "failed" ? "bg-danger/20 text-danger" : "text-muted"}`}
              >
                Failed ({latest_run.failed})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-light text-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-left px-4 py-2 font-medium">Route</th>
                  <th className="text-right px-4 py-2 font-medium">Expected</th>
                  <th className="text-right px-4 py-2 font-medium">Actual</th>
                  <th className="text-right px-4 py-2 font-medium">Latency</th>
                  <th className="text-left px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <XCircle size={12} /> FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-muted">{r.method}</td>
                    <td className="px-4 py-2 font-mono text-foreground">{r.route_path}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted">{r.expected_status ?? "–"}</td>
                    <td className={`px-4 py-2 text-right font-mono ${r.ok ? "text-foreground" : "text-danger"}`}>
                      {r.actual_status ?? "ERR"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted">{r.duration_ms}ms</td>
                    <td className="px-4 py-2 text-[10px] text-muted max-w-xs truncate" title={r.error_text || ""}>
                      {r.error_text || "—"}
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted text-[11px]">
                      {filter === "failed" ? "No failures — everything is green." : "No rows."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
