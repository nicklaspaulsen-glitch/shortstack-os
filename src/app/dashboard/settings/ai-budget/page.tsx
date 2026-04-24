"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, DollarSign, Database, Pause, Play } from "lucide-react";

interface BudgetRow {
  org_id: string;
  monthly_limit_usd: number;
  current_month_spend_usd: number;
  reset_date: string;
  alert_threshold_pct: number;
  paused: boolean;
  paused_reason: string | null;
  updated_at: string;
}

interface CacheStats {
  totalRows: number;
  rowsWithHits: number;
  totalHits: number;
  hitRatePct: number;
  estOutputTokensSaved: number;
  estUsdSaved: number;
}

interface AlertRow {
  id: string;
  alert_type: string;
  spend_at_alert: number;
  sent_at: string;
  recipient_email: string | null;
}

export default function AiBudgetPage() {
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [draftLimit, setDraftLimit] = useState("");
  const [draftThreshold, setDraftThreshold] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes, aRes] = await Promise.all([
        fetch("/api/ai-budget"),
        fetch("/api/ai-cache/stats"),
        fetch("/api/ai-budget/alerts").catch(() => null),
      ]);
      if (bRes.ok) {
        const j = await bRes.json();
        setBudget(j.budget);
      }
      if (sRes.ok) {
        const j = await sRes.json();
        setStats(j.stats);
      }
      if (aRes?.ok) {
        const j = await aRes.json();
        setAlerts(j.alerts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pct =
    budget && budget.monthly_limit_usd > 0
      ? Math.min(
          100,
          (Number(budget.current_month_spend_usd) /
            Number(budget.monthly_limit_usd)) *
            100
        )
      : 0;

  const togglePause = async () => {
    if (!budget) return;
    const path = budget.paused ? "/api/ai-budget/resume" : "/api/ai-budget/pause";
    const res = await fetch(path, { method: "POST", body: JSON.stringify({}) });
    if (res.ok) {
      toast.success(budget.paused ? "Resumed" : "Paused");
      loadAll();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Failed");
    }
  };

  const saveLimit = async () => {
    const payload: Record<string, number> = {};
    if (draftLimit) payload.monthly_limit_usd = Number(draftLimit);
    if (draftThreshold) payload.alert_threshold_pct = Number(draftThreshold);
    const res = await fetch("/api/ai-budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Updated");
      setShowEditModal(false);
      loadAll();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Failed");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center gap-3">
        <DollarSign className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">AI Budget &amp; Cache</h1>
      </header>

      {/* ── Output Cache ── */}
      <section className="card space-y-3 p-4 rounded-xl border border-border bg-surface">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Database className="h-4 w-4" /> Output Cache
        </h2>
        {loading || !stats ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Hit rate" value={`${stats.hitRatePct}%`} />
            <Stat label="Cached rows" value={stats.totalRows.toLocaleString()} />
            <Stat label="Total hits" value={stats.totalHits.toLocaleString()} />
            <Stat label="Est. saved" value={`$${stats.estUsdSaved.toFixed(2)}`} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Each hit is one Claude API call avoided. Cache rows expire after 7 days.
        </p>
      </section>

      {/* ── Monthly Budget ── */}
      <section className="card space-y-3 p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Monthly Budget</h2>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary text-xs"
              onClick={() => {
                if (!budget) return;
                setDraftLimit(String(budget.monthly_limit_usd));
                setDraftThreshold(String(budget.alert_threshold_pct));
                setShowEditModal(true);
              }}
            >
              Edit limit
            </button>
            <button
              className="btn btn-secondary text-xs flex items-center gap-1"
              onClick={togglePause}
              disabled={!budget}
            >
              {budget?.paused ? (
                <>
                  <Play className="h-3 w-3" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" /> Pause
                </>
              )}
            </button>
          </div>
        </div>
        {budget ? (
          <>
            <div className="h-3 rounded-full bg-surface-light overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>
                ${Number(budget.current_month_spend_usd).toFixed(2)} / $
                {Number(budget.monthly_limit_usd).toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                resets {budget.reset_date}
              </span>
            </div>
            {budget.paused && (
              <p className="flex items-center gap-1 text-sm text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Paused: {budget.paused_reason}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No budget row yet.</p>
        )}
      </section>

      {/* ── Alerts ── */}
      <section className="card space-y-3 p-4 rounded-xl border border-border bg-surface">
        <h2 className="text-lg font-semibold">Recent Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Type</th>
                <th>Spend</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-1">{a.alert_type}</td>
                  <td>${Number(a.spend_at_alert).toFixed(2)}</td>
                  <td>{new Date(a.sent_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-96 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Edit Budget</h3>
            <label className="block text-sm">
              Monthly limit (USD)
              <input
                type="number"
                className="input w-full mt-1"
                value={draftLimit}
                onChange={(e) => setDraftLimit(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Alert threshold (%)
              <input
                type="number"
                className="input w-full mt-1"
                value={draftThreshold}
                onChange={(e) => setDraftThreshold(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-secondary text-xs"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary text-xs" onClick={saveLimit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-light/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
