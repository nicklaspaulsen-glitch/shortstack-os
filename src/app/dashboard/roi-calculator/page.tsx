"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";
import {
  Calculator, Copy
} from "lucide-react";
import toast from "react-hot-toast";

export default function ROICalculatorPage() {
  useAuth();
  const [inputs, setInputs] = useState({
    monthlyBudget: 2500,
    adSpend: 1000,
    avgDealValue: 3000,
    currentLeadsPerMonth: 10,
    currentCloseRate: 10,
  });

  // Projections based on typical agency results
  const projectedLeads = Math.round(inputs.currentLeadsPerMonth * 3.5);
  const projectedCloseRate = Math.min(inputs.currentCloseRate * 1.8, 40);
  const projectedDeals = Math.round(projectedLeads * (projectedCloseRate / 100));
  const projectedRevenue = projectedDeals * inputs.avgDealValue;
  const totalInvestment = inputs.monthlyBudget + inputs.adSpend;
  const roi = totalInvestment > 0 ? Math.round(((projectedRevenue - totalInvestment) / totalInvestment) * 100) : 0;
  const currentRevenue = Math.round(inputs.currentLeadsPerMonth * (inputs.currentCloseRate / 100)) * inputs.avgDealValue;
  const revenueIncrease = projectedRevenue - currentRevenue;

  function copyResults() {
    const text = `ROI Projection for Your Business

Current Situation:
- ${inputs.currentLeadsPerMonth} leads/month
- ${inputs.currentCloseRate}% close rate
- ${formatCurrency(currentRevenue)}/month revenue

With ShortStack (${formatCurrency(inputs.monthlyBudget)}/mo + ${formatCurrency(inputs.adSpend)} ad spend):
- ${projectedLeads} leads/month (${Math.round((projectedLeads / inputs.currentLeadsPerMonth - 1) * 100)}% increase)
- ${projectedCloseRate.toFixed(0)}% close rate
- ${projectedDeals} new clients/month
- ${formatCurrency(projectedRevenue)}/month projected revenue
- ${formatCurrency(revenueIncrease)}/month increase
- ${roi}% ROI

Total investment: ${formatCurrency(totalInvestment)}/month
Projected return: ${formatCurrency(projectedRevenue)}/month`;

    navigator.clipboard.writeText(text);
    toast.success("ROI report copied! Paste into proposal.");
  }

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Calculator size={18} className="text-gold" /> ROI Calculator
        </h1>
        <p className="text-xs text-muted mt-0.5">Show prospects their potential ROI — paste into proposals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="card space-y-4">
          <h2 className="section-header">Client Inputs</h2>

          <div>
            <label className="block text-[10px] text-muted mb-1">Monthly Agency Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
              <input type="number" value={inputs.monthlyBudget} onChange={e => setInputs({ ...inputs, monthlyBudget: parseInt(e.target.value) || 0 })}
                className="input w-full pl-7" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1">Monthly Ad Spend</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
              <input type="number" value={inputs.adSpend} onChange={e => setInputs({ ...inputs, adSpend: parseInt(e.target.value) || 0 })}
                className="input w-full pl-7" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1">Average Deal/Client Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
              <input type="number" value={inputs.avgDealValue} onChange={e => setInputs({ ...inputs, avgDealValue: parseInt(e.target.value) || 0 })}
                className="input w-full pl-7" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1">Current Leads Per Month</label>
            <input type="number" value={inputs.currentLeadsPerMonth} onChange={e => setInputs({ ...inputs, currentLeadsPerMonth: parseInt(e.target.value) || 0 })}
              className="input w-full" />
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1">Current Close Rate (%)</label>
            <input type="number" min={1} max={100} value={inputs.currentCloseRate} onChange={e => setInputs({ ...inputs, currentCloseRate: parseInt(e.target.value) || 0 })}
              className="input w-full" />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <div className="card text-center border-gold/10">
            <p className="text-[10px] text-muted mb-1">Projected Monthly ROI</p>
            <p className={`text-4xl font-extrabold ${roi > 0 ? "text-success" : "text-danger"}`}>{roi}%</p>
            <p className="text-[10px] text-muted mt-1">on {formatCurrency(totalInvestment)}/mo investment</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="card text-center">
              <p className="text-[9px] text-muted">Projected Leads</p>
              <p className="text-lg font-bold text-gold">{projectedLeads}/mo</p>
              <p className="text-[8px] text-success">+{Math.round((projectedLeads / Math.max(inputs.currentLeadsPerMonth, 1) - 1) * 100)}%</p>
            </div>
            <div className="card text-center">
              <p className="text-[9px] text-muted">New Clients</p>
              <p className="text-lg font-bold text-gold">{projectedDeals}/mo</p>
            </div>
            <div className="card text-center">
              <p className="text-[9px] text-muted">Projected Revenue</p>
              <p className="text-lg font-bold text-success">{formatCurrency(projectedRevenue)}</p>
            </div>
            <div className="card text-center">
              <p className="text-[9px] text-muted">Revenue Increase</p>
              <p className="text-lg font-bold text-success">+{formatCurrency(revenueIncrease)}</p>
            </div>
          </div>

          {/* Before vs After */}
          <div className="card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider mb-2">Current</p>
                <p className="text-xs"><span className="text-muted">Leads:</span> {inputs.currentLeadsPerMonth}/mo</p>
                <p className="text-xs"><span className="text-muted">Close rate:</span> {inputs.currentCloseRate}%</p>
                <p className="text-xs"><span className="text-muted">Revenue:</span> {formatCurrency(currentRevenue)}/mo</p>
              </div>
              <div>
                <p className="text-[9px] text-gold uppercase tracking-wider mb-2">With ShortStack</p>
                <p className="text-xs text-success"><span className="text-muted">Leads:</span> {projectedLeads}/mo</p>
                <p className="text-xs text-success"><span className="text-muted">Close rate:</span> {projectedCloseRate.toFixed(0)}%</p>
                <p className="text-xs text-success"><span className="text-muted">Revenue:</span> {formatCurrency(projectedRevenue)}/mo</p>
              </div>
            </div>
          </div>

          <button onClick={copyResults} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
            <Copy size={12} /> Copy ROI Report for Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
