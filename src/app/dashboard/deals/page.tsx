"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  DollarSign, Plus, TrendingUp, TrendingDown, Target,
  Clock, Award, FileText, Calculator, BarChart3,
  ChevronRight, Star, Zap, AlertTriangle, CheckCircle,
  Calendar, ArrowRight, Shield, Loader2, CreditCard
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import CollapsibleStats from "@/components/ui/collapsible-stats";
import { PrismPanel } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

type MainTab = "pipeline" | "forecast" | "analysis" | "scoring" | "templates" | "commission";

interface Deal {
  id: string;
  title: string;
  client_name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { key: "prospect", label: "Prospect", color: "#1D4ED8" },
  { key: "qualified", label: "Qualified", color: "#7c3aed" },
  { key: "proposal_sent", label: "Proposal Sent", color: "#d97706" },
  { key: "negotiation", label: "Negotiation", color: "#ea580c" },
  { key: "closed_won", label: "Closed Won", color: "#16a34a" },
  { key: "closed_lost", label: "Closed Lost", color: "#dc2626" },
];


const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

const slideX: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

export default function DealsPage() {
  const { clientId: managedClientId } = useManagedClient();
  const [activeTab, setActiveTab] = useState<MainTab>("pipeline");
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [forecastPeriod, setForecastPeriod] = useState<"month" | "quarter">("month");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: "", company: "", amount: "", stage: "prospect", source: "cold_outreach" });

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

 // -- Fetch deals from API (scoped to managed client when selected) --
  const fetchDeals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (managedClientId) params.set("client_id", managedClientId);
      const url = `/api/deals${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      setDeals(json.deals ?? []);
    } finally {
      setLoading(false);
    }
  }, [managedClientId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

 // -- Create deal --
  const handleCreate = async () => {
    if (!dealForm.title || !dealForm.company) return;
    setCreating(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dealForm.title,
          client_name: dealForm.company,
          value: parseFloat(dealForm.amount) || 0,
          stage: dealForm.stage,
          source: dealForm.source,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setDeals(prev => [json.deal, ...prev]);
        setDealForm({ title: "", company: "", amount: "", stage: "prospect", source: "cold_outreach" });
        setShowCreateModal(false);
      }
    } finally {
      setCreating(false);
    }
  };

 // -- Update deal stage (drag-drop) --
  const handleStageChange = async (dealId: string, newStage: string) => {
 // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d));
    const res = await fetch("/api/deals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId, stage: newStage }),
    });
    if (!res.ok) {
 // Revert on failure
      fetchDeals();
    }
  };

 // -- Delete deal --
  const handleDelete = async (dealId: string) => {
    setDeals(prev => prev.filter(d => d.id !== dealId));
    const res = await fetch("/api/deals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId }),
    });
    if (!res.ok) fetchDeals();
  };

 // -- Drag handlers --
  const onDragStart = (dealId: string) => setDraggedDealId(dealId);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (stageKey: string) => {
    if (draggedDealId) {
      handleStageChange(draggedDealId, stageKey);
      setDraggedDealId(null);
    }
  };

 // -- Computed values --
  const openDeals = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));
  const wonDeals = deals.filter(d => d.stage === "closed_won");
  const lostDeals = deals.filter(d => d.stage === "closed_lost");
  const totalPipeline = openDeals.reduce((s, d) => s + Number(d.value), 0);
  const wonValue = wonDeals.reduce((s, d) => s + Number(d.value), 0);
  const lostValue = lostDeals.reduce((s, d) => s + Number(d.value), 0);
  const avgDealSize = openDeals.length> 0 ? Math.round(totalPipeline / openDeals.length) : 0;
  const winRate = wonDeals.length + lostDeals.length> 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;
  const weightedPipeline = openDeals.reduce((s, d) => s + (Number(d.value) * d.probability / 100), 0);

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "pipeline", label: "Pipeline Board", icon: <BarChart3 size={14} /> },
    { key: "forecast", label: "Revenue Forecast", icon: <TrendingUp size={14} /> },
    { key: "analysis", label: "Win/Loss Analysis", icon: <Target size={14} /> },
    { key: "scoring", label: "Deal Scoring", icon: <Zap size={14} /> },
    { key: "templates", label: "Contracts", icon: <FileText size={14} /> },
    { key: "commission", label: "Commissions", icon: <Calculator size={14} /> },
  ];

  return (
    <MotionPage className="fade-in space-y-3">{/* -- Deals command strip (slim editorial header, no PageHero) -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">
              Deal Pipeline
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
              Deals Pipeline
            </h1>
          </div>
          {deals.length> 0 && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)] text-brand-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              {deals.length} deal{deals.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent/80 text-white text-xs font-semibold hover:bg-brand-accent/80/90 transition-all"
>
            <Plus size={13} /> New Deal
          </button>
        </div>
      </div>{/* Stats Row � collapsible (state persists) */}<CollapsibleStats
              storageKey="deals"
              icon={<BarChart3 size={14} className="text-brand-accent" />}
              title="Deal Stats"
              summary={
                <>
                  <span>Pipe <span className="text-brand-accent font-semibold">{formatCurrency(totalPipeline)}</span></span>
                  <span className="opacity-30">�</span>
                  <span>Won <span className="text-emerald-700 font-semibold">{formatCurrency(wonValue)}</span></span>
                  <span className="opacity-30">�</span>
                  <span>Win <span className="text-blue-400 font-semibold">{winRate}%</span></span>
                  <span className="opacity-30">�</span>
                  <span>Avg <span className="text-brand-accent font-semibold">{formatCurrency(avgDealSize)}</span></span>
                </>
              }
>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3">
                  <motion.div
                    className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Pipeline Value</p>
                      <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{formatCurrency(totalPipeline)}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">total opportunity</p>
                    </div>
                  </motion.div>
                  <motion.div
                    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Won</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-700 tabular-nums">{formatCurrency(wonValue)}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">closed won</p>
                  </motion.div>
                  <motion.div
                    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Lost</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-rose-700 tabular-nums">{formatCurrency(lostValue)}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">closed lost</p>
                  </motion.div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <motion.div
                    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Weighted</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-purple-600 tabular-nums">{formatCurrency(Math.round(weightedPipeline))}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">probability-adj.</p>
                  </motion.div>
                  <motion.div
                    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Win Rate</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-brand-accent tabular-nums">{winRate}%</p>
                    <p className="text-[11px] text-text-muted mt-1.5">close rate</p>
                  </motion.div>
                  <motion.div
                    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Deal</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{formatCurrency(avgDealSize)}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">average size</p>
                  </motion.div>
                </div>
              </div>
            </CollapsibleStats>{/* Tabs (sticky) */}<div className="glass sticky top-0 z-10 flex gap-1 rounded-lg p-1 overflow-x-auto border border-[rgba(255,255,255,0.08)]">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
                    activeTab === t.key ? "bg-[rgba(59,130,246,0.10)] text-brand-accent border border-[rgba(59,130,246,0.25)] font-medium" : "text-muted hover:text-foreground"
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>{/* Create Deal Inline */}{showCreateModal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass border border-brand-accent/15 rounded-xl p-4 space-y-3"
>
                <h3 className="text-sm font-semibold">Quick Create Deal</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <input value={dealForm.title} onChange={e => setDealForm({...dealForm, title: e.target.value})} className="input text-xs" placeholder="Deal title" aria-label="Deal title" />
                  <input value={dealForm.company} onChange={e => setDealForm({...dealForm, company: e.target.value})} className="input text-xs" placeholder="Company name" aria-label="Company name" />
                  <input type="number" value={dealForm.amount} onChange={e => setDealForm({...dealForm, amount: e.target.value})} className="input text-xs" placeholder="Amount" aria-label="Deal amount" />
                  <select value={dealForm.stage} onChange={e => setDealForm({...dealForm, stage: e.target.value})} className="input text-xs">
                    {STAGES.filter(s => !s.key.startsWith("closed")).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={creating || !dealForm.title || !dealForm.company} className="btn-primary text-xs disabled:opacity-50 flex items-center justify-center gap-1">
                    {creating && <Loader2 size={12} className="animate-spin" />}
                    {creating ? "Creating..." : "Create"}
                  </motion.button>
                </div>
              </motion.div>
            )}{/* ===== PIPELINE BOARD (Kanban) ===== */}{activeTab === "pipeline" && (
              <div className="space-y-4">
                {loading && (
                  <TableSkeleton rows={3} />
                )}
                {/* Kanban */}
                {!loading && (
                <div className="flex gap-3 overflow-x-auto pb-4">
                  {STAGES.map(stage => {
                    const stageDeals = deals.filter(d => d.stage === stage.key);
                    const stageValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);
                    return (
                      <div key={stage.key} className="flex-shrink-0 w-[240px]"
                        onDragOver={onDragOver}
                        onDrop={() => onDrop(stage.key)}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
                          </div>
                          <span className="text-[9px] font-mono" style={{ color: stage.color }}>{stageDeals.length}</span>
                        </div>
                        <p className="text-[9px] text-muted mb-2 px-1">{formatCurrency(stageValue)}</p>
                        <motion.div
                          className="space-y-2 max-h-[500px] overflow-y-auto"
                          variants={containerVariants}
                          initial="hidden"
                          animate="show"
>
                          {stageDeals.length === 0 && (
                            <div className={`text-center py-8 border border-dashed rounded-lg transition-colors ${draggedDealId ? "border-indigo-500/30 bg-indigo-500/5" : ""}`} style={{ borderColor: draggedDealId ? undefined : `${stage.color}20` }}>
                              <p className="text-[9px] text-muted">Drop deals here</p>
                            </div>
                          )}
                          {stageDeals.map(deal => {
                            const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
                            return (
                            <motion.div key={deal.id}
                              variants={fadeUp}
                              whileHover={{ y: -3 }}
                              draggable
                              onDragStart={() => onDragStart(deal.id)}
                              onClick={() => setExpandedDeal(expandedDeal === deal.id ? null : deal.id)}
                              className="glass rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-border transition-colors border border-[rgba(255,255,255,0.08)] spotlight-card"
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                                e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                              }}>
                              <p className="text-[11px] font-semibold truncate">{deal.title}</p>
                              <p className="text-[9px] text-muted">{deal.client_name}</p>
                              <p className="text-sm font-bold mt-1" style={{ color: stage.color }}>{formatCurrency(Number(deal.value))}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[8px] text-muted flex items-center gap-0.5"><Clock size={8} /> {daysSinceUpdate}d</span>
                                <span className="text-[8px] text-muted">{deal.probability}% prob</span>
                              </div>
                              {expandedDeal === deal.id && (
                                <div className="mt-2 pt-2 border-t border-border-subtle space-y-1.5">
                                  <p className="text-[9px]"><span className="text-muted">Source:</span> {deal.source || "N/A"}</p>
                                  <p className="text-[9px]"><span className="text-muted">Email:</span> {deal.contact_email || "N/A"}</p>
                                  <p className="text-[9px]"><span className="text-muted">Close:</span> {deal.expected_close_date || "N/A"}</p>
                                  {deal.notes && <p className="text-[9px]"><span className="text-muted">Notes:</span> {deal.notes}</p>}
                                  <div className="flex gap-1 pt-1 flex-wrap">
                                    {STAGES.filter(s => s.key !== stage.key && s.key !== "closed_lost").slice(0, 3).map(s => (
                                      <button key={s.key}
                                        onClick={(e) => { e.stopPropagation(); handleStageChange(deal.id, s.key); }}
                                        className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}20` }}>
                                        {s.label.split(" ")[0]}
                                      </button>
                                    ))}
                                    <button
                                      aria-label={`Delete deal: ${deal.title}`}
                                      onClick={(e) => { e.stopPropagation(); handleDelete(deal.id); }}
                                      className="text-[7px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
                )}

                {/* Deal Velocity Tracker */}
                <PrismPanel glow padding="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock size={14} className="text-brand-accent" /> Deal Velocity Tracker
                  </h3>
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
>
                    {[
                      { stage: "Prospect to Qualified", avg: "0 days", trend: "faster" },
                      { stage: "Qualified to Proposal", avg: "0 days", trend: "faster" },
                      { stage: "Proposal to Negotiation", avg: "0 days", trend: "faster" },
                      { stage: "Negotiation to Close", avg: "0 days", trend: "faster" },
                    ].map((v, i) => (
                      <motion.div key={i} variants={fadeUp} className="glass rounded-lg p-3 text-center border border-[rgba(255,255,255,0.08)]">
                        <p className="text-[9px] text-muted mb-1">{v.stage}</p>
                        <p className="text-sm font-bold">{v.avg}</p>
                        <p className={`text-[8px] flex items-center justify-center gap-0.5 ${v.trend === "faster" ? "text-emerald-700" : "text-rose-700"}`}>
                          {v.trend === "faster" ? <TrendingDown size={8} /> : <TrendingUp size={8} />} {v.trend}
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>
                  <p className="text-[10px] text-muted mt-3">Average sales cycle: <span className="text-brand-accent font-semibold">0 days</span></p>
                </PrismPanel>

                {/* Deal Timeline */}
                <PrismPanel padding="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar size={14} className="text-brand-accent" /> Recent Deal Timeline
                  </h3>
                  <div className="text-center py-8 text-muted text-xs">No deal activity yet.</div>
                </PrismPanel>
              </div>
            )}{/* ===== REVENUE FORECAST ===== */}{activeTab === "forecast" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Revenue Forecast</h3>
                  <div className="flex gap-1">
                    {(["month", "quarter"] as const).map(p => (
                      <button key={p} onClick={() => setForecastPeriod(p)}
                        className={`text-[10px] px-3 py-1.5 rounded-lg capitalize ${
                          forecastPeriod === p ? "bg-brand-accent/80/10 text-brand-accent border border-[#1D4ED8]/20" : "text-muted border border-border-subtle"
                        }`}>{p}</button>
                    ))}
                  </div>
                </div>
                <motion.div
                  className="grid grid-cols-3 gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
>
                  {[
                    { label: "Conservative", value: formatCurrency(Math.round(weightedPipeline * 0.6)), sub: "60% of weighted pipeline", color: "text-rose-700", bar: "bg-gradient-to-r from-red-500 to-rose-500" },
                    { label: "Most Likely", value: formatCurrency(Math.round(weightedPipeline)), sub: "Weighted probability", color: "text-brand-accent", bar: "bg-gradient-to-r from-indigo-500 to-violet-500" },
                    { label: "Best Case", value: formatCurrency(totalPipeline), sub: "100% close rate", color: "text-emerald-700", bar: "bg-gradient-to-r from-green-500 to-emerald-500" },
                  ].map((card, i) => (
                    <PrismPanel key={i} padding="p-5" className="text-center" delay={i * 0.06}>
                      <p className="text-[10px] text-muted mb-1 uppercase font-semibold">{card.label}</p>
                      <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-[9px] text-muted mt-1">{card.sub}</p>
                    </PrismPanel>
                  ))}
                </motion.div>
                {/* Monthly breakdown */}
                <PrismPanel padding="p-4">
                  <h4 className="text-xs font-semibold mb-3">Monthly Revenue Trend</h4>
                  <div className="text-center py-8 text-muted text-xs">
                    Monthly revenue trend will appear once deals are closed.
                  </div>
                </PrismPanel>
              </div>
            )}{/* ===== WIN/LOSS ANALYSIS ===== */}{activeTab === "analysis" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Win Reasons */}
                  <PrismPanel padding="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-700" /> Win Factors
                    </h3>
                    <div className="text-center py-8 text-muted text-xs">No win data yet.</div>
                  </PrismPanel>
                  {/* Loss Reasons */}
                  <PrismPanel padding="p-4" delay={0.06}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-rose-700" /> Loss Reasons
                    </h3>
                    <div className="text-center py-8 text-muted text-xs">No loss data yet.</div>
                  </PrismPanel>
                </div>
                {/* Competitor notes */}
                <PrismPanel glow padding="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield size={14} className="text-brand-accent" /> Competitor Intelligence
                  </h3>
                  <div className="text-center py-8 text-muted text-xs">No competitor data yet.</div>
                </PrismPanel>
              </div>
            )}{/* ===== DEAL SCORING ===== */}{activeTab === "scoring" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-brand-accent" /> AI Deal Scoring
                </h3>
                <motion.div
                  className="space-y-2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
>
                  {openDeals.length === 0 && (
                    <div className="text-center py-8 text-muted text-xs">No open deals to score yet.</div>
                  )}
                  {[...openDeals].sort((a, b) => b.probability - a.probability).map(deal => {
                    const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
                    const amt = Number(deal.value);
                    const score = Math.round(deal.probability * 0.4 + (amt> 3000 ? 30 : 15) + (daysSinceUpdate < 5 ? 20 : 5));
                    const scoreColor = score>= 70 ? "text-emerald-700" : score>= 40 ? "text-amber-600" : "text-rose-700";
                    const scoreBg = score>= 70 ? "bg-green-400" : score>= 40 ? "bg-yellow-400" : "bg-red-400";
                    return (
                      <motion.div
                        key={deal.id}
                        variants={fadeUp}
                        whileHover={{ y: -3 }}
                        className="glass rounded-xl p-4 flex items-center gap-4 border border-[rgba(255,255,255,0.08)] spotlight-card"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                          e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                        }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[rgba(255,255,255,0.08)]" style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                          <p className={`text-lg font-bold ${scoreColor}`}>{score}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold truncate">{deal.title}</p>
                            <span className="text-[9px] text-muted">({deal.client_name})</span>
                          </div>
                          <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-1.5">
                            <div className={`${scoreBg} rounded-full h-1.5`} style={{ width: `${score}%` }} />
                          </div>
                          <div className="flex gap-4 mt-1.5 text-[9px] text-muted">
                            <span>Stage: {STAGES.find(s => s.key === deal.stage)?.label}</span>
                            <span>{daysSinceUpdate}d in stage</span>
                            <span>{deal.probability}% probability</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-brand-accent">{formatCurrency(amt)}</p>
                          <p className="text-[9px] text-muted">Close: {deal.expected_close_date || "N/A"}</p>
                        </div>
                        <ChevronRight size={14} className="text-muted flex-shrink-0" />
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Stage Automation � starter rule templates */}
                <PrismPanel padding="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight size={14} className="text-brand-accent" /> Deal Stage Automation
                  </h3>
                  <p className="text-[10px] text-muted mb-3">Starter rule templates. Automation not yet wired to real triggers.</p>
                  <div className="space-y-2">
                    {[
                      { trigger: "Score reaches 80+", action: "Auto-move to Proposal stage" },
                      { trigger: "No activity for 7 days", action: "Send automated follow-up email" },
                      { trigger: "Proposal viewed 3+ times", action: "Notify owner + move to Negotiation" },
                      { trigger: "Deal value> $5,000", action: "Require manager approval before close" },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle opacity-60" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-2">
                          <Zap size={12} className="text-brand-accent" />
                          <div>
                            <p className="text-[10px] font-semibold">When: {rule.trigger}</p>
                            <p className="text-[9px] text-muted">Then: {rule.action}</p>
                          </div>
                        </div>
                        <div className="w-8 h-4 rounded-full bg-white/[0.06]">
                          <div className="w-3 h-3 bg-white rounded-full mt-0.5 ml-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </PrismPanel>
              </div>
            )}{/* ===== CONTRACT TEMPLATES + PROPOSALS ===== */}{activeTab === "templates" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contract Templates */}
                  <PrismPanel padding="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText size={14} className="text-brand-accent" /> Contract Templates
                    </h3>
                    <div className="space-y-2">
                      {[
                        { name: "Standard Service Agreement", pages: 4 },
                        { name: "Monthly Retainer Contract", pages: 3 },
                        { name: "Project-Based Agreement", pages: 5 },
                        { name: "NDA / Confidentiality", pages: 2 },
                      ].map((t, i) => (
                        <motion.div
                          key={i}
                          whileHover={{ y: -2 }}
                          onClick={() => toast("Contract templates coming soon � needs API")}
                          className="flex items-center justify-between p-3 rounded-lg hover:border-border transition-all cursor-pointer border border-border-subtle" style={{ background: "rgba(255,255,255,0.05)" }}
>
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-muted" />
                            <div>
                              <p className="text-xs font-medium">{t.name}</p>
                              <p className="text-[9px] text-muted">{t.pages} pages</p>
                            </div>
                          </div>
                          <ChevronRight size={12} className="text-muted" />
                        </motion.div>
                      ))}
                    </div>
                  </PrismPanel>
                  {/* Proposal Generator */}
                  <PrismPanel padding="p-4" delay={0.06}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Star size={14} className="text-brand-accent" /> Quick Proposal
                    </h3>
                    <div className="space-y-2">
                      <input className="input w-full text-xs" placeholder="Client business name" />
                      <input className="input w-full text-xs" placeholder="Industry" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" className="input w-full text-xs" placeholder="Monthly price" />
                        <select className="input w-full text-xs">
                          <option>3-month term</option>
                          <option>6-month term</option>
                          <option>12-month term</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {["Content", "Ads", "SEO", "Web", "Email", "AI"].map(s => (
                          <button
                            key={s}
                            onClick={() => toast(`${s} service selection coming soon � needs proposal builder`)}
                            className="text-[9px] px-2 py-1 rounded border border-border hover:border-[#1D4ED8]/30 hover:bg-brand-accent/80/5 text-muted hover:text-brand-accent transition-all"
>{s}</button>
                        ))}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toast("Proposal PDF generation coming soon � needs API")}
                        className="btn-primary w-full text-xs flex items-center justify-center gap-1.5"
>
                        <Zap size={12} /> Generate Proposal PDF
                      </motion.button>
                    </div>
                  </PrismPanel>
                </div>
              </div>
            )}{/* ===== COMMISSION CALCULATOR ===== */}{activeTab === "commission" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calculator size={14} className="text-brand-accent" /> Commission Calculator
                </h3>
                <motion.div
                  className="grid grid-cols-1 lg:grid-cols-3 gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
>
                  {[
                    { label: "This Month", value: formatCurrency(Math.round(wonValue * 0.15)), sub: `15% of ${formatCurrency(wonValue)} closed`, color: "text-brand-accent", bar: "bg-gradient-to-r from-indigo-500 to-violet-500" },
                    { label: "Projected", value: formatCurrency(Math.round(weightedPipeline * 0.15)), sub: "Based on weighted pipeline", color: "text-purple-400", bar: "bg-gradient-to-r from-purple-500 to-pink-500" },
                    { label: "YTD Earnings", value: formatCurrency(0), sub: "No data yet", color: "text-emerald-700", bar: "bg-gradient-to-r from-green-500 to-emerald-500" },
                  ].map((card, i) => (
                    <PrismPanel key={i} padding="p-5" className="text-center" delay={i * 0.06}>
                      <p className="text-[10px] text-muted uppercase mb-1">{card.label}</p>
                      <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-[10px] text-muted mt-1">{card.sub}</p>
                    </PrismPanel>
                  ))}
                </motion.div>
                {/* Deal-by-deal breakdown */}
                <PrismPanel rainbow padding="p-0" className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <h4 className="text-xs font-semibold">Commission Breakdown</h4>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="grid grid-cols-5 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                      <span>Deal</span><span>Amount</span><span>Rate</span><span>Commission</span><span>Status</span>
                    </div>
                    {deals.filter(d => d.stage === "closed_won" || d.probability>= 50).length === 0 && (
                      <div className="text-center py-8 text-muted text-xs">No commission data yet.</div>
                    )}
                    <motion.div
                      className="space-y-1"
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
>
                      {deals.filter(d => d.stage === "closed_won" || d.probability>= 50).map(deal => {
                        const amt = Number(deal.value);
                        const rate = amt>= 5000 ? 0.20 : amt>= 3000 ? 0.15 : 0.10;
                        const commission = Math.round(amt * rate);
                        return (
                          <motion.div
                            key={deal.id}
                            variants={slideX}
                            className="grid grid-cols-5 text-[10px] py-2 px-2 rounded-lg hover:bg-white/[0.03] items-center transition-colors border border-border-subtle" style={{ background: "rgba(255,255,255,0.05)" }}
>
                            <span className="font-medium truncate">{deal.title}</span>
                            <span>{formatCurrency(amt)}</span>
                            <span className="text-brand-accent">{(rate * 100).toFixed(0)}%</span>
                            <span className="font-bold text-emerald-700">{formatCurrency(commission)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                              deal.stage === "closed_won" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                            }`}>{deal.stage === "closed_won" ? "Paid" : "Pending"}</span>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </div>
                </PrismPanel>
              </div>
            )}</MotionPage>
  );
}


