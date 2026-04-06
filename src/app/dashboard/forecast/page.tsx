"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp, DollarSign, Target, AlertTriangle,
  Sparkles, BarChart3
} from "lucide-react";
import toast from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface Deal {
  amount: number;
  status: string;
  close_probability: number | null;
}

const CLOSE_PROB: Record<string, number> = {
  discovery: 0.1,
  proposal: 0.3,
  negotiation: 0.6,
  verbal_yes: 0.85,
  won: 1.0,
  lost: 0,
};

function formatCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ForecastPage() {
  useAuth();
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [pipelineValue, setPipelineValue] = useState(0);
  const [avgDealSize, setAvgDealSize] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [churnRisk, setChurnRisk] = useState(0);
  const [chartData, setChartData] = useState<Array<{ month: string; revenue: number }>>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => { fetchForecast(); }, []);

  async function fetchForecast() {
    setLoading(true);

    const [
      { data: clients },
      { data: deals },
      {},
    ] = await Promise.all([
      supabase.from("clients").select("mrr, health_score, is_active").eq("is_active", true),
      supabase.from("deals").select("amount, status, close_probability"),
      supabase.from("invoices").select("amount, status"),
    ]);

    const allClients = clients || [];
    const allDeals = deals || [] as Deal[];
    const currentMRR = allClients.reduce((s, c) => s + (c.mrr || 0), 0);
    setMrr(currentMRR);
    setClientCount(allClients.length);

    // Churn risk: clients with health_score < 40
    const atRisk = allClients.filter(c => (c.health_score || 50) < 40).length;
    setChurnRisk(atRisk);

    // Pipeline weighted value
    const weighted = allDeals.reduce((s, d) => {
      if (d.status === "won" || d.status === "lost") return s;
      const prob = d.close_probability ?? CLOSE_PROB[d.status] ?? 0.2;
      return s + (d.amount || 0) * prob;
    }, 0);
    setPipelineValue(weighted);

    // Average deal size (won deals)
    const wonDeals = allDeals.filter(d => d.status === "won");
    setAvgDealSize(wonDeals.length > 0
      ? Math.round(wonDeals.reduce((s, d) => s + (d.amount || 0), 0) / wonDeals.length)
      : 0);

    // Build 12-month projection chart
    const months: Array<{ month: string; revenue: number }> = [];
    const now = new Date();
    const monthlyPipeline = weighted / 3; // spread pipeline over 3 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const projected = currentMRR + (i < 3 ? monthlyPipeline * (i + 1) / 3 : monthlyPipeline);
      months.push({ month: label, revenue: Math.round(projected) });
    }
    setChartData(months);
    setLoading(false);
  }

  async function fetchAiAnalysis() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Provide a strategic revenue forecast analysis. Current MRR: ${formatCurrency(mrr)}, ${clientCount} active clients, weighted pipeline: ${formatCurrency(pipelineValue)}, ${churnRisk} clients at churn risk, avg deal size: ${formatCurrency(avgDealSize)}. Give actionable projections for 3, 6, and 12 months. Be concise and data-driven.`,
          context: "revenue_forecast",
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.response || data.message || "No analysis available");
    } catch {
      toast.error("Failed to get AI analysis");
    }
    setAiLoading(false);
  }

  const projected3 = mrr * 3 + pipelineValue;
  const projected6 = mrr * 6 + pipelineValue * 1.5;
  const projected12 = mrr * 12 + pipelineValue * 2;
  const mrrGrowth = mrr > 0 ? "+est" : "0%";
  const ltv = avgDealSize > 0 ? avgDealSize * 12 : mrr * 18;

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center py-20">
        <div className="text-xs text-muted">Loading forecast data...</div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <TrendingUp size={18} className="text-gold" /> Revenue Forecast
          </h1>
          <p className="text-xs text-muted mt-0.5">Projections based on MRR, pipeline deals, and close probability</p>
        </div>
        <button onClick={fetchAiAnalysis} disabled={aiLoading}
          className="btn-primary text-xs flex items-center gap-1.5">
          <Sparkles size={12} /> {aiLoading ? "Analyzing..." : "AI Analysis"}
        </button>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} className="text-gold" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Current MRR</p>
          </div>
          <p className="text-lg font-bold text-gold">{formatCurrency(mrr)}</p>
          <p className="text-[10px] text-muted mt-0.5">{mrrGrowth} growth</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={12} className="text-blue-400" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Pipeline (Weighted)</p>
          </div>
          <p className="text-lg font-bold text-blue-400">{formatCurrency(pipelineValue)}</p>
          <p className="text-[10px] text-muted mt-0.5">Probability-adjusted</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 size={12} className="text-green-400" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Avg Deal Size</p>
          </div>
          <p className="text-lg font-bold text-green-400">{formatCurrency(avgDealSize)}</p>
          <p className="text-[10px] text-muted mt-0.5">LTV: {formatCurrency(ltv)}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Churn Risk</p>
          </div>
          <p className="text-lg font-bold text-red-400">{churnRisk}</p>
          <p className="text-[10px] text-muted mt-0.5">of {clientCount} clients</p>
        </div>
      </div>

      {/* Projections */}
      <div className="section-header text-[10px] uppercase tracking-wider text-muted">Revenue Projections</div>
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted">3 Months</p>
          <p className="text-lg font-bold text-gold mt-1">{formatCurrency(projected3)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted">6 Months</p>
          <p className="text-lg font-bold text-gold mt-1">{formatCurrency(projected6)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted">12 Months</p>
          <p className="text-lg font-bold text-gold mt-1">{formatCurrency(projected12)}</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
          <BarChart3 size={13} className="text-gold" /> Projected Monthly Revenue
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 11 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number) => [`$${value.toLocaleString()}`, "Revenue"]) as any}
              />
              <Bar dataKey="revenue" fill="#C9A84C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-gold" /> AI Revenue Analysis
          </p>
          <div className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
        </div>
      )}
    </div>
  );
}
