"use client";

import { useState, useEffect, useCallback } from "react";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  DollarSign, Plus, TrendingUp, TrendingDown, Target,
  Clock, Award, FileText, Calculator, BarChart3,
  ChevronRight, Star, Zap, AlertTriangle, CheckCircle,
  Calendar, ArrowRight, Shield, Loader2, CreditCard
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

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
  { key: "prospect", label: "Prospect", color: "#3b82f6" },
  { key: "qualified", label: "Qualified", color: "#8b5cf6" },
  { key: "proposal_sent", label: "Proposal Sent", color: "#f59e0b" },
  { key: "negotiation", label: "Negotiation", color: "#f97316" },
  { key: "closed_won", label: "Closed Won", color: "#10b981" },
  { key: "closed_lost", label: "Closed Lost", color: "#ef4444" },
];

const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

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

  // ── Fetch deals from API (scoped to managed client when selected) ──
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

  // ── Create deal ──
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

  // ── Update deal stage (drag-drop) ──
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

  // ── Delete deal ──
  const handleDelete = async (dealId: string) => {
    setDeals(prev => prev.filter(d => d.id !== dealId));
    const res = await fetch("/api/deals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId }),
    });
    if (!res.ok) fetchDeals();
  };

  // ── Drag handlers ──
  const onDragStart = (dealId: string) => setDraggedDealId(dealId);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (stageKey: string) => {
    if (draggedDealId) {
      handleStageChange(draggedDealId, stageKey);
      setDraggedDealId(null);
    }
  };

  // ── Computed values ──
  const openDeals = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));
  const wonDeals = deals.filter(d => d.stage === "closed_won");
  const lostDeals = deals.filter(d => d.stage === "closed_lost");
  const totalPipeline = openDeals.reduce((s, d) => s + Number(d.value), 0);
  const wonValue = wonDeals.reduce((s, d) => s + Number(d.value), 0);
  const lostValue = lostDeals.reduce((s, d) => s + Number(d.value), 0);
  const avgDealSize = openDeals.length > 0 ? Math.round(totalPipeline / openDeals.length) : 0;
  const winRate = wonDeals.length + lostDeals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;
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
    <div className="fade-in space-y-5">
      <PageHero
        icon={<CreditCard size={28} />}
        title="Deals Pipeline"
        subtitle="Track deals from prospect to close with AI scoring."
        gradient="green"
        actions={
          <button onClick={() => setShowCreateModal(!showCreateModal)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={12} /> New Deal
          </button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Pipeline Value", value: formatCurrency(totalPipeline), icon: <DollarSign size={12} />, color: "text-gold" },
          { label: "Weighted", value: formatCurrency(Math.round(weightedPipeline)), icon: <Target size={12} />, color: "text-purple-400" },
          { label: "Won", value: formatCurrency(wonValue), icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Lost", value: formatCurrency(lostValue), icon: <TrendingDown size={12} />, color: "text-red-400" },
          { label: "Win Rate", value: `${winRate}%`, icon: <Award size={12} />, color: "text-blue-400" },
          { label: "Avg Deal", value: formatCurrency(avgDealSize), icon: <BarChart3 size={12} />, color: "text-gold" },
        ].map((stat, i) => (
          <div key={i} className="card text-center p-3">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Create Deal Inline */}
      {showCreateModal && (
        <div className="card border-gold/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Quick Create Deal</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input value={dealForm.title} onChange={e => setDealForm({...dealForm, title: e.target.value})} className="input text-xs" placeholder="Deal title" />
            <input value={dealForm.company} onChange={e => setDealForm({...dealForm, company: e.target.value})} className="input text-xs" placeholder="Company name" />
            <input type="number" value={dealForm.amount} onChange={e => setDealForm({...dealForm, amount: e.target.value})} className="input text-xs" placeholder="Amount" />
            <select value={dealForm.stage} onChange={e => setDealForm({...dealForm, stage: e.target.value})} className="input text-xs">
              {STAGES.filter(s => !s.key.startsWith("closed")).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button onClick={handleCreate} disabled={creating || !dealForm.title || !dealForm.company} className="btn-primary text-xs disabled:opacity-50 flex items-center justify-center gap-1">
              {creating && <Loader2 size={12} className="animate-spin" />}
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* ===== PIPELINE BOARD (Kanban) ===== */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted">
              <Loader2 size={16} className="animate-spin" /> Loading deals...
            </div>
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
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {stageDeals.length === 0 && (
                      <div className={`text-center py-8 border border-dashed rounded-lg transition-colors ${draggedDealId ? "border-gold/30 bg-gold/5" : ""}`} style={{ borderColor: draggedDealId ? undefined : `${stage.color}20` }}>
                        <p className="text-[9px] text-muted">Drop deals here</p>
                      </div>
                    )}
                    {stageDeals.map(deal => {
                      const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
                      return (
                      <div key={deal.id}
                        draggable
                        onDragStart={() => onDragStart(deal.id)}
                        onClick={() => setExpandedDeal(expandedDeal === deal.id ? null : deal.id)}
                        className="p-3 rounded-lg bg-surface-light border border-border hover:border-gold/10 transition-all cursor-grab active:cursor-grabbing">
                        <p className="text-[11px] font-semibold truncate">{deal.title}</p>
                        <p className="text-[9px] text-muted">{deal.client_name}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: stage.color }}>{formatCurrency(Number(deal.value))}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[8px] text-muted flex items-center gap-0.5"><Clock size={8} /> {daysSinceUpdate}d</span>
                          <span className="text-[8px] text-muted">{deal.probability}% prob</span>
                        </div>
                        {expandedDeal === deal.id && (
                          <div className="mt-2 pt-2 border-t border-border space-y-1.5">
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
                                onClick={(e) => { e.stopPropagation(); handleDelete(deal.id); }}
                                className="text-[7px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Deal Velocity Tracker */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock size={14} className="text-gold" /> Deal Velocity Tracker
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { stage: "Prospect to Qualified", avg: "0 days", trend: "faster" },
                { stage: "Qualified to Proposal", avg: "0 days", trend: "faster" },
                { stage: "Proposal to Negotiation", avg: "0 days", trend: "faster" },
                { stage: "Negotiation to Close", avg: "0 days", trend: "faster" },
              ].map((v, i) => (
                <div key={i} className="bg-surface-light rounded-lg p-3 text-center">
                  <p className="text-[9px] text-muted mb-1">{v.stage}</p>
                  <p className="text-sm font-bold">{v.avg}</p>
                  <p className={`text-[8px] flex items-center justify-center gap-0.5 ${v.trend === "faster" ? "text-green-400" : "text-red-400"}`}>
                    {v.trend === "faster" ? <TrendingDown size={8} /> : <TrendingUp size={8} />} {v.trend}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-3">Average sales cycle: <span className="text-gold font-semibold">0 days</span></p>
          </div>

          {/* Deal Timeline */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-gold" /> Recent Deal Timeline
            </h3>
            <div className="text-center py-8 text-muted text-xs">No deal activity yet.</div>
          </div>
        </div>
      )}

      {/* ===== REVENUE FORECAST ===== */}
      {activeTab === "forecast" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Revenue Forecast</h3>
            <div className="flex gap-1">
              {(["month", "quarter"] as const).map(p => (
                <button key={p} onClick={() => setForecastPeriod(p)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg capitalize ${
                    forecastPeriod === p ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center p-5 border-red-400/10">
              <p className="text-[10px] text-muted mb-1 uppercase font-semibold">Conservative</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(Math.round(weightedPipeline * 0.6))}</p>
              <p className="text-[9px] text-muted mt-1">60% of weighted pipeline</p>
            </div>
            <div className="card text-center p-5 border-gold/10">
              <p className="text-[10px] text-muted mb-1 uppercase font-semibold">Most Likely</p>
              <p className="text-2xl font-bold text-gold">{formatCurrency(Math.round(weightedPipeline))}</p>
              <p className="text-[9px] text-muted mt-1">Weighted probability</p>
            </div>
            <div className="card text-center p-5 border-green-400/10">
              <p className="text-[10px] text-muted mb-1 uppercase font-semibold">Best Case</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPipeline)}</p>
              <p className="text-[9px] text-muted mt-1">100% close rate</p>
            </div>
          </div>
          {/* Monthly breakdown */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Monthly Revenue Trend</h4>
            <div className="flex items-end gap-3 h-40">
              {[
                { month: "Nov", actual: 0, forecast: 0 },
                { month: "Dec", actual: 0, forecast: 0 },
                { month: "Jan", actual: 0, forecast: 0 },
                { month: "Feb", actual: 0, forecast: 0 },
                { month: "Mar", actual: 0, forecast: 0 },
                { month: "Apr", actual: wonValue, forecast: Math.round(weightedPipeline) },
                { month: "May", actual: 0, forecast: Math.round(weightedPipeline * 1.15) },
              ].map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col gap-0.5">
                    {m.forecast > 0 && (
                      <div className="w-full bg-gold/20 rounded-t border border-dashed border-gold/30"
                        style={{ height: `${(m.forecast / 25000) * 100}%`, minHeight: m.forecast > 0 ? 8 : 0 }} />
                    )}
                    <div className="w-full bg-gold rounded-t"
                      style={{ height: `${(m.actual / 25000) * 100}%`, minHeight: m.actual > 0 ? 8 : 0 }} />
                  </div>
                  <span className="text-[8px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[9px] text-muted">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gold rounded" /> Actual</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gold/20 border border-dashed border-gold/30 rounded" /> Forecast</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== WIN/LOSS ANALYSIS ===== */}
      {activeTab === "analysis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Win Reasons */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-400" /> Win Factors
              </h3>
              <div className="text-center py-8 text-muted text-xs">No win data yet.</div>
            </div>
            {/* Loss Reasons */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" /> Loss Reasons
              </h3>
              <div className="text-center py-8 text-muted text-xs">No loss data yet.</div>
            </div>
          </div>
          {/* Competitor notes */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield size={14} className="text-gold" /> Competitor Intelligence
            </h3>
            <div className="text-center py-8 text-muted text-xs">No competitor data yet.</div>
          </div>
        </div>
      )}

      {/* ===== DEAL SCORING ===== */}
      {activeTab === "scoring" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap size={14} className="text-gold" /> AI Deal Scoring
          </h3>
          <div className="space-y-2">
            {openDeals.length === 0 && (
              <div className="text-center py-8 text-muted text-xs">No open deals to score yet.</div>
            )}
            {[...openDeals].sort((a, b) => b.probability - a.probability).map(deal => {
              const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
              const amt = Number(deal.value);
              const score = Math.round(deal.probability * 0.4 + (amt > 3000 ? 30 : 15) + (daysSinceUpdate < 5 ? 20 : 5));
              const scoreColor = score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
              const scoreBg = score >= 70 ? "bg-green-400" : score >= 40 ? "bg-yellow-400" : "bg-red-400";
              return (
                <div key={deal.id} className="card p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-light flex items-center justify-center flex-shrink-0">
                    <p className={`text-lg font-bold ${scoreColor}`}>{score}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate">{deal.title}</p>
                      <span className="text-[9px] text-muted">({deal.client_name})</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-1.5 mt-1.5">
                      <div className={`${scoreBg} rounded-full h-1.5`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[9px] text-muted">
                      <span>Stage: {STAGES.find(s => s.key === deal.stage)?.label}</span>
                      <span>{daysSinceUpdate}d in stage</span>
                      <span>{deal.probability}% probability</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gold">{formatCurrency(amt)}</p>
                    <p className="text-[9px] text-muted">Close: {deal.expected_close_date || "N/A"}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted flex-shrink-0" />
                </div>
              );
            })}
          </div>

          {/* Stage Automation */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ArrowRight size={14} className="text-gold" /> Deal Stage Automation
            </h3>
            <div className="space-y-2">
              {[
                { trigger: "Score reaches 80+", action: "Auto-move to Proposal stage", active: true },
                { trigger: "No activity for 7 days", action: "Send automated follow-up email", active: true },
                { trigger: "Proposal viewed 3+ times", action: "Notify owner + move to Negotiation", active: false },
                { trigger: "Deal value > $5,000", action: "Require manager approval before close", active: true },
              ].map((rule, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border ${!rule.active ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-gold" />
                    <div>
                      <p className="text-[10px] font-semibold">When: {rule.trigger}</p>
                      <p className="text-[9px] text-muted">Then: {rule.action}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full ${rule.active ? "bg-gold" : "bg-surface"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== CONTRACT TEMPLATES + PROPOSALS ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contract Templates */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText size={14} className="text-gold" /> Contract Templates
              </h3>
              <div className="space-y-2">
                {[
                  { name: "Standard Service Agreement", pages: 4, lastUsed: "Apr 10" },
                  { name: "Monthly Retainer Contract", pages: 3, lastUsed: "Apr 8" },
                  { name: "Project-Based Agreement", pages: 5, lastUsed: "Mar 25" },
                  { name: "NDA / Confidentiality", pages: 2, lastUsed: "Mar 15" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border hover:border-gold/10 transition-all cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted" />
                      <div>
                        <p className="text-xs font-medium">{t.name}</p>
                        <p className="text-[9px] text-muted">{t.pages} pages | Last used: {t.lastUsed}</p>
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-muted" />
                  </div>
                ))}
              </div>
            </div>
            {/* Proposal Generator */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star size={14} className="text-gold" /> Quick Proposal
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
                    <button key={s} className="text-[9px] px-2 py-1 rounded border border-border hover:border-gold/20 hover:bg-gold/5 text-muted hover:text-gold transition-all">{s}</button>
                  ))}
                </div>
                <button className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <Zap size={12} /> Generate Proposal PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== COMMISSION CALCULATOR ===== */}
      {activeTab === "commission" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calculator size={14} className="text-gold" /> Commission Calculator
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">This Month</p>
              <p className="text-3xl font-bold text-gold">{formatCurrency(Math.round(wonValue * 0.15))}</p>
              <p className="text-[10px] text-muted mt-1">15% of {formatCurrency(wonValue)} closed</p>
            </div>
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">Projected</p>
              <p className="text-3xl font-bold text-purple-400">{formatCurrency(Math.round(weightedPipeline * 0.15))}</p>
              <p className="text-[10px] text-muted mt-1">Based on weighted pipeline</p>
            </div>
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">YTD Earnings</p>
              <p className="text-3xl font-bold text-green-400">{formatCurrency(0)}</p>
              <p className="text-[10px] text-muted mt-1">No data yet</p>
            </div>
          </div>
          {/* Deal-by-deal breakdown */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Commission Breakdown</h4>
            <div className="space-y-1.5">
              <div className="grid grid-cols-5 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                <span>Deal</span><span>Amount</span><span>Rate</span><span>Commission</span><span>Status</span>
              </div>
              {deals.filter(d => d.stage === "closed_won" || d.probability >= 50).length === 0 && (
                <div className="text-center py-8 text-muted text-xs">No commission data yet.</div>
              )}
              {deals.filter(d => d.stage === "closed_won" || d.probability >= 50).map(deal => {
                const amt = Number(deal.value);
                const rate = amt >= 5000 ? 0.20 : amt >= 3000 ? 0.15 : 0.10;
                const commission = Math.round(amt * rate);
                return (
                  <div key={deal.id} className="grid grid-cols-5 text-[10px] py-2 px-2 rounded bg-surface-light items-center">
                    <span className="font-medium truncate">{deal.title}</span>
                    <span>{formatCurrency(amt)}</span>
                    <span className="text-gold">{(rate * 100).toFixed(0)}%</span>
                    <span className="font-bold text-green-400">{formatCurrency(commission)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                      deal.stage === "closed_won" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                    }`}>{deal.stage === "closed_won" ? "Paid" : "Pending"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
