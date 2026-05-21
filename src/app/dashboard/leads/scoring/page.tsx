"use client";

/**
 * AI Lead Scoring — dedicated page.
 *
 * Lives alongside the main leads list (which is intentionally untouched).
 * Renders:
 *   - score-grade kanban summary tiles (cold / warm / hot / customer)
 *   - filterable list with grade pills, sort-by-score, bulk recompute
 *   - per-row tooltip showing the signal breakdown
 *   - drill-down modal: signal weights, AI reasoning, score history chart
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  Loader,
  RefreshCw,
  Flame,
  Snowflake,
  Sun,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import CollapsibleStats from "@/components/ui/collapsible-stats";
import ScoreGradeBadge, {
  gradeFromScore as inferGrade,
  type ScoreGrade,
} from "@/components/ui/score-grade-badge";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { MotionPage } from "@/components/motion/motion-page";

type GradeFilter = "all" | "hot" | "warm" | "cold" | "customer";

interface SignalBreakdown {
  email_opens?: number;
  email_clicks?: number;
  form_submits?: number;
  calls_answered?: number;
  sms_replies?: number;
  page_views?: number;
  pricing_views?: number;
  demo_booked?: number;
  social_engagement?: number;
  recency_multiplier?: number;
}

interface ScoringLead {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  score: number | null;
  score_grade: ScoreGrade | null;
  score_signals: SignalBreakdown | null;
  score_breakdown: Record<string, unknown> | null;
  score_reasoning: string | null;
  score_computed_at: string | null;
  score_updated_at: string | null;
}

interface ScoreEventRow {
  id: string;
  event_type: string;
  prior_score: number | null;
  new_score: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_LIMIT = 50;

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "never";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SignalBreakdownPills({
  breakdown,
}: {
  breakdown: SignalBreakdown | null;
}) {
  if (!breakdown) {
    return (
      <p className="text-[9px] text-text-muted italic">No signals captured yet.</p>
    );
  }
  const entries = [
    { k: "Opens", v: breakdown.email_opens ?? 0 },
    { k: "Clicks", v: breakdown.email_clicks ?? 0 },
    { k: "Forms", v: breakdown.form_submits ?? 0 },
    { k: "Calls", v: breakdown.calls_answered ?? 0 },
    { k: "Replies", v: breakdown.sms_replies ?? 0 },
    { k: "Pageviews", v: breakdown.page_views ?? 0 },
    { k: "Pricing", v: breakdown.pricing_views ?? 0 },
    { k: "Demo", v: breakdown.demo_booked ?? 0 },
    { k: "Social", v: breakdown.social_engagement ?? 0 },
  ].filter((e) => (e.v ?? 0) > 0);

  if (entries.length === 0) {
    return (
      <p className="text-[9px] text-text-muted italic">
        No engagement signals — base score driven by profile only.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((e) => (
        <span
          key={e.k}
          className="text-[9px] px-1.5 py-0.5 rounded bg-white/4 border border-border-subtle text-text-muted"
        >
          <span className="text-text-primary font-semibold">{e.v}</span>{" "}
          <span className="opacity-60">{e.k}</span>
        </span>
      ))}
      {typeof breakdown.recency_multiplier === "number" ? (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          decay x{breakdown.recency_multiplier.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}

function ScoreDetailModal({
  lead,
  onClose,
  onRecomputed,
}: {
  lead: ScoringLead;
  onClose: () => void;
  onRecomputed: (next: Partial<ScoringLead>) => void;
}) {
  const [recomputing, setRecomputing] = useState(false);
  const [history, setHistory] = useState<Array<{ ts: string; score: number }>>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/leads/${lead.id}/score-history`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { events: ScoreEventRow[] };
        if (cancelled) return;
        const points = (data.events ?? [])
          .map((e) => ({
            ts: e.created_at,
            score: e.new_score ?? 0,
          }))
          .reverse();
        setHistory(points);
      } catch (err) {
        if (!cancelled) {
          console.error("[score-detail] history fetch failed", err);
          setHistory([]);
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  async function handleRecompute() {
    setRecomputing(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/recompute-score`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${res.status}`);
      }
      const data = (await res.json()) as {
        score: number;
        grade: ScoreGrade;
      };
      onRecomputed({
        score: data.score,
        score_grade: data.grade,
        score_updated_at: new Date().toISOString(),
      });
      toast.success(`Updated: ${data.score}/100 (${data.grade})`);
    } catch (err) {
      console.error("[score-detail] recompute failed", err);
      toast.error("Recompute failed");
    } finally {
      setRecomputing(false);
    }
  }

  const grade = lead.score_grade ?? inferGrade(lead.score, lead.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-xl p-4 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target size={14} className="text-brand-accent" />
              Score detail · {lead.business_name}
            </h2>
            <p className="text-[10px] text-text-muted">
              Last updated {formatRelative(lead.score_updated_at)} ·{" "}
              {lead.industry ?? "Unknown industry"}
              {lead.city ? ` · ${lead.city}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/4 text-text-muted hover:text-text-primary"
            aria-label="Close score detail"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <ScoreGradeBadge
            score={lead.score}
            grade={grade}
            status={lead.status}
            showScore
          />
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="text-[10px] px-3 py-1.5 rounded-lg bg-[rgba(59,130,246,0.12)] text-brand-accent hover:bg-[rgba(59,130,246,0.18)] transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {recomputing ? (
              <Loader size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Recompute now
          </button>
        </div>

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-text-muted">
            Signal breakdown
          </h3>
          <SignalBreakdownPills breakdown={lead.score_signals} />
        </div>

        {lead.score_reasoning ? (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-text-muted">
              AI reasoning
            </h3>
            <p className="text-[11px] italic text-text-muted">
              {lead.score_reasoning}
            </p>
          </div>
        ) : null}

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-text-muted flex items-center gap-1.5">
            <TrendingUp size={10} /> Score history
          </h3>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader size={16} className="animate-spin text-brand-accent" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-[10px] text-text-muted italic">
              No history yet — recompute the score to start tracking.
            </p>
          ) : (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient
                      id="scoreGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#f59e0b"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="#f59e0b"
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="ts"
                    tickFormatter={(v: string) => formatRelative(v)}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 11,
                    }}
                    labelFormatter={(v) =>
                      typeof v === "string" || typeof v === "number"
                        ? new Date(v).toLocaleString()
                        : ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#scoreGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeadScoringPage() {
  const [leads, setLeads] = useState<ScoringLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [sortByScore, setSortByScore] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [detailLead, setDetailLead] = useState<ScoringLead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_LIMIT.toString(),
      });
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as {
        leads: ScoringLead[];
        total: number;
      };
      let fetched = data.leads ?? [];

      if (gradeFilter !== "all") {
        fetched = fetched.filter((l) => {
          const g = l.score_grade ?? inferGrade(l.score, l.status);
          return g === gradeFilter;
        });
      }
      if (sortByScore) {
        fetched = [...fetched].sort(
          (a, b) => (b.score ?? -1) - (a.score ?? -1),
        );
      }
      setLeads(fetched);
      setTotalCount(data.total ?? 0);
    } catch (err) {
      console.error("[lead-scoring] fetch failed", err);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, gradeFilter, sortByScore]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [gradeFilter]);

  const counts = useMemo<Record<ScoreGrade, number>>(() => {
    const out: Record<ScoreGrade, number> = {
      hot: 0,
      warm: 0,
      cold: 0,
      customer: 0,
    };
    for (const l of leads) {
      const g: ScoreGrade =
        l.score_grade ?? inferGrade(l.score, l.status);
      out[g] = (out[g] ?? 0) + 1;
    }
    return out;
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const visible = leads.map((l) => l.id);
      const allSelected = visible.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visible) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visible) next.add(id);
      return next;
    });
  }

  async function handleBulkRecompute() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("Select at least one lead");
      return;
    }
    setBulkRunning(true);
    try {
      const res = await fetch("/api/leads/recompute-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${res.status}`);
      }
      const data = await res.json();
      toast.success(`Recomputed ${data.processed ?? ids.length} lead(s)`);
      setSelected(new Set());
      await fetchLeads();
    } catch (err) {
      console.error("[lead-scoring] bulk recompute failed", err);
      toast.error("Bulk recompute failed");
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleRecomputeAllStale() {
    setBatchRunning(true);
    try {
      const res = await fetch("/api/leads/recompute-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxLeads: 100, staleMinutes: 60 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${res.status}`);
      }
      const data = await res.json();
      toast.success(
        `Stale recompute · ${data.processed ?? 0} processed, ${
          data.skipped ?? 0
        } skipped`,
      );
      await fetchLeads();
    } catch (err) {
      console.error("[lead-scoring] stale recompute failed", err);
      toast.error("Recompute failed");
    } finally {
      setBatchRunning(false);
    }
  }

  return (
    <MotionPage className="space-y-4">{/* -- AI Lead Scoring command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Score Models</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">AI Lead Scoring</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <>
                  <Link
                    href="/dashboard/leads"
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-border-subtle text-text-primary text-xs font-medium hover:bg-white/10 transition-all"
                  >
                    Back to Leads
                  </Link>
                  <button
                    onClick={handleRecomputeAllStale}
                    disabled={batchRunning}
                    className="px-3 py-1.5 rounded-lg bg-white/8 border border-border-subtle text-text-primary text-xs font-semibold hover:bg-white/12 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {batchRunning ? (
                      <Loader size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Recompute stale
                  </button>
                </>
      </div>
    </div><CollapsibleStats
              storageKey="lead-scoring"
              icon={<Target size={14} className="text-brand-accent" />}
              title="Grade Mix"
              summary={
                <>
                  <span>
                    <span className="text-orange-400 font-semibold">
                      {counts.hot}
                    </span>{" "}
                    hot
                  </span>
                  <span className="opacity-30">·</span>
                  <span>
                    <span className="text-yellow-400 font-semibold">
                      {counts.warm}
                    </span>{" "}
                    warm
                  </span>
                  <span className="opacity-30">·</span>
                  <span>
                    <span className="text-brand-accent font-semibold">
                      {counts.cold}
                    </span>{" "}
                    cold
                  </span>
                  <span className="opacity-30">·</span>
                  <span>
                    <span className="text-emerald-400 font-semibold">
                      {counts.customer}
                    </span>{" "}
                    customer
                  </span>
                </>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                {/* Focal tile — Hot */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.04 }}
                  className="flex items-start gap-3 glass rounded-2xl p-5"
                >
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Hot</p>
                    <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{counts.hot}</p>
                  </div>
                </motion.div>
                {/* Warm */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.10 }}
                  className="glass rounded-2xl p-5"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Warm</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{counts.warm}</p>
                </motion.div>
                {/* Cold */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.14 }}
                  className="glass rounded-2xl p-5"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Cold</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{counts.cold}</p>
                </motion.div>
                {/* Customer */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.18 }}
                  className="glass rounded-2xl p-5"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Customer</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{counts.customer}</p>
                </motion.div>
              </div>
            </CollapsibleStats>{/* Filter pills + bulk action toolbar */}<div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "hot", label: "Hot" },
                    { key: "warm", label: "Warm" },
                    { key: "cold", label: "Cold" },
                    { key: "customer", label: "Customer" },
                  ] as Array<{ key: GradeFilter; label: string }>
                ).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setGradeFilter(p.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      gradeFilter === p.key
                        ? "bg-[rgba(59,130,246,0.12)] border-[rgba(59,130,246,0.4)] text-brand-accent"
                        : "border-border-subtle text-text-muted hover:border-[rgba(59,130,246,0.2)] hover:text-text-primary"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setSortByScore((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    sortByScore
                      ? "bg-[rgba(59,130,246,0.08)] border-[rgba(59,130,246,0.25)] text-brand-accent"
                      : "border-border-subtle text-text-muted hover:border-[rgba(59,130,246,0.2)] hover:text-text-primary"
                  }`}
                >
                  <Target size={11} /> Sort by score
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted">
                  {selected.size} selected
                </span>
                <button
                  onClick={handleBulkRecompute}
                  disabled={selected.size === 0 || bulkRunning}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] text-brand-accent hover:bg-[rgba(59,130,246,0.18)] transition-all flex items-center gap-1.5 disabled:opacity-40"
                >
                  {bulkRunning ? (
                    <Loader size={11} className="animate-spin" />
                  ) : (
                    <RefreshCw size={11} />
                  )}
                  Recompute selected
                </button>
              </div>
            </div>{/* Lead table */}<div className="space-y-1.5">
              <div className="grid grid-cols-12 text-[9px] text-text-muted uppercase tracking-wider font-semibold py-2 px-3">
                <span className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      leads.length > 0 &&
                      leads.every((l) => selected.has(l.id))
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all leads on this page"
                  />
                </span>
                <span className="col-span-3">Business</span>
                <span className="col-span-2">Contact</span>
                <span className="col-span-2 text-center">Grade · Score</span>
                <span className="col-span-3">Signals</span>
                <span className="col-span-1 text-center">Updated</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size={20} className="animate-spin text-brand-accent" />
                </div>
              ) : leads.length === 0 ? (
                <EmptyState
                  type="no-leads"
                  title="No leads in this view"
                  description="Try a different grade filter, or import leads to start scoring."
                />
              ) : (
                leads.map((lead) => {
                  const grade =
                    lead.score_grade ?? inferGrade(lead.score, lead.status);
                  const checked = selected.has(lead.id);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => setDetailLead(lead)}
                      className="grid grid-cols-12 items-center py-2 px-3 rounded-lg bg-surface-light border border-border-subtle hover:border-[rgba(59,130,246,0.1)] transition-all cursor-pointer text-[10px]"
                    >
                      <div
                        className="col-span-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(lead.id)}
                          aria-label={`Select ${lead.business_name}`}
                        />
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs font-semibold">
                          {lead.business_name}
                        </p>
                        <p className="text-[9px] text-text-muted">
                          {lead.industry ?? "Unknown"}
                          {lead.city ? ` · ${lead.city}` : ""}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-text-muted truncate">{lead.email ?? "—"}</p>
                        <p className="text-text-muted truncate">{lead.phone ?? "—"}</p>
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        <ScoreGradeBadge
                          score={lead.score}
                          grade={grade}
                          status={lead.status}
                          showScore
                        />
                      </div>
                      <div className="col-span-3">
                        <SignalBreakdownPills breakdown={lead.score_signals} />
                      </div>
                      <div className="col-span-1 text-center text-[9px] text-text-muted">
                        {formatRelative(lead.score_updated_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>{/* Pagination */}{!loading && totalPages > 1 ? (
              <div className="flex items-center justify-between pt-3">
                <p className="text-[10px] text-text-muted">
                  Showing {(page - 1) * PAGE_LIMIT + 1}–
                  {Math.min(page * PAGE_LIMIT, totalCount)} of{" "}
                  {totalCount.toLocaleString()} leads
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-border-subtle hover:border-[rgba(59,130,246,0.2)] disabled:opacity-30 transition-all"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-mono text-text-muted">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-border-subtle hover:border-[rgba(59,130,246,0.2)] disabled:opacity-30 transition-all"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}{detailLead ? (
              <ScoreDetailModal
                lead={detailLead}
                onClose={() => setDetailLead(null)}
                onRecomputed={(next) => {
                  setDetailLead((cur) => (cur ? { ...cur, ...next } : cur));
                  setLeads((cur) =>
                    cur.map((l) =>
                      l.id === detailLead.id ? { ...l, ...next } : l,
                    ),
                  );
                }}
              />
            ) : null}</MotionPage>
  );
}
