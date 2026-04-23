"use client";

/**
 * Admin-only: Launch-readiness system status dashboard.
 *
 * Shows green/yellow/red health for every system Trinity depends on:
 * Supabase, Anthropic, Stripe, cron auth, image generation, publishing, etc.
 *
 * Each check returns one of:
 *   - ok         — env present + live probe succeeded
 *   - configured — env present, no probe (or probe skipped as expensive)
 *   - missing    — required env vars absent
 *   - error      — env present but provider rejected
 *
 * Checks are split into "critical" (blocks launch) vs "optional" (missing
 * just disables that feature). The big banner at the top tells you
 * yes/no whether you're ready to launch.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Lock,
  ArrowLeft,
  Zap,
  Play,
} from "lucide-react";

type Status = "ok" | "configured" | "missing" | "error";

interface CheckResult {
  id: string;
  label: string;
  status: Status;
  detail?: string;
  missing?: string[];
  critical: boolean;
  docs_url?: string;
}

interface StatusGroup {
  category: string;
  checks: CheckResult[];
}

interface StatusResponse {
  success: boolean;
  groups: StatusGroup[];
  summary: {
    blockers: number;
    warnings: number;
    ready_to_launch: boolean;
    cron_probes_stale?: boolean;
    cron_probes_last_run?: string | null;
  };
  checked_at: string;
}

const STATUS_META: Record<Status, { color: string; bg: string; border: string; icon: LucideIcon; label: string }> = {
  ok: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: CheckCircle2, label: "Connected" },
  configured: { color: "text-gold", bg: "bg-gold/10", border: "border-gold/30", icon: CheckCircle2, label: "Configured" },
  missing: { color: "text-muted", bg: "bg-muted/10", border: "border-border", icon: AlertTriangle, label: "Not set" },
  error: { color: "text-danger", bg: "bg-danger/10", border: "border-danger/30", icon: XCircle, label: "Error" },
};

export default function SystemStatusPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [fetchState, setFetchState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [runningProbes, setRunningProbes] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/system-status");
      if (res.status === 403) {
        setFetchState("forbidden");
        return;
      }
      if (!res.ok) {
        setFetchState("error");
        return;
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
      setFetchState("ok");
    } catch {
      setFetchState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Admin-only: kicks the /api/cron/health-check sweep on demand so the
  // Live Probes group reflects current reality instead of waiting for the
  // next 30-minute cron tick.
  const runProbes = useCallback(async () => {
    setRunningProbes(true);
    const t = toast.loading("Running all probes… this can take ~30s");
    try {
      const res = await fetch("/api/system-status/run-probes", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`Probe sweep failed: ${json?.error || `HTTP ${res.status}`}`, { id: t });
        return;
      }
      const checked = typeof json?.checked === "number" ? json.checked : "?";
      const skipped = typeof json?.skipped === "number" ? json.skipped : "?";
      toast.success(`Probes done — checked ${checked}, skipped ${skipped}`, { id: t });
      // Refetch so Live Probes group reflects the new data
      await load();
    } catch (err) {
      toast.error(`Probe sweep threw: ${String(err)}`, { id: t });
    } finally {
      setRunningProbes(false);
    }
  }, [load]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      router.push("/login");
      return;
    }
    if (profile.role !== "admin") {
      setFetchState("forbidden");
      return;
    }
    load();
  }, [authLoading, profile, router, load]);

  if (authLoading || fetchState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Checking systems…
      </div>
    );
  }

  if (fetchState === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">
          System Status is only visible to account admins.
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

  if (fetchState === "error" || !data) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <XCircle size={32} className="text-danger mx-auto" />
        <h1 className="text-lg font-bold">Couldn&apos;t check system status</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const { groups, summary, checked_at } = data;
  const bannerGradient: "purple" | "sunset" | "gold" = summary.ready_to_launch
    ? "purple"
    : summary.blockers > 0
      ? "sunset"
      : "gold";

  return (
    <div className="fade-in max-w-5xl mx-auto space-y-5">
      <PageHero
        icon={<ShieldCheck size={28} />}
        title="System Status"
        subtitle="Live health of every system Trinity depends on. Run this before launch."
        gradient={bannerGradient}
        eyebrow="Admin · Launch readiness"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={runProbes}
              disabled={runningProbes || refreshing}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/15 border border-white/30 text-white/95 hover:bg-white/25 disabled:opacity-50 font-medium"
              title="Invoke the cron health-check sweep now instead of waiting 30 minutes"
            >
              <Play size={12} className={runningProbes ? "animate-pulse" : ""} />
              {runningProbes ? "Running probes…" : "Run All Probes Now"}
            </button>
            <button
              onClick={load}
              disabled={refreshing || runningProbes}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Checking…" : "Re-check"}
            </button>
          </div>
        }
      />

      {/* Launch-readiness verdict banner */}
      <div
        className={`rounded-2xl border p-4 flex items-start gap-3 ${
          summary.ready_to_launch
            ? "border-success/30 bg-success/5"
            : summary.blockers > 0
              ? "border-danger/30 bg-danger/5"
              : "border-gold/30 bg-gold/5"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            summary.ready_to_launch ? "bg-success/20 text-success" : summary.blockers > 0 ? "bg-danger/20 text-danger" : "bg-gold/20 text-gold"
          }`}
        >
          {summary.ready_to_launch ? <CheckCircle2 size={20} /> : summary.blockers > 0 ? <XCircle size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">
            {summary.ready_to_launch
              ? "Ready to launch"
              : summary.blockers > 0
                ? `${summary.blockers} launch-blocker${summary.blockers === 1 ? "" : "s"}`
                : "Optional warnings only"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {summary.ready_to_launch
              ? "All critical systems are online. Optional integrations can be added anytime."
              : summary.blockers > 0
                ? "These systems are required for core functionality. Fix them before going live."
                : `${summary.warnings} optional integration${summary.warnings === 1 ? " is" : "s are"} missing — that feature will be disabled until you set env vars.`}
          </div>
          <div className="text-[10px] text-muted mt-2">
            Last checked {new Date(checked_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.category} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Zap size={14} className="text-gold" />
                {group.category}
              </h2>
              <span className="text-[10px] text-muted">
                {group.checks.filter((c) => c.status === "ok" || c.status === "configured").length}/{group.checks.length} healthy
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.checks.map((check) => {
                const meta = STATUS_META[check.status];
                const Icon = meta.icon;
                return (
                  <div
                    key={check.id}
                    className={`rounded-xl border p-3 ${meta.border} ${meta.bg}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={16} className={`${meta.color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">{check.label}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${meta.color}`}>
                            {meta.label}
                          </span>
                          {check.critical && (check.status === "missing" || check.status === "error") && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-danger bg-danger/10 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        {check.detail && (
                          <div className="text-[10px] text-muted mt-1 leading-relaxed">{check.detail}</div>
                        )}
                        {check.missing && check.missing.length > 0 && (
                          <div className="text-[10px] text-muted mt-1 font-mono break-all">
                            <span className="text-muted-light">Add on Vercel:</span>{" "}
                            {check.missing.map((m, i) => (
                              <span key={m}>
                                <code className="text-foreground bg-black/30 px-1 py-0.5 rounded">{m}</code>
                                {i < check.missing!.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {check.docs_url && (check.status === "missing" || check.status === "error") && (
                          <a
                            href={check.docs_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1 text-[10px] mt-2 font-medium ${meta.color} hover:underline`}
                          >
                            Get credential <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick-action footer */}
      <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-[11px] text-muted">
          Missing env vars? Add them in Vercel → Project Settings → Environment Variables, then redeploy.
        </div>
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 border border-gold/20 font-medium"
        >
          Open Vercel <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
