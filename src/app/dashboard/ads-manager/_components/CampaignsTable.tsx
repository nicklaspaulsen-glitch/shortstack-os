"use client";

/**
 * CampaignsTable — unified campaign list across Meta / Google / TikTok.
 *
 * Features:
 *   - Filter by platform / status / date range
 *   - Sort by any metric (spend, impressions, clicks, ctr, roas, conversions)
 *   - Per-row pause/resume + budget edit
 *   - Bulk select + bulk pause / bulk budget bump
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pause,
  Play,
  Edit3,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  type CampaignRow,
  type CampaignsResponse,
  type Platform,
} from "./types";

type StatusFilter = "all" | "active" | "paused" | "ended";
type SortKey = "spend" | "impressions" | "clicks" | "ctr" | "roas" | "conversions";

const fmt = (n: number) => n.toLocaleString();
const fmtCurrency = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function CampaignsTable() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<string>("");
  const [savingBudget, setSavingBudget] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sort", sortKey);
      params.set("dir", sortDir);

      const res = await fetch(`/api/ads-manager/campaigns?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: CampaignsResponse = await res.json();
      setCampaigns(payload.campaigns);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [platformFilter, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === campaigns.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(campaigns.map((c) => c.id)));
    }
  }

  async function pauseCampaign(c: CampaignRow) {
    try {
      const res = await fetch(`/api/ads-manager/campaigns/${c.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: c.status !== "active" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update campaign");
        return;
      }
      toast.success(c.status === "active" ? "Paused" : "Resumed");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  }

  async function bulkPause(targetStatus: "paused" | "active") {
    if (selected.size === 0) return;
    const verb = targetStatus === "paused" ? "Pausing" : "Resuming";
    const ids = Array.from(selected);
    toast.loading(`${verb} ${ids.length} campaign${ids.length === 1 ? "" : "s"}...`);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/ads-manager/campaigns/${id}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume: targetStatus === "active" }),
        }),
      ),
    );
    toast.dismiss();
    const ok = results.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;
    const fail = results.length - ok;
    if (fail === 0) toast.success(`${verb} ${ok} campaigns`);
    else toast.error(`${ok} succeeded, ${fail} failed`);
    void load();
  }

  async function bulkBudgetBump(pct: number) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const targets = campaigns.filter(
      (c) => ids.includes(c.id) && c.dailyBudget !== null,
    );
    toast.loading(`Adjusting budget on ${targets.length} campaigns...`);
    const results = await Promise.allSettled(
      targets.map((c) =>
        fetch(`/api/ads-manager/campaigns/${c.id}/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyBudget: Math.max(0, (c.dailyBudget ?? 0) * (1 + pct / 100)),
          }),
        }),
      ),
    );
    toast.dismiss();
    const ok = results.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;
    const fail = results.length - ok;
    if (fail === 0) toast.success(`Bumped budget on ${ok} campaigns`);
    else toast.error(`${ok} succeeded, ${fail} failed`);
    void load();
  }

  async function saveBudget(c: CampaignRow) {
    const amount = Number(editingBudget);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a non-negative number");
      return;
    }
    setSavingBudget(true);
    try {
      const res = await fetch(`/api/ads-manager/campaigns/${c.id}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update budget");
        return;
      }
      toast.success("Budget updated");
      setEditingId(null);
      setEditingBudget("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingBudget(false);
    }
  }

  const allChecked = useMemo(
    () => campaigns.length > 0 && selected.size === campaigns.length,
    [campaigns, selected],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as Platform | "all")}
          className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm"
        >
          <option value="all">All platforms</option>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
          <option value="tiktok">TikTok</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm"
        >
          <option value="spend">Sort: Spend</option>
          <option value="impressions">Sort: Impressions</option>
          <option value="clicks">Sort: Clicks</option>
          <option value="ctr">Sort: CTR</option>
          <option value="roas">Sort: ROAS</option>
          <option value="conversions">Sort: Conversions</option>
        </select>

        <button
          onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm hover:bg-white/10"
        >
          {sortDir === "desc" ? "Desc" : "Asc"}
        </button>

        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="ml-auto bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-sm hover:bg-white/10 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded border border-gold/30 bg-gold/[0.04] px-3 py-2 text-sm">
          <span className="text-gold">{selected.size} selected</span>
          <button
            onClick={() => void bulkPause("paused")}
            className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <Pause size={12} /> Pause
          </button>
          <button
            onClick={() => void bulkPause("active")}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <Play size={12} /> Resume
          </button>
          <button
            onClick={() => void bulkBudgetBump(10)}
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            +10% budget
          </button>
          <button
            onClick={() => void bulkBudgetBump(-10)}
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            -10% budget
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted">
          <Loader2 className="animate-spin mr-2" size={16} />
          Loading campaigns...
        </div>
      ) : error ? (
        <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-muted">
          No campaigns match these filters.
        </div>
      ) : (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted bg-white/[0.01]">
              <tr>
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleAll} className="text-muted hover:text-text">
                    {allChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-medium">Campaign</th>
                <th className="text-left px-3 py-2 font-medium">Platform</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Daily</th>
                <th className="text-right px-3 py-2 font-medium">Spend</th>
                <th className="text-right px-3 py-2 font-medium">Impr.</th>
                <th className="text-right px-3 py-2 font-medium">Clicks</th>
                <th className="text-right px-3 py-2 font-medium">CTR</th>
                <th className="text-right px-3 py-2 font-medium">Conv.</th>
                <th className="text-right px-3 py-2 font-medium">ROAS</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleRow(c.id)}
                      className="text-muted hover:text-text"
                    >
                      {selected.has(c.id) ? (
                        <CheckSquare size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 truncate max-w-xs">{c.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: `${PLATFORM_COLORS[c.platform]}1a`,
                        color: PLATFORM_COLORS[c.platform],
                        border: `1px solid ${PLATFORM_COLORS[c.platform]}40`,
                      }}
                    >
                      {PLATFORM_LABELS[c.platform]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        c.status === "active"
                          ? "bg-success/15 text-success"
                          : c.status === "paused"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/5 text-muted"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editingBudget}
                          onChange={(e) => setEditingBudget(e.target.value)}
                          className="w-20 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => void saveBudget(c)}
                          disabled={savingBudget}
                          className="text-success hover:text-success/80 disabled:opacity-50"
                          title="Save"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingBudget("");
                          }}
                          className="text-muted hover:text-text"
                          title="Cancel"
                        >
                          X
                        </button>
                      </div>
                    ) : c.dailyBudget !== null ? (
                      fmtCurrency(c.dailyBudget)
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtCurrency(c.totalSpend)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(c.impressions)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(c.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(c.conversions)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.roas !== null ? `${c.roas.toFixed(2)}x` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => void pauseCampaign(c)}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs hover:bg-white/10"
                        title={c.status === "active" ? "Pause" : "Resume"}
                      >
                        {c.status === "active" ? <Pause size={11} /> : <Play size={11} />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingBudget(String(c.dailyBudget ?? ""));
                        }}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs hover:bg-white/10"
                        title="Edit budget"
                      >
                        <Edit3 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
