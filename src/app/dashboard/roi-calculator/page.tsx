"use client";

import { useState } from "react";
import {
  Calculator, Copy, TrendingUp, DollarSign, Clock,
  BarChart3, Users, Target, ArrowUpRight, Share2,
  FileText, Layers, Zap
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type ROITab = "calculator" | "tracking" | "benchmarks" | "reports";

interface MonthlyTracking {
  month: string;
  leads: number;
  deals: number;
  revenue: number;
  investment: number;
  roi: number;
}

interface IndustryBenchmark {
  industry: string;
  avgROI: number;
  avgLeads: number;
  avgCloseRate: number;
  avgDealValue: number;
}

const MOCK_TRACKING: MonthlyTracking[] = [];

const BENCHMARKS: IndustryBenchmark[] = [
  { industry: "Dental", avgROI: 312, avgLeads: 35, avgCloseRate: 18, avgDealValue: 3500 },
  { industry: "Real Estate", avgROI: 245, avgLeads: 42, avgCloseRate: 12, avgDealValue: 5000 },
  { industry: "Fitness/Gym", avgROI: 280, avgLeads: 55, avgCloseRate: 22, avgDealValue: 1200 },
  { industry: "Salon/Spa", avgROI: 195, avgLeads: 30, avgCloseRate: 20, avgDealValue: 2000 },
  { industry: "Restaurant", avgROI: 165, avgLeads: 25, avgCloseRate: 15, avgDealValue: 1800 },
  { industry: "Law Firm", avgROI: 420, avgLeads: 20, avgCloseRate: 10, avgDealValue: 8000 },
  { industry: "E-commerce", avgROI: 350, avgLeads: 60, avgCloseRate: 8, avgDealValue: 2500 },
  { industry: "Coaching", avgROI: 290, avgLeads: 40, avgCloseRate: 15, avgDealValue: 3000 },
];

const SERVICES = [
  { name: "Social Media Management", multiplier: 2.5, timeSaved: 20 },
  { name: "Paid Ads (Meta/Google)", multiplier: 4.0, timeSaved: 15 },
  { name: "SEO & Content", multiplier: 3.0, timeSaved: 25 },
  { name: "Video Production", multiplier: 2.0, timeSaved: 30 },
  { name: "Email Marketing", multiplier: 3.5, timeSaved: 10 },
  { name: "AI Automation", multiplier: 5.0, timeSaved: 40 },
];

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ROICalculatorPage() {
  const [tab, setTab] = useState<ROITab>("calculator");
  const [inputs, setInputs] = useState({
    monthlyBudget: 2500,
    adSpend: 1000,
    avgDealValue: 3000,
    currentLeadsPerMonth: 10,
    currentCloseRate: 10,
    hoursPerWeek: 20,
    hourlyRate: 75,
  });
  const [selectedIndustry, setSelectedIndustry] = useState("Dental");
  const [selectedServices, setSelectedServices] = useState(["Social Media Management", "Paid Ads (Meta/Google)"]);

  // Core calculations
  const projectedLeads = Math.round(inputs.currentLeadsPerMonth * 3.5);
  const projectedCloseRate = Math.min(inputs.currentCloseRate * 1.8, 40);
  const projectedDeals = Math.round(projectedLeads * (projectedCloseRate / 100));
  const projectedRevenue = projectedDeals * inputs.avgDealValue;
  const totalInvestment = inputs.monthlyBudget + inputs.adSpend;
  const roi = totalInvestment > 0 ? Math.round(((projectedRevenue - totalInvestment) / totalInvestment) * 100) : 0;
  const currentRevenue = Math.round(inputs.currentLeadsPerMonth * (inputs.currentCloseRate / 100)) * inputs.avgDealValue;
  const revenueIncrease = projectedRevenue - currentRevenue;

  // Time savings
  const timeSaved = selectedServices.reduce((s, svc) => {
    const service = SERVICES.find(sv => sv.name === svc);
    return s + (service?.timeSaved || 0);
  }, 0);
  const timeSavingsValue = timeSaved * 4.33 * inputs.hourlyRate / 60;

  // Break-even
  const monthlyProfit = projectedRevenue - totalInvestment;
  const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(totalInvestment / monthlyProfit) : 0;

  // 12-month projection
  const yearlyRevenue = projectedRevenue * 12;
  const yearlyInvestment = totalInvestment * 12;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const yearlyROI = yearlyInvestment > 0 ? Math.round(((yearlyRevenue - yearlyInvestment) / yearlyInvestment) * 100) : 0;

  const copyResults = () => {
    const text = `ROI Projection for Your Business

Current Situation:
- ${inputs.currentLeadsPerMonth} leads/month
- ${inputs.currentCloseRate}% close rate
- ${fmtCurrency(currentRevenue)}/month revenue

With ShortStack (${fmtCurrency(inputs.monthlyBudget)}/mo + ${fmtCurrency(inputs.adSpend)} ad spend):
- ${projectedLeads} leads/month (+${Math.round((projectedLeads / Math.max(inputs.currentLeadsPerMonth, 1) - 1) * 100)}%)
- ${projectedCloseRate.toFixed(0)}% close rate
- ${projectedDeals} new clients/month
- ${fmtCurrency(projectedRevenue)}/month projected revenue
- ${fmtCurrency(revenueIncrease)}/month increase
- ${roi}% ROI

12-Month Revenue: ${fmtCurrency(yearlyRevenue)}
Break-even: ${breakEvenMonths} month${breakEvenMonths !== 1 ? "s" : ""}`;

    navigator.clipboard.writeText(text);
  };

  const benchmark = BENCHMARKS.find(b => b.industry === selectedIndustry);

  const TABS: { id: ROITab; label: string; icon: React.ReactNode }[] = [
    { id: "calculator", label: "Calculator", icon: <Calculator size={13} /> },
    { id: "tracking", label: "Monthly Tracking", icon: <BarChart3 size={13} /> },
    { id: "benchmarks", label: "Benchmarks", icon: <Target size={13} /> },
    { id: "reports", label: "Reports", icon: <FileText size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Calculator size={28} />}
        title="ROI Calculator"
        subtitle="Show prospects their potential ROI."
        gradient="sunset"
        actions={
          <button onClick={copyResults} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5"><Copy size={12} /> Copy Report</button>
        }
      />

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

      {/* Calculator Tab */}
      {tab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="card space-y-4">
              <h2 className="section-header flex items-center gap-2"><DollarSign size={13} className="text-gold" /> Client Inputs</h2>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Monthly Agency Fee</label>
                  <span className="text-xs font-bold text-gold">{fmtCurrency(inputs.monthlyBudget)}</span>
                </div>
                <input type="range" min={500} max={10000} step={100} value={inputs.monthlyBudget}
                  onChange={e => setInputs({ ...inputs, monthlyBudget: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Monthly Ad Spend</label>
                  <span className="text-xs font-bold text-gold">{fmtCurrency(inputs.adSpend)}</span>
                </div>
                <input type="range" min={0} max={10000} step={100} value={inputs.adSpend}
                  onChange={e => setInputs({ ...inputs, adSpend: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Average Deal/Client Value</label>
                  <span className="text-xs font-bold text-gold">{fmtCurrency(inputs.avgDealValue)}</span>
                </div>
                <input type="range" min={500} max={20000} step={100} value={inputs.avgDealValue}
                  onChange={e => setInputs({ ...inputs, avgDealValue: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Current Leads Per Month</label>
                  <span className="text-xs font-bold">{inputs.currentLeadsPerMonth}</span>
                </div>
                <input type="range" min={1} max={100} value={inputs.currentLeadsPerMonth}
                  onChange={e => setInputs({ ...inputs, currentLeadsPerMonth: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Current Close Rate (%)</label>
                  <span className="text-xs font-bold">{inputs.currentCloseRate}%</span>
                </div>
                <input type="range" min={1} max={50} value={inputs.currentCloseRate}
                  onChange={e => setInputs({ ...inputs, currentCloseRate: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
            </div>

            {/* Time Savings Calculator */}
            <div className="card space-y-3">
              <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Time Savings Calculator</h2>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted">Hours/week spent on marketing</label>
                  <span className="text-xs font-bold">{inputs.hoursPerWeek}h</span>
                </div>
                <input type="range" min={1} max={60} value={inputs.hoursPerWeek}
                  onChange={e => setInputs({ ...inputs, hoursPerWeek: parseInt(e.target.value) })}
                  className="w-full accent-gold" />
              </div>
              <div>
                <label className="text-[10px] text-muted mb-1 block">Services included</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SERVICES.map(svc => (
                    <button key={svc.name}
                      onClick={() => setSelectedServices(prev => prev.includes(svc.name) ? prev.filter(s => s !== svc.name) : [...prev, svc.name])}
                      className={`text-[9px] p-2 rounded-lg border text-left ${selectedServices.includes(svc.name) ? "border-gold bg-gold/5 text-gold" : "border-border text-muted"}`}>
                      {svc.name}
                      <span className="block text-[8px] text-muted">~{svc.timeSaved}h saved/mo</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-400/5 border border-blue-400/10 text-center">
                <p className="text-[10px] text-blue-400 mb-1">Estimated Time Saved</p>
                <p className="text-xl font-bold text-blue-400">{timeSaved}h/month</p>
                <p className="text-[10px] text-muted">Worth ~{fmtCurrency(Math.round(timeSavingsValue))}/month</p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3">
            <div className="card text-center border-gold/10">
              <p className="text-[10px] text-muted mb-1">Projected Monthly ROI</p>
              <p className={`text-5xl font-extrabold ${roi > 0 ? "text-emerald-400" : "text-red-400"}`}>{roi}%</p>
              <p className="text-[10px] text-muted mt-1">on {fmtCurrency(totalInvestment)}/mo investment</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="card text-center">
                <p className="text-[9px] text-muted">Projected Leads</p>
                <p className="text-lg font-bold text-gold">{projectedLeads}/mo</p>
                <p className="text-[8px] text-emerald-400">+{Math.round((projectedLeads / Math.max(inputs.currentLeadsPerMonth, 1) - 1) * 100)}%</p>
              </div>
              <div className="card text-center">
                <p className="text-[9px] text-muted">New Clients</p>
                <p className="text-lg font-bold text-gold">{projectedDeals}/mo</p>
              </div>
              <div className="card text-center">
                <p className="text-[9px] text-muted">Projected Revenue</p>
                <p className="text-lg font-bold text-emerald-400">{fmtCurrency(projectedRevenue)}</p>
              </div>
              <div className="card text-center">
                <p className="text-[9px] text-muted">Revenue Increase</p>
                <p className="text-lg font-bold text-emerald-400">+{fmtCurrency(revenueIncrease)}</p>
              </div>
            </div>

            {/* Before vs After */}
            <div className="card">
              <h2 className="section-header">Before vs After</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-red-400/5 border border-red-400/10">
                  <p className="text-[9px] text-red-400 uppercase tracking-wider mb-2">Current</p>
                  <p className="text-xs"><span className="text-muted">Leads:</span> {inputs.currentLeadsPerMonth}/mo</p>
                  <p className="text-xs"><span className="text-muted">Close rate:</span> {inputs.currentCloseRate}%</p>
                  <p className="text-xs"><span className="text-muted">Revenue:</span> {fmtCurrency(currentRevenue)}/mo</p>
                  <p className="text-xs"><span className="text-muted">Time spent:</span> {inputs.hoursPerWeek}h/week</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
                  <p className="text-[9px] text-emerald-400 uppercase tracking-wider mb-2">With ShortStack</p>
                  <p className="text-xs text-emerald-400"><span className="text-muted">Leads:</span> {projectedLeads}/mo</p>
                  <p className="text-xs text-emerald-400"><span className="text-muted">Close rate:</span> {projectedCloseRate.toFixed(0)}%</p>
                  <p className="text-xs text-emerald-400"><span className="text-muted">Revenue:</span> {fmtCurrency(projectedRevenue)}/mo</p>
                  <p className="text-xs text-emerald-400"><span className="text-muted">Time saved:</span> {timeSaved}h/mo</p>
                </div>
              </div>
            </div>

            {/* Revenue Impact */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><TrendingUp size={13} className="text-gold" /> Revenue Impact Projection</h2>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-surface-light text-center">
                  <p className="text-[9px] text-muted">3 Months</p>
                  <p className="text-sm font-bold text-gold">{fmtCurrency(projectedRevenue * 3)}</p>
                </div>
                <div className="p-2 rounded-lg bg-surface-light text-center">
                  <p className="text-[9px] text-muted">6 Months</p>
                  <p className="text-sm font-bold text-gold">{fmtCurrency(projectedRevenue * 6)}</p>
                </div>
                <div className="p-2 rounded-lg bg-surface-light text-center">
                  <p className="text-[9px] text-muted">12 Months</p>
                  <p className="text-sm font-bold text-gold">{fmtCurrency(yearlyRevenue)}</p>
                </div>
              </div>
            </div>

            {/* Break-even */}
            <div className="card text-center">
              <Zap size={16} className="mx-auto text-gold mb-1" />
              <p className="text-[10px] text-muted">Break-Even Timeline</p>
              <p className="text-xl font-bold text-gold">{breakEvenMonths > 0 ? `${breakEvenMonths} month${breakEvenMonths !== 1 ? "s" : ""}` : "Immediate"}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={copyResults} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"><Copy size={12} /> Copy for Proposal</button>
              <button className="btn-secondary text-xs flex items-center gap-1.5"><Share2 size={12} /> Share with Client</button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Tab */}
      {tab === "tracking" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Monthly ROI Tracking</h2>
            <div className="flex items-end gap-2 h-40 mb-3">
              {MOCK_TRACKING.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-6 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10">{m.roi}% ROI</div>
                  <div className="w-full rounded-t-md bg-gold/80 hover:bg-gold" style={{ height: `${(m.roi / 400) * 100}%`, minHeight: 4 }} />
                  <span className="text-[8px] text-muted">{m.month.split(" ")[0]}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {MOCK_TRACKING.map(m => (
                <div key={m.month} className="flex items-center gap-3 p-2 rounded-lg bg-surface-light text-xs">
                  <span className="w-20 text-muted">{m.month}</span>
                  <span className="w-16">{m.leads} leads</span>
                  <span className="w-16">{m.deals} deals</span>
                  <span className="w-20 text-emerald-400">{fmtCurrency(m.revenue)}</span>
                  <span className="w-20 text-muted">-{fmtCurrency(m.investment)}</span>
                  <span className={`font-bold ml-auto ${m.roi > 200 ? "text-emerald-400" : "text-gold"}`}>{m.roi}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* ROI by Service */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-blue-400" /> ROI by Service</h2>
            <div className="space-y-2">
              {SERVICES.map(svc => {
                const svcROI = Math.round(svc.multiplier * 100);
                return (
                  <div key={svc.name} className="flex items-center gap-3">
                    <span className="text-xs w-40 truncate">{svc.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(svcROI / 500) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gold w-12 text-right">{svcROI}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Benchmarks Tab */}
      {tab === "benchmarks" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Target size={13} className="text-gold" /> Industry Benchmarks</h2>
            <div className="flex gap-2 mb-3 flex-wrap">
              {BENCHMARKS.map(b => (
                <button key={b.industry} onClick={() => setSelectedIndustry(b.industry)}
                  className={`text-[10px] px-3 py-1 rounded-lg border transition-all ${selectedIndustry === b.industry ? "border-gold bg-gold/5 text-gold" : "border-border text-muted"}`}>
                  {b.industry}
                </button>
              ))}
            </div>
            {benchmark && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <p className="text-[10px] text-muted">Avg ROI</p>
                  <p className="text-xl font-bold text-gold">{benchmark.avgROI}%</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <p className="text-[10px] text-muted">Avg Leads/mo</p>
                  <p className="text-xl font-bold">{benchmark.avgLeads}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <p className="text-[10px] text-muted">Avg Close Rate</p>
                  <p className="text-xl font-bold">{benchmark.avgCloseRate}%</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <p className="text-[10px] text-muted">Avg Deal Value</p>
                  <p className="text-xl font-bold">{fmtCurrency(benchmark.avgDealValue)}</p>
                </div>
              </div>
            )}
          </div>
          {/* Your Client vs Benchmark */}
          {benchmark && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><ArrowUpRight size={13} className="text-emerald-400" /> Your Client vs {selectedIndustry} Benchmark</h2>
              <div className="space-y-3">
                {[
                  { metric: "ROI", yours: roi, bench: benchmark.avgROI, suffix: "%" },
                  { metric: "Leads/mo", yours: projectedLeads, bench: benchmark.avgLeads, suffix: "" },
                  { metric: "Close Rate", yours: Math.round(projectedCloseRate), bench: benchmark.avgCloseRate, suffix: "%" },
                  { metric: "Deal Value", yours: inputs.avgDealValue, bench: benchmark.avgDealValue, suffix: "" },
                ].map(item => {
                  const better = item.yours >= item.bench;
                  return (
                    <div key={item.metric} className="flex items-center gap-3">
                      <span className="text-xs w-24">{item.metric}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className={better ? "text-emerald-400" : "text-red-400"}>You: {item.suffix === "$" ? fmtCurrency(item.yours) : `${item.yours}${item.suffix}`}</span>
                          <span className="text-muted">Avg: {item.suffix === "$" ? fmtCurrency(item.bench) : `${item.bench}${item.suffix}`}</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-light overflow-hidden relative">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min((item.yours / Math.max(item.bench, 1)) * 50, 100)}%` }} />
                          <div className="absolute top-0 bottom-0 w-0.5 bg-muted/30" style={{ left: "50%" }} />
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold w-16 text-right ${better ? "text-emerald-400" : "text-red-400"}`}>
                        {better ? "Above" : "Below"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Cost Comparison */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><DollarSign size={13} className="text-blue-400" /> Cost Comparison: DIY vs Agency</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-red-400/5 border border-red-400/10">
                <p className="text-xs font-bold text-red-400 mb-2">Doing It Yourself</p>
                <div className="space-y-1 text-[10px]">
                  <p>Hiring in-house team: <span className="text-red-400">{fmtCurrency(12000)}/mo</span></p>
                  <p>Tools & subscriptions: <span className="text-red-400">{fmtCurrency(500)}/mo</span></p>
                  <p>Ad management: <span className="text-red-400">{fmtCurrency(2000)}/mo</span></p>
                  <p>Training & overhead: <span className="text-red-400">{fmtCurrency(1000)}/mo</span></p>
                  <p className="pt-1 border-t border-red-400/10 font-bold">Total: <span className="text-red-400">{fmtCurrency(15500)}/mo</span></p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
                <p className="text-xs font-bold text-emerald-400 mb-2">ShortStack Agency</p>
                <div className="space-y-1 text-[10px]">
                  <p>Agency fee: <span className="text-emerald-400">{fmtCurrency(inputs.monthlyBudget)}/mo</span></p>
                  <p>Ad spend: <span className="text-emerald-400">{fmtCurrency(inputs.adSpend)}/mo</span></p>
                  <p>All tools included: <span className="text-emerald-400">{fmtCurrency(0)}/mo</span></p>
                  <p>Full team access: <span className="text-emerald-400">{fmtCurrency(0)}/mo</span></p>
                  <p className="pt-1 border-t border-emerald-400/10 font-bold">Total: <span className="text-emerald-400">{fmtCurrency(totalInvestment)}/mo</span></p>
                </div>
              </div>
            </div>
            <p className="text-center text-xs mt-3">
              <span className="text-emerald-400 font-bold">Save {fmtCurrency(15500 - totalInvestment)}/mo</span> <span className="text-muted">with ShortStack</span>
            </p>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><FileText size={13} className="text-gold" /> ROI Report Generator</h2>
            <p className="text-[10px] text-muted mb-3">Generate a professional ROI report to share with clients</p>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-surface-light border border-border">
                <div className="text-center mb-4">
                  <p className="text-lg font-bold text-gold">ShortStack ROI Report</p>
                  <p className="text-[10px] text-muted">
                    Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-surface">
                    <p className="text-[9px] text-muted">Monthly ROI</p>
                    <p className="text-2xl font-bold text-emerald-400">{roi}%</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-surface">
                    <p className="text-[9px] text-muted">12-Month Revenue</p>
                    <p className="text-2xl font-bold text-gold">{fmtCurrency(yearlyRevenue)}</p>
                  </div>
                </div>
                <div className="text-[10px] text-muted space-y-1">
                  <p>Investment: {fmtCurrency(totalInvestment)}/mo ({fmtCurrency(yearlyInvestment)}/yr)</p>
                  <p>Projected Revenue: {fmtCurrency(projectedRevenue)}/mo ({fmtCurrency(yearlyRevenue)}/yr)</p>
                  <p>Net Gain: {fmtCurrency(yearlyRevenue - yearlyInvestment)}/yr</p>
                  <p>Break-even: {breakEvenMonths > 0 ? `${breakEvenMonths} months` : "Immediate"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={copyResults} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"><Copy size={12} /> Copy as Text</button>
                <button className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"><FileText size={12} /> Download PDF</button>
                <button className="btn-secondary text-xs flex items-center gap-1.5"><Share2 size={12} /> Share Link</button>
              </div>
            </div>
          </div>
          {/* Client-specific ROI cards */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Users size={13} className="text-blue-400" /> Client-Specific ROI</h2>
            <div className="space-y-2">
              {([] as string[]).length === 0 && (
                <p className="text-xs text-muted py-4 text-center">No client data available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
