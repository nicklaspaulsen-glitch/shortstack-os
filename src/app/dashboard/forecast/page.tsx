"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle,
  BarChart3, Calendar, ArrowUpRight, ArrowDownRight,
  Layers, PieChart, Clock, Users, Zap, Star, Shield,
  Activity
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Mock Data                                                   */
/* ------------------------------------------------------------------ */
type ForecastTab = "overview" | "pipeline" | "scenarios" | "churn" | "comparison";

interface ClientRevenue {
  name: string;
  mrr: number;
  health: number;
  renewalDate: string;
  service: string;
  months: number;
  trend: "up" | "down" | "flat";
}

interface PipelineDeal {
  id: string;
  name: string;
  client: string;
  value: number;
  stage: string;
  probability: number;
  expectedClose: string;
}

const MOCK_CLIENTS: ClientRevenue[] = [];

const PIPELINE_DEALS: PipelineDeal[] = [];

const SERVICE_BREAKDOWN: { service: string; revenue: number; clients: number; color: string; growth: number }[] = [];

const HISTORICAL_MONTHS: { month: string; revenue: number }[] = [];

const fmtCurrency = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function ForecastPage() {
  const [tab, setTab] = useState<ForecastTab>("overview");
  const [forecastRange, setForecastRange] = useState<3 | 6 | 12>(6);
  const [scenario, setScenario] = useState<"best" | "expected" | "worst">("expected");

  /* ------- Computed ------- */
  const currentMRR = MOCK_CLIENTS.reduce((s, c) => s + c.mrr, 0);
  const arr = currentMRR * 12;
  const clientCount = MOCK_CLIENTS.length;
  const avgMRR = clientCount > 0 ? Math.round(currentMRR / clientCount) : 0;
  const churnRisk = MOCK_CLIENTS.filter(c => c.health < 50).length;
  const avgHealth = clientCount > 0 ? Math.round(MOCK_CLIENTS.reduce((s, c) => s + c.health, 0) / clientCount) : 0;

  // Growth / churn rates per scenario
  const growthRates = { best: 0.10, expected: 0.06, worst: -0.02 };
  const churnRates = { best: 0.02, expected: 0.04, worst: 0.10 };
  const monthlyGrowth = growthRates[scenario];
  const monthlyChurn = churnRates[scenario];

  // Build 12-month projection
  const projection: { month: string; revenue: number }[] = [];
  let running = currentMRR;
  for (let i = 0; i < 12; i++) {
    const d = new Date(2026, 4 + i, 1); // start from May 2026
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    running = Math.round(running * (1 + monthlyGrowth - monthlyChurn));
    projection.push({ month: label, revenue: running });
  }

  const projected3 = projection[2]?.revenue || 0;
  const projected6 = projection[5]?.revenue || 0;
  const projected12 = projection[11]?.revenue || 0;

  // Pipeline weighted forecast
  const pipelineWeighted = PIPELINE_DEALS.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const pipelineTotal = PIPELINE_DEALS.reduce((s, d) => s + d.value, 0);

  // Max for bar chart scaling
  const allRevValues = [...HISTORICAL_MONTHS.map(h => h.revenue), ...projection.map(p => p.revenue)];
  const maxRev = Math.max(...allRevValues, 1);

  // Monthly comparison data
  const comparisonMonths: { month: string; thisYear: number; lastYear: number }[] = [];

  const TABS: { id: ForecastTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <TrendingUp size={13} /> },
    { id: "pipeline", label: "Pipeline Forecast", icon: <Target size={13} /> },
    { id: "scenarios", label: "Scenarios", icon: <Layers size={13} /> },
    { id: "churn", label: "Churn Prediction", icon: <AlertTriangle size={13} /> },
    { id: "comparison", label: "Monthly Compare", icon: <BarChart3 size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <TrendingUp size={18} className="text-gold" /> Revenue Forecast
          </h1>
          <p className="text-xs text-muted mt-0.5">MRR/ARR projections, pipeline weighting, and scenario planning</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface rounded-lg p-0.5">
            {([3, 6, 12] as const).map(r => (
              <button key={r} onClick={() => setForecastRange(r)}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                  forecastRange === r ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
                }`}>
                {r}mo
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {[
          { label: "Current MRR", value: fmtCurrency(currentMRR), sub: `${clientCount} clients`, icon: <DollarSign size={12} />, color: "text-gold", subColor: "text-muted" },
          { label: "ARR", value: fmtCurrency(arr), sub: "+12% YoY", icon: <BarChart3 size={12} />, color: "text-blue-400", subColor: "text-emerald-400" },
          { label: "Avg MRR/Client", value: fmtCurrency(avgMRR), sub: "per client", icon: <Target size={12} />, color: "text-purple-400", subColor: "text-muted" },
          { label: "Pipeline (Weighted)", value: fmtCurrency(Math.round(pipelineWeighted)), sub: `${PIPELINE_DEALS.length} deals`, icon: <Zap size={12} />, color: "text-emerald-400", subColor: "text-muted" },
          { label: "Health Score", value: `${avgHealth}%`, sub: `${churnRisk} at risk`, icon: <Star size={12} />, color: "text-gold", subColor: churnRisk > 0 ? "text-red-400" : "text-muted" },
        ].map((stat, i) => (
          <div key={i} className="card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={stat.color}>{stat.icon}</div>
              <p className="text-[10px] text-muted uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className={`text-[10px] ${stat.subColor} flex items-center gap-0.5`}>
              {stat.subColor === "text-emerald-400" && <ArrowUpRight size={10} />}
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  OVERVIEW                                                     */}
      {/* ============================================================ */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Projection snapshot cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">3 Month MRR</p>
              <p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected3)}/mo</p>
              <p className="text-[9px] text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                <ArrowUpRight size={9} /> +{currentMRR > 0 ? Math.round(((projected3 - currentMRR) / currentMRR) * 100) : 0}%
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">6 Month MRR</p>
              <p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected6)}/mo</p>
              <p className="text-[9px] text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                <ArrowUpRight size={9} /> +{currentMRR > 0 ? Math.round(((projected6 - currentMRR) / currentMRR) * 100) : 0}%
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">12 Month MRR</p>
              <p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected12)}/mo</p>
              <p className="text-[9px] text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                <ArrowUpRight size={9} /> +{currentMRR > 0 ? Math.round(((projected12 - currentMRR) / currentMRR) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* MRR Projection Chart */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <BarChart3 size={13} className="text-gold" /> MRR / ARR Projection
            </p>
            <div className="flex items-end gap-1 h-44">
              {projection.slice(0, forecastRange).map((p, idx) => {
                const h = (p.revenue / maxRev) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10 shadow-lg">
                      {fmtCurrency(p.revenue)}/mo
                    </div>
                    <div className="w-full rounded-t-md bg-gold/80 hover:bg-gold transition-colors"
                      style={{ height: `${h}%`, minHeight: 4 }} />
                    <span className="text-[8px] text-muted">{p.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] text-muted">
              <span>Projected ARR at {forecastRange}mo: <span className="text-gold font-bold">{fmtCurrency((projection[forecastRange - 1]?.revenue || 0) * 12)}</span></span>
              <span>Growth rate: <span className="text-emerald-400 font-bold">+{((monthlyGrowth - monthlyChurn) * 100).toFixed(0)}%/mo</span></span>
            </div>
          </div>

          {/* Revenue by Service */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <PieChart size={13} className="text-gold" /> Revenue by Service
            </h2>
            <div className="space-y-2.5">
              {SERVICE_BREAKDOWN.map(s => {
                const pct = Math.round((s.revenue / currentMRR) * 100);
                return (
                  <div key={s.service} className="p-3 rounded-xl bg-surface-light border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs font-bold">{s.service}</span>
                        <span className="text-[10px] text-muted">({s.clients} clients)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] flex items-center gap-0.5 ${s.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.growth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {s.growth >= 0 ? "+" : ""}{s.growth}%
                        </span>
                        <span className="text-xs font-bold" style={{ color: s.color }}>{fmtCurrency(s.revenue)}/mo</span>
                        <span className="text-[10px] text-muted">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Growth Rate Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <Activity size={16} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-[10px] text-muted">Monthly Growth Rate</p>
              <p className="text-2xl font-bold text-emerald-400">+{(monthlyGrowth * 100).toFixed(0)}%</p>
              <p className="text-[9px] text-muted mt-1">Compounding monthly</p>
            </div>
            <div className="card p-4 text-center">
              <TrendingDown size={16} className="text-red-400 mx-auto mb-2" />
              <p className="text-[10px] text-muted">Monthly Churn Rate</p>
              <p className="text-2xl font-bold text-red-400">{(monthlyChurn * 100).toFixed(0)}%</p>
              <p className="text-[9px] text-muted mt-1">{churnRisk} client{churnRisk !== 1 ? "s" : ""} at risk</p>
            </div>
            <div className="card p-4 text-center">
              <Zap size={16} className="text-gold mx-auto mb-2" />
              <p className="text-[10px] text-muted">Net Revenue Growth</p>
              <p className={`text-2xl font-bold ${(monthlyGrowth - monthlyChurn) >= 0 ? "text-gold" : "text-red-400"}`}>
                {((monthlyGrowth - monthlyChurn) * 100).toFixed(0)}%
              </p>
              <p className="text-[9px] text-muted mt-1">Growth minus churn</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  PIPELINE FORECAST                                            */}
      {/* ============================================================ */}
      {tab === "pipeline" && (
        <div className="space-y-4">
          {/* Pipeline summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Total Pipeline</p>
              <p className="text-xl font-bold text-blue-400">{fmtCurrency(pipelineTotal)}</p>
              <p className="text-[9px] text-muted">{PIPELINE_DEALS.length} deals</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Weighted Forecast</p>
              <p className="text-xl font-bold text-gold">{fmtCurrency(Math.round(pipelineWeighted))}</p>
              <p className="text-[9px] text-muted">probability adjusted</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Deal Size</p>
              <p className="text-xl font-bold text-purple-400">{fmtCurrency(PIPELINE_DEALS.length > 0 ? Math.round(pipelineTotal / PIPELINE_DEALS.length) : 0)}</p>
              <p className="text-[9px] text-muted">per deal</p>
            </div>
          </div>

          {/* Deal-by-deal breakdown */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target size={13} className="text-gold" /> Pipeline-Weighted Forecast
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left py-2">Deal</th>
                    <th className="text-left py-2">Client</th>
                    <th className="text-center py-2">Stage</th>
                    <th className="text-center py-2">Probability</th>
                    <th className="text-right py-2">Value</th>
                    <th className="text-right py-2">Weighted</th>
                    <th className="text-center py-2">Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {PIPELINE_DEALS.sort((a, b) => b.probability - a.probability).map(deal => {
                    const weighted = deal.value * (deal.probability / 100);
                    const stageColor = deal.probability >= 60 ? "text-green-400 bg-green-400/10" :
                                       deal.probability >= 30 ? "text-yellow-400 bg-yellow-400/10" :
                                       "text-muted bg-white/5";
                    return (
                      <tr key={deal.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                        <td className="py-2.5 font-medium">{deal.name}</td>
                        <td className="py-2.5 text-muted">{deal.client}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] ${stageColor}`}>{deal.stage}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-12 h-1.5 rounded-full bg-surface-light overflow-hidden">
                              <div className="h-full rounded-full bg-gold" style={{ width: `${deal.probability}%` }} />
                            </div>
                            <span className="font-bold">{deal.probability}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right">{fmtCurrency(deal.value)}</td>
                        <td className="py-2.5 text-right font-bold text-gold">{fmtCurrency(Math.round(weighted))}</td>
                        <td className="py-2.5 text-center text-muted">{deal.expectedClose}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-xs border-t border-border">
                    <td className="py-3" colSpan={4}>Totals</td>
                    <td className="py-3 text-right">{fmtCurrency(pipelineTotal)}</td>
                    <td className="py-3 text-right text-gold">{fmtCurrency(Math.round(pipelineWeighted))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pipeline by stage bar chart */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={13} className="text-blue-400" /> Pipeline by Stage
            </h2>
            <div className="space-y-2">
              {["Prospect", "Qualified", "Proposal Sent", "Negotiation"].map(stage => {
                const deals = PIPELINE_DEALS.filter(d => d.stage === stage);
                const total = deals.reduce((s, d) => s + d.value, 0);
                const pct = pipelineTotal > 0 ? (total / pipelineTotal) * 100 : 0;
                const stageColor = stage === "Negotiation" ? "#10b981" : stage === "Proposal Sent" ? "#f59e0b" :
                                   stage === "Qualified" ? "#8b5cf6" : "#3b82f6";
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-[10px] w-28 text-muted">{stage}</span>
                    <div className="flex-1 h-5 rounded-lg bg-surface-light overflow-hidden">
                      <div className="h-full rounded-lg flex items-center px-2 text-[8px] font-bold text-white"
                        style={{ width: `${Math.max(pct, 8)}%`, background: stageColor }}>
                        {fmtCurrency(total)}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted w-8 text-right">{deals.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SCENARIO PLANNING                                            */}
      {/* ============================================================ */}
      {tab === "scenarios" && (
        <div className="space-y-4">
          {/* Scenario selector */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers size={13} className="text-gold" /> Scenario Planning
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["best", "expected", "worst"] as const).map(s => {
                const cfg = {
                  best: { label: "Best Case", desc: "+10% growth, 2% churn", color: "text-emerald-400", border: "border-emerald-400/30" },
                  expected: { label: "Expected", desc: "+6% growth, 4% churn", color: "text-gold", border: "border-gold/30" },
                  worst: { label: "Worst Case", desc: "-2% growth, 10% churn", color: "text-red-400", border: "border-red-400/30" },
                };
                const c = cfg[s];
                return (
                  <button key={s} onClick={() => setScenario(s)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      scenario === s ? `${c.border} bg-white/[0.02]` : "border-border"
                    }`}>
                    <p className={`text-xs font-bold ${scenario === s ? c.color : ""}`}>{c.label}</p>
                    <p className="text-[10px] text-muted mt-0.5">{c.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Scenario projections */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-light text-center">
                <p className="text-[10px] text-muted">3 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected3)}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-light text-center">
                <p className="text-[10px] text-muted">6 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected6)}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-light text-center">
                <p className="text-[10px] text-muted">12 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected12)}</p>
              </div>
            </div>
          </div>

          {/* Side-by-side scenario comparison */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3">All Scenarios Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left py-2">Metric</th>
                    <th className="text-center py-2 text-emerald-400">Best Case</th>
                    <th className="text-center py-2 text-gold">Expected</th>
                    <th className="text-center py-2 text-red-400">Worst Case</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const buildRow = (label: string, fn: (g: number, c: number) => number) => {
                      const scenarios = (["best", "expected", "worst"] as const).map(s => {
                        const g = growthRates[s];
                        const ch = churnRates[s];
                        return fn(g, ch);
                      });
                      return (
                        <tr key={label} className="border-b border-border/30">
                          <td className="py-2 font-medium">{label}</td>
                          <td className="py-2 text-center text-emerald-400 font-bold">{fmtCurrency(scenarios[0])}</td>
                          <td className="py-2 text-center text-gold font-bold">{fmtCurrency(scenarios[1])}</td>
                          <td className="py-2 text-center text-red-400 font-bold">{fmtCurrency(scenarios[2])}</td>
                        </tr>
                      );
                    };
                    const project = (months: number, g: number, c: number) => {
                      let r = currentMRR;
                      for (let i = 0; i < months; i++) r = Math.round(r * (1 + g - c));
                      return r;
                    };
                    return (
                      <>
                        {buildRow("3 Month MRR", (g, c) => project(3, g, c))}
                        {buildRow("6 Month MRR", (g, c) => project(6, g, c))}
                        {buildRow("12 Month MRR", (g, c) => project(12, g, c))}
                        {buildRow("12 Month ARR", (g, c) => project(12, g, c) * 12)}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Net growth calculator */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield size={13} className="text-blue-400" /> Growth vs Churn
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center py-4">
              <div>
                <p className="text-[10px] text-muted">Monthly Growth</p>
                <p className="text-2xl font-bold text-emerald-400">+{(monthlyGrowth * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Monthly Churn</p>
                <p className="text-2xl font-bold text-red-400">-{(monthlyChurn * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Net Growth</p>
                <p className={`text-2xl font-bold ${(monthlyGrowth - monthlyChurn) >= 0 ? "text-gold" : "text-red-400"}`}>
                  {((monthlyGrowth - monthlyChurn) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  CHURN PREDICTION                                             */}
      {/* ============================================================ */}
      {tab === "churn" && (
        <div className="space-y-4">
          {/* At-risk overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">At Risk Clients</p>
              <p className="text-xl font-bold text-red-400">{churnRisk}</p>
              <p className="text-[9px] text-muted">health &lt; 50%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Revenue at Risk</p>
              <p className="text-xl font-bold text-red-400">{fmtCurrency(MOCK_CLIENTS.filter(c => c.health < 50).reduce((s, c) => s + c.mrr, 0))}</p>
              <p className="text-[9px] text-muted">monthly</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Client Health</p>
              <p className={`text-xl font-bold ${avgHealth >= 70 ? "text-emerald-400" : avgHealth >= 50 ? "text-yellow-400" : "text-red-400"}`}>{avgHealth}%</p>
              <p className="text-[9px] text-muted">across all clients</p>
            </div>
          </div>

          {/* Client health list */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-400" /> Client Churn Prediction
            </h2>
            <div className="space-y-2">
              {[...MOCK_CLIENTS].sort((a, b) => a.health - b.health).map(client => {
                const riskLevel = client.health < 40 ? "High Risk" : client.health < 60 ? "Medium Risk" : client.health < 80 ? "Low Risk" : "Healthy";
                const riskColor = client.health < 40 ? "text-red-400" : client.health < 60 ? "text-yellow-400" : client.health < 80 ? "text-blue-400" : "text-emerald-400";
                const riskBg = client.health < 40 ? "bg-red-400/10" : client.health < 60 ? "bg-yellow-400/10" : client.health < 80 ? "bg-blue-400/10" : "bg-emerald-400/10";
                return (
                  <div key={client.name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold ${riskBg} ${riskColor}`}>
                      {client.health}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate">{client.name}</p>
                        <span className={`text-[9px] flex items-center gap-0.5 ${client.trend === "up" ? "text-emerald-400" : client.trend === "down" ? "text-red-400" : "text-muted"}`}>
                          {client.trend === "up" ? <ArrowUpRight size={9} /> : client.trend === "down" ? <ArrowDownRight size={9} /> : null}
                          {client.trend}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">{fmtCurrency(client.mrr)}/mo &middot; {client.service} &middot; {client.months}mo tenure</p>
                      <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden w-full max-w-xs">
                        <div className={`h-full rounded-full ${client.health < 40 ? "bg-red-400" : client.health < 60 ? "bg-yellow-400" : client.health < 80 ? "bg-blue-400" : "bg-emerald-400"}`}
                          style={{ width: `${client.health}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[10px] font-bold ${riskColor}`}>{riskLevel}</p>
                      <p className="text-[9px] text-muted">Renews {client.renewalDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Churn impact */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign size={13} className="text-gold" /> Churn Impact Analysis
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-light text-center">
                <p className="text-[10px] text-muted">If all at-risk clients churn</p>
                <p className="text-lg font-bold text-red-400">-{fmtCurrency(MOCK_CLIENTS.filter(c => c.health < 50).reduce((s, c) => s + c.mrr, 0))}/mo</p>
                <p className="text-[9px] text-muted">New MRR: {fmtCurrency(currentMRR - MOCK_CLIENTS.filter(c => c.health < 50).reduce((s, c) => s + c.mrr, 0))}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-light text-center">
                <p className="text-[10px] text-muted">Annual revenue impact</p>
                <p className="text-lg font-bold text-red-400">-{fmtCurrency(MOCK_CLIENTS.filter(c => c.health < 50).reduce((s, c) => s + c.mrr, 0) * 12)}/yr</p>
                <p className="text-[9px] text-muted">Preventable with intervention</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  MONTHLY COMPARISON                                           */}
      {/* ============================================================ */}
      {tab === "comparison" && (
        <div className="space-y-4">
          {/* Historical trend chart */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock size={13} className="text-blue-400" /> Historical Revenue Trend
            </h2>
            <div className="flex items-end gap-2 h-36">
              {HISTORICAL_MONTHS.map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10 shadow-lg">
                    {fmtCurrency(h.revenue)}
                  </div>
                  <div className="w-full rounded-t-md bg-blue-400/60 hover:bg-blue-400/80 transition-colors"
                    style={{ height: `${(h.revenue / maxRev) * 100}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-muted">{h.month}</span>
                </div>
              ))}
              <div className="w-px h-full bg-border mx-1" />
              {projection.slice(0, 4).map((p, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10 shadow-lg">
                    {fmtCurrency(p.revenue)}
                  </div>
                  <div className="w-full rounded-t-md bg-gold/60 hover:bg-gold/80 transition-colors"
                    style={{ height: `${(p.revenue / maxRev) * 100}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-muted">{p.month}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-blue-400/60" /> Historical</span>
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-gold/60" /> Projected</span>
            </div>
          </div>

          {/* Year-over-year comparison table */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar size={13} className="text-gold" /> Year-over-Year Comparison
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left py-2">Month</th>
                    <th className="text-center py-2">2025</th>
                    <th className="text-center py-2">2026</th>
                    <th className="text-center py-2">Change</th>
                    <th className="text-center py-2">Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonMonths.map(m => {
                    const change = m.thisYear - m.lastYear;
                    const pct = Math.round((change / m.lastYear) * 100);
                    return (
                      <tr key={m.month} className="border-b border-border/30">
                        <td className="py-2.5 font-medium">{m.month}</td>
                        <td className="py-2.5 text-center text-muted">{fmtCurrency(m.lastYear)}</td>
                        <td className="py-2.5 text-center font-bold">{fmtCurrency(m.thisYear)}</td>
                        <td className={`py-2.5 text-center font-bold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {change >= 0 ? "+" : ""}{fmtCurrency(change)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            pct >= 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                          }`}>
                            {pct >= 0 ? "+" : ""}{pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {comparisonMonths.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-bold text-xs">
                    <td className="py-3">Average</td>
                    <td className="py-3 text-center text-muted">{fmtCurrency(Math.round(comparisonMonths.reduce((s, m) => s + m.lastYear, 0) / comparisonMonths.length))}</td>
                    <td className="py-3 text-center">{fmtCurrency(Math.round(comparisonMonths.reduce((s, m) => s + m.thisYear, 0) / comparisonMonths.length))}</td>
                    <td className="py-3 text-center text-emerald-400">
                      +{fmtCurrency(Math.round(comparisonMonths.reduce((s, m) => s + (m.thisYear - m.lastYear), 0) / comparisonMonths.length))}
                    </td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-400/10 text-emerald-400">
                        +{Math.round(comparisonMonths.reduce((s, m) => s + ((m.thisYear - m.lastYear) / m.lastYear) * 100, 0) / comparisonMonths.length)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Client revenue breakdown */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users size={13} className="text-purple-400" /> Client Revenue Breakdown
            </h2>
            <div className="space-y-1.5">
              {[...MOCK_CLIENTS].sort((a, b) => b.mrr - a.mrr).map(client => {
                const maxClientMRR = Math.max(...MOCK_CLIENTS.map(c => c.mrr));
                return (
                  <div key={client.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                    <span className="text-[10px] font-medium w-36 truncate">{client.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(client.mrr / maxClientMRR) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-gold w-16 text-right">{fmtCurrency(client.mrr)}</span>
                    <span className="text-[9px] text-muted w-10 text-right">{Math.round((client.mrr / currentMRR) * 100)}%</span>
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
