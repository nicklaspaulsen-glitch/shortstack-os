"use client";

import { useState } from "react";
import {
  TrendingUp, DollarSign, Target, AlertTriangle,
  BarChart3, Calendar, ArrowUpRight,
  Layers, PieChart, Clock, Users,
  Zap, Star, Shield
} from "lucide-react";
import EmptyState from "@/components/empty-state";

type ForecastTab = "overview" | "scenarios" | "renewals" | "services";

interface ClientRevenue {
  name: string;
  mrr: number;
  health: number;
  renewalDate: string;
  upsellPotential: string;
  service: string;
  months: number;
}

const MOCK_CLIENTS: ClientRevenue[] = [];

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ForecastPage() {
  const [tab, setTab] = useState<ForecastTab>("overview");
  const [forecastRange, setForecastRange] = useState<3 | 6 | 12>(6);
  const [scenario, setScenario] = useState<"best" | "expected" | "worst">("expected");

  const currentMRR = MOCK_CLIENTS.reduce((s, c) => s + c.mrr, 0);
  const arr = currentMRR * 12;
  const clientCount = MOCK_CLIENTS.length;
  const avgMRR = clientCount ? Math.round(currentMRR / clientCount) : 0;
  const churnRisk = MOCK_CLIENTS.filter(c => c.health < 50).length;
  const avgHealth = clientCount ? Math.round(MOCK_CLIENTS.reduce((s, c) => s + c.health, 0) / clientCount) : 0;

  // Growth rates for scenarios
  const growthRates = { best: 0.12, expected: 0.07, worst: -0.02 };
  const churnRates = { best: 0.02, expected: 0.05, worst: 0.12 };

  const monthlyGrowth = growthRates[scenario];
  const monthlyChurn = churnRates[scenario];

  // Build projection
  const projection: { month: string; revenue: number; cumulative: number }[] = [];
  let running = currentMRR;
  for (let i = 0; i < 12; i++) {
    const d = new Date(2026, 3 + i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    running = running * (1 + monthlyGrowth - monthlyChurn);
    const cum = projection.length > 0 ? projection[projection.length - 1].cumulative + running : running;
    projection.push({ month: label, revenue: Math.round(running), cumulative: Math.round(cum) });
  }

  const projected3 = projection[2]?.revenue || 0;
  const projected6 = projection[5]?.revenue || 0;
  const projected12 = projection[11]?.revenue || 0;

  // Cash flow projection
  const monthlyCosts = 8500;
  const cashFlow = projection.map(p => ({ ...p, profit: p.revenue - monthlyCosts }));

  // Break-even
  const breakEvenMonth = cashFlow.findIndex(c => c.profit > 0);

  // Revenue by service
  const serviceRevenue: Record<string, number> = {};
  MOCK_CLIENTS.forEach(c => { serviceRevenue[c.service] = (serviceRevenue[c.service] || 0) + c.mrr; });

  // Historical (mock)
  const historicalData = [
    { month: "Jan", revenue: 12500 }, { month: "Feb", revenue: 14200 },
    { month: "Mar", revenue: 16800 }, { month: "Apr", revenue: currentMRR },
  ];

  const maxProjected = Math.max(...projection.map(p => p.revenue), 1);

  const TABS: { id: ForecastTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <TrendingUp size={13} /> },
    { id: "scenarios", label: "Scenarios", icon: <Layers size={13} /> },
    { id: "renewals", label: "Renewals", icon: <Calendar size={13} /> },
    { id: "services", label: "By Service", icon: <PieChart size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><TrendingUp size={18} className="text-gold" /> Revenue Forecast</h1>
          <p className="text-xs text-muted mt-0.5">Projections based on MRR, pipeline deals, and close probability</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface rounded-lg p-0.5">
            {([3, 6, 12] as const).map(r => (
              <button key={r} onClick={() => setForecastRange(r)}
                className={`px-2.5 py-1 text-[10px] rounded-md ${forecastRange === r ? "bg-gold text-black font-medium" : "text-muted"}`}>
                {r}mo
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">MRR</p></div>
          <p className="text-lg font-bold text-gold">{fmtCurrency(currentMRR)}</p>
          <p className="text-[10px] text-emerald-400 flex items-center gap-0.5"><ArrowUpRight size={10} /> +12% vs last month</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><BarChart3 size={12} className="text-blue-400" /><p className="text-[10px] text-muted uppercase tracking-wider">ARR</p></div>
          <p className="text-lg font-bold text-blue-400">{fmtCurrency(arr)}</p>
          <p className="text-[10px] text-muted">{clientCount} clients</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Target size={12} className="text-purple-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Avg MRR</p></div>
          <p className="text-lg font-bold text-purple-400">{fmtCurrency(avgMRR)}</p>
          <p className="text-[10px] text-muted">per client</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle size={12} className="text-red-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Churn Risk</p></div>
          <p className="text-lg font-bold text-red-400">{churnRisk}</p>
          <p className="text-[10px] text-muted">clients at risk</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Star size={12} className="text-emerald-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Health</p></div>
          <p className="text-lg font-bold text-emerald-400">{avgHealth}%</p>
          <p className="text-[10px] text-muted">avg score</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {MOCK_CLIENTS.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="No client data yet"
          description="Add clients to see revenue forecasts"
          actionLabel="Add Clients"
          actionHref="/dashboard/clients"
        />
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Projection Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="card p-3 text-center"><p className="text-[10px] text-muted">3 Months</p><p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected3)}/mo</p></div>
            <div className="card p-3 text-center"><p className="text-[10px] text-muted">6 Months</p><p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected6)}/mo</p></div>
            <div className="card p-3 text-center"><p className="text-[10px] text-muted">12 Months</p><p className="text-lg font-bold text-gold mt-1">{fmtCurrency(projected12)}/mo</p></div>
          </div>

          {/* Chart */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><BarChart3 size={13} className="text-gold" /> Projected Monthly Revenue</p>
            <div className="flex items-end gap-1 h-40">
              {projection.slice(0, forecastRange).map((p, idx) => {
                const h = (p.revenue / maxProjected) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10">{fmtCurrency(p.revenue)}</div>
                    <div className="w-full rounded-t-md bg-gold/80 hover:bg-gold transition-colors" style={{ height: `${h}%`, minHeight: 4 }} />
                    <span className="text-[8px] text-muted">{p.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical Comparison */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Historical vs Projected</h2>
            <div className="flex items-end gap-2 h-32">
              {historicalData.map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-blue-400/50" style={{ height: `${(h.revenue / maxProjected) * 100}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-muted">{h.month}</span>
                  <span className="text-[8px] text-blue-400">{fmtCurrency(h.revenue)}</span>
                </div>
              ))}
              <div className="w-px h-full bg-border" />
              {projection.slice(0, 4).map((p, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-gold/50" style={{ height: `${(p.revenue / maxProjected) * 100}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-muted">{p.month}</span>
                  <span className="text-[8px] text-gold">{fmtCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-blue-400/50" /> Historical</span>
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-gold/50" /> Projected</span>
            </div>
          </div>

          {/* Cash Flow */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><DollarSign size={13} className="text-emerald-400" /> Cash Flow Projection</h2>
            <div className="space-y-1">
              {cashFlow.slice(0, forecastRange).map((cf, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-muted">{cf.month}</span>
                  <span className="w-20 text-right">{fmtCurrency(cf.revenue)}</span>
                  <span className="w-20 text-right text-muted">-{fmtCurrency(monthlyCosts)}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((cf.profit / cf.revenue) * 100, 100)}%`, background: cf.profit > 0 ? "#10b981" : "#ef4444" }} />
                  </div>
                  <span className={`w-20 text-right font-bold ${cf.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtCurrency(cf.profit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Churn Prediction */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><AlertTriangle size={13} className="text-red-400" /> Churn Prediction</h2>
            <div className="space-y-2">
              {MOCK_CLIENTS.filter(c => c.health < 60).sort((a, b) => a.health - b.health).map(client => (
                <div key={client.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${client.health < 40 ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                    {client.health}%
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{client.name}</p>
                    <p className="text-[10px] text-muted">{fmtCurrency(client.mrr)}/mo - {client.service}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${client.health < 40 ? "text-red-400" : "text-yellow-400"}`}>
                      {client.health < 40 ? "High Risk" : "At Risk"}
                    </p>
                    <p className="text-[9px] text-muted">Renewal: {client.renewalDate}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scenarios Tab */}
      {tab === "scenarios" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Scenario Modeling</h2>
            <div className="flex gap-2 mb-4">
              {(["best", "expected", "worst"] as const).map(s => (
                <button key={s} onClick={() => setScenario(s)}
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                    scenario === s ? "border-gold bg-gold/[0.05]" : "border-border"
                  }`}>
                  <p className="text-xs font-bold capitalize">{s} Case</p>
                  <p className="text-[10px] text-muted">
                    {s === "best" ? "+12% growth, 2% churn" : s === "expected" ? "+7% growth, 5% churn" : "-2% growth, 12% churn"}
                  </p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-surface-light text-center">
                <p className="text-[10px] text-muted">3 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected3)}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-light text-center">
                <p className="text-[10px] text-muted">6 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected6)}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-light text-center">
                <p className="text-[10px] text-muted">12 Month MRR</p>
                <p className="text-lg font-bold text-gold">{fmtCurrency(projected12)}</p>
              </div>
            </div>
          </div>

          {/* Growth Rate Calculator */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-emerald-400" /> Growth Rate Calculator</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted">Monthly Growth</p>
                <p className="text-xl font-bold text-emerald-400">{(monthlyGrowth * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Monthly Churn</p>
                <p className="text-xl font-bold text-red-400">{(monthlyChurn * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Net Growth</p>
                <p className={`text-xl font-bold ${(monthlyGrowth - monthlyChurn) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {((monthlyGrowth - monthlyChurn) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Break-even */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Shield size={13} className="text-blue-400" /> Break-Even Analysis</h2>
            <div className="text-center py-4">
              <p className="text-[10px] text-muted">Monthly Operating Costs: {fmtCurrency(monthlyCosts)}</p>
              <p className="text-2xl font-bold text-gold mt-2">
                {breakEvenMonth >= 0 ? `Already Profitable` : `${Math.abs(breakEvenMonth)} months to break-even`}
              </p>
              <p className="text-[10px] text-muted mt-1">Current margin: {fmtCurrency(currentMRR - monthlyCosts)}/mo ({Math.round(((currentMRR - monthlyCosts) / currentMRR) * 100)}%)</p>
            </div>
          </div>
        </div>
      )}

      {/* Renewals Tab */}
      {tab === "renewals" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-gold" /> Client Renewal Calendar</h2>
            <div className="space-y-2">
              {[...MOCK_CLIENTS].sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).map(client => {
                const daysUntil = Math.ceil((new Date(client.renewalDate).getTime() - new Date("2026-04-14").getTime()) / 86400000);
                return (
                  <div key={client.name} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                    <div className="text-center w-14 shrink-0">
                      <p className="text-[9px] text-muted">{new Date(client.renewalDate).toLocaleDateString("en-US", { month: "short" })}</p>
                      <p className="text-lg font-bold leading-none">{new Date(client.renewalDate).getDate()}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{client.name}</p>
                      <p className="text-[10px] text-muted">{client.service} - {fmtCurrency(client.mrr)}/mo - {client.months} months</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${daysUntil < 14 ? "text-red-400" : daysUntil < 30 ? "text-yellow-400" : "text-emerald-400"}`}>
                        {daysUntil} days
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${client.health > 70 ? "bg-emerald-400" : client.health > 40 ? "bg-yellow-400" : "bg-red-400"}`} />
                        <span className="text-[9px] text-muted">{client.health}% health</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Upsell Opportunities */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><ArrowUpRight size={13} className="text-emerald-400" /> Upsell Opportunities</h2>
            <div className="space-y-2">
              {MOCK_CLIENTS.filter(c => c.upsellPotential && !c.upsellPotential.includes("Risk")).map(client => (
                <div key={client.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <Zap size={14} className="text-gold shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{client.name}</p>
                    <p className="text-[10px] text-muted">Currently: {client.service} at {fmtCurrency(client.mrr)}/mo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gold">{client.upsellPotential}</p>
                    <p className="text-[9px] text-emerald-400">+{fmtCurrency(500)}-{fmtCurrency(2000)}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {tab === "services" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><PieChart size={13} className="text-gold" /> Revenue by Service Tier</h2>
            <div className="space-y-3">
              {Object.entries(serviceRevenue).sort((a, b) => b[1] - a[1]).map(([service, rev]) => {
                const pct = Math.round((rev / currentMRR) * 100);
                const color = service === "Enterprise" ? "#C9A84C" : service === "Growth" ? "#3b82f6" : "#8b5cf6";
                const count = MOCK_CLIENTS.filter(c => c.service === service).length;
                return (
                  <div key={service} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-xs font-bold">{service}</span>
                        <span className="text-[10px] text-muted">({count} client{count !== 1 ? "s" : ""})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold" style={{ color }}>{fmtCurrency(rev)}/mo</span>
                        <span className="text-[10px] text-muted ml-2">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Per-client breakdown */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Users size={13} className="text-blue-400" /> Client Revenue Breakdown</h2>
            <div className="space-y-1">
              {[...MOCK_CLIENTS].sort((a, b) => b.mrr - a.mrr).map(client => (
                <div key={client.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                  <span className="text-xs font-medium w-32 truncate">{client.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(client.mrr / Math.max(...MOCK_CLIENTS.map(c => c.mrr))) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gold w-20 text-right">{fmtCurrency(client.mrr)}</span>
                  <span className="text-[9px] text-muted w-12 text-right">{Math.round((client.mrr / currentMRR) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
