"use client";

import { useState } from "react";
import {
  Activity, Heart, AlertTriangle, CheckCircle, Users, DollarSign,
  ChevronRight, TrendingUp, TrendingDown, Clock, Bell, Star,
  BarChart3, ShieldAlert, ThumbsUp, MessageSquare, Zap, Eye,
  ArrowUpRight, ArrowDownRight, Target, Lightbulb, Calendar
} from "lucide-react";
import EmptyState from "@/components/empty-state";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface ClientHealth {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  package_tier: string;
  mrr: number;
  health_score: number;
  is_active: boolean;
  tasks_done: number;
  tasks_total: number;
  content_count: number;
  invoices_pending: number;
  nps: number;
  last_contact: string;
  trend: number;
  engagement: number;
  satisfaction: number;
  risk_factors: string[];
  revenue_trend: number[];
}

const MOCK_CLIENTS: ClientHealth[] = [];

const HEALTH_HISTORY = [
  { month: "Nov", avg: 0 }, { month: "Dec", avg: 0 }, { month: "Jan", avg: 0 },
  { month: "Feb", avg: 0 }, { month: "Mar", avg: 0 }, { month: "Apr", avg: 0 },
];

const HEALTH_ALERTS: { id: string; client: string; type: string; message: string; time: string }[] = [];

const ALGORITHM_WEIGHTS = [
  { factor: "Task Completion", weight: 25, description: "Percentage of assigned tasks completed on time" },
  { factor: "Invoice Status", weight: 20, description: "Outstanding invoices and payment history" },
  { factor: "Engagement Rate", weight: 20, description: "Client responsiveness and content interactions" },
  { factor: "Contact Frequency", weight: 15, description: "Regular touchpoints and meeting attendance" },
  { factor: "Content Volume", weight: 10, description: "Amount of content produced and approved" },
  { factor: "NPS Score", weight: 10, description: "Net Promoter Score from satisfaction surveys" },
];

const RECOMMENDATIONS: Record<string, string[]> = {
  critical: [
    "Schedule an urgent check-in call within 24 hours",
    "Review all outstanding invoices and offer payment plans",
    "Prepare a value demonstration deck showing ROI achieved",
    "Consider offering a complimentary service to rebuild trust",
    "Escalate to account manager for retention strategy",
  ],
  warning: [
    "Send a personalized progress report highlighting wins",
    "Schedule a strategy session to realign on goals",
    "Address outstanding invoices proactively",
    "Increase content delivery frequency",
    "Request feedback on current service satisfaction",
  ],
  healthy: [
    "Explore upsell opportunities for additional services",
    "Request a testimonial or case study participation",
    "Invite to referral program for commission rewards",
    "Share upcoming feature releases for excitement",
    "Consider for client spotlight in community",
  ],
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ClientHealthPage() {
  const [clients] = useState<ClientHealth[]>(MOCK_CLIENTS);
  const [filter, setFilter] = useState<"all" | "healthy" | "warning" | "critical">("all");
  const [sort, setSort] = useState<"health" | "mrr" | "name">("health");
  const [activeTab, setActiveTab] = useState<"overview" | "algorithm" | "alerts" | "nps" | "history">("overview");
  const [selectedClient, setSelectedClient] = useState<ClientHealth | null>(null);
  const [surveyClient, setSurveyClient] = useState("");
  const [surveyScore, setSurveyScore] = useState(8);
  const [surveyFeedback, setSurveyFeedback] = useState("");
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  function getHealthColor(score: number) {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  }

  function getHealthBg(score: number) {
    if (score >= 75) return "bg-green-400/10";
    if (score >= 50) return "bg-yellow-400/10";
    return "bg-red-400/10";
  }

  function getHealthLabel(score: number) {
    if (score >= 75) return "Healthy";
    if (score >= 50) return "Needs Attention";
    return "Critical";
  }

  const filtered = clients
    .filter(c => {
      if (filter === "healthy") return c.health_score >= 75;
      if (filter === "warning") return c.health_score >= 50 && c.health_score < 75;
      if (filter === "critical") return c.health_score < 50;
      return true;
    })
    .sort((a, b) => {
      if (sort === "health") return a.health_score - b.health_score;
      if (sort === "mrr") return b.mrr - a.mrr;
      return a.business_name.localeCompare(b.business_name);
    });

  const avgHealth = clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.health_score, 0) / clients.length) : 0;
  const totalMRR = clients.reduce((s, c) => s + c.mrr, 0);
  const criticalCount = clients.filter(c => c.health_score < 50).length;
  const healthyCount = clients.filter(c => c.health_score >= 75).length;
  const warningCount = clients.filter(c => c.health_score >= 50 && c.health_score < 75).length;
  const avgNPS = (clients.reduce((s, c) => s + c.nps, 0) / clients.length).toFixed(1);
  const atRiskMRR = clients.filter(c => c.health_score < 50).reduce((s, c) => s + c.mrr, 0);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "algorithm" as const, label: "Algorithm", icon: Zap },
    { id: "alerts" as const, label: "Alerts", icon: Bell },
    { id: "nps" as const, label: "NPS & Survey", icon: ThumbsUp },
    { id: "history" as const, label: "History", icon: BarChart3 },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <Heart size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Client Health Monitor</h1>
          <p className="text-xs text-muted">Track client satisfaction, task progress, and account health</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-gold" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Avg Health</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${getHealthColor(avgHealth)}`}>{avgHealth}%</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight size={10} className="text-green-400" />
            <span className="text-[9px] text-green-400">+3% vs last month</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-gold" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Total MRR</span>
          </div>
          <p className="text-2xl font-bold font-mono">${totalMRR.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Healthy</span>
          </div>
          <p className="text-2xl font-bold font-mono text-green-400">{healthyCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Warning</span>
          </div>
          <p className="text-2xl font-bold font-mono text-yellow-400">{warningCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={14} className="text-red-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Critical</span>
          </div>
          <p className="text-2xl font-bold font-mono text-red-400">{criticalCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-red-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">At-Risk MRR</span>
          </div>
          <p className="text-2xl font-bold font-mono text-red-400">${atRiskMRR.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Overview ---- */}
      {activeTab === "overview" && (
        <>
          {/* Engagement Trend Chart */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-gold" /> Engagement Trend (Last 6 Months)
            </h3>
            <div className="flex items-end gap-1 h-24">
              {HEALTH_HISTORY.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-muted">{m.avg}%</span>
                  <div className="w-full rounded-t" style={{
                    height: `${m.avg}%`,
                    background: i === HEALTH_HISTORY.length - 1 ? "rgba(200,168,85,0.4)" : "rgba(200,168,85,0.15)",
                    border: i === HEALTH_HISTORY.length - 1 ? "1px solid rgba(200,168,85,0.3)" : "none",
                  }} />
                  <span className="text-[8px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1.5">
              {(["all", "critical", "warning", "healthy"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
                    filter === f ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
                  }`}>
                  {f === "all" ? `All (${clients.length})` :
                   f === "critical" ? `Critical (${criticalCount})` :
                   f === "warning" ? `Warning (${warningCount})` :
                   `Healthy (${healthyCount})`}
                </button>
              ))}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="text-[10px] py-1 px-2 rounded-lg border border-border bg-surface text-foreground">
              <option value="health">Sort: Health (worst first)</option>
              <option value="mrr">Sort: MRR (highest)</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
          </div>

          {/* Client Cards - Red/Yellow/Green */}
          {filtered.length === 0 && clients.length === 0 && (
            <EmptyState
              icon={<Heart size={24} />}
              title="No clients yet"
              description="Add clients to track their health scores"
              actionLabel="Add Clients"
              actionHref="/dashboard/clients"
            />
          )}
          <div className="space-y-2">
            {filtered.map(client => (
              <div key={client.id} className={`rounded-xl border p-4 transition-all cursor-pointer hover:border-gold/20 ${
                client.health_score >= 75 ? "border-green-500/15 bg-green-500/[0.02]" :
                client.health_score >= 50 ? "border-yellow-500/15 bg-yellow-500/[0.02]" :
                "border-red-500/15 bg-red-500/[0.02]"
              }`} onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getHealthBg(client.health_score)}`}>
                    <span className={`text-lg font-bold font-mono ${getHealthColor(client.health_score)}`}>
                      {client.health_score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold truncate">{client.business_name}</h3>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${getHealthBg(client.health_score)} ${getHealthColor(client.health_score)}`}>
                        {getHealthLabel(client.health_score)}
                      </span>
                      <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{client.package_tier}</span>
                      {client.trend > 0 ? (
                        <span className="flex items-center text-[8px] text-green-400"><TrendingUp size={8} /> +{client.trend}%</span>
                      ) : client.trend < 0 ? (
                        <span className="flex items-center text-[8px] text-red-400"><TrendingDown size={8} /> {client.trend}%</span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-muted">{client.contact_name} &middot; Last contact: {client.last_contact}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-[8px] text-muted uppercase">MRR</p>
                      <p className="text-xs font-bold font-mono">${client.mrr.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted uppercase">Tasks</p>
                      <p className="text-xs font-bold font-mono">{client.tasks_done}/{client.tasks_total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted uppercase">NPS</p>
                      <p className={`text-xs font-bold font-mono ${client.nps >= 8 ? "text-green-400" : client.nps >= 6 ? "text-yellow-400" : "text-red-400"}`}>{client.nps}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted uppercase">Engage</p>
                      <p className="text-xs font-bold font-mono">{client.engagement}%</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-muted transition-transform ${selectedClient?.id === client.id ? "rotate-90" : ""}`} />
                </div>

                {/* Progress bar */}
                {client.tasks_total > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] text-muted">Task Progress</span>
                      <span className="text-[8px] text-muted">{Math.round((client.tasks_done / client.tasks_total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${(client.tasks_done / client.tasks_total) * 100}%`,
                        background: client.tasks_done / client.tasks_total >= 0.75 ? "#4ade80" :
                                    client.tasks_done / client.tasks_total >= 0.5 ? "#facc15" : "#f87171",
                      }} />
                    </div>
                  </div>
                )}

                {/* Expanded detail panel */}
                {selectedClient?.id === client.id && (
                  <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Risk Factors */}
                    <div>
                      <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1"><ShieldAlert size={10} className="text-red-400" /> Risk Factors</h4>
                      {client.risk_factors.length === 0 ? (
                        <p className="text-[10px] text-green-400">No risk factors detected</p>
                      ) : (
                        <div className="space-y-1">
                          {client.risk_factors.map((r, i) => (
                            <div key={i} className="text-[10px] text-red-300 flex items-start gap-1">
                              <AlertTriangle size={9} className="shrink-0 mt-0.5" /> {r}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Revenue Trend */}
                    <div>
                      <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1"><DollarSign size={10} className="text-gold" /> Revenue Trend</h4>
                      <div className="flex items-end gap-0.5 h-12">
                        {client.revenue_trend.map((v, i) => (
                          <div key={i} className="flex-1 rounded-t bg-gold/20" style={{ height: `${(v / Math.max(...client.revenue_trend)) * 100}%` }} />
                        ))}
                      </div>
                      <p className="text-[9px] text-muted mt-1">Last 6 months MRR</p>
                    </div>

                    {/* Action Recommendations */}
                    <div>
                      <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1"><Lightbulb size={10} className="text-gold" /> Recommendations</h4>
                      <div className="space-y-1">
                        {(RECOMMENDATIONS[client.health_score < 50 ? "critical" : client.health_score < 75 ? "warning" : "healthy"] || []).slice(0, 3).map((r, i) => (
                          <div key={i} className="text-[10px] text-muted flex items-start gap-1">
                            <Target size={9} className="shrink-0 mt-0.5 text-gold" /> {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="rounded-xl border border-border text-center py-12">
                <Users size={24} className="text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No clients match this filter</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- TAB: Algorithm Breakdown ---- */}
      {activeTab === "algorithm" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Zap size={14} className="text-gold" /> Health Score Algorithm
            </h3>
            <p className="text-xs text-muted mb-4">The health score is calculated as a weighted average of these factors (0-100 scale).</p>
            <div className="space-y-3">
              {ALGORITHM_WEIGHTS.map(w => (
                <div key={w.factor}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{w.factor}</span>
                    <span className="text-xs text-gold font-mono">{w.weight}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-gold/40" style={{ width: `${w.weight}%` }} />
                  </div>
                  <p className="text-[9px] text-muted mt-0.5">{w.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score Breakdown Per Client */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-gold" /> Client Score Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted font-medium">Client</th>
                    <th className="text-center py-2 text-muted font-medium">Tasks</th>
                    <th className="text-center py-2 text-muted font-medium">Invoices</th>
                    <th className="text-center py-2 text-muted font-medium">Engage</th>
                    <th className="text-center py-2 text-muted font-medium">Contact</th>
                    <th className="text-center py-2 text-muted font-medium">Content</th>
                    <th className="text-center py-2 text-muted font-medium">NPS</th>
                    <th className="text-center py-2 text-muted font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const taskScore = c.tasks_total > 0 ? Math.round((c.tasks_done / c.tasks_total) * 100) : 50;
                    const invoiceScore = c.invoices_pending === 0 ? 100 : c.invoices_pending === 1 ? 50 : 20;
                    return (
                      <tr key={c.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">{c.business_name}</td>
                        <td className={`text-center py-2 ${taskScore >= 75 ? "text-green-400" : taskScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{taskScore}</td>
                        <td className={`text-center py-2 ${invoiceScore >= 75 ? "text-green-400" : invoiceScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{invoiceScore}</td>
                        <td className={`text-center py-2 ${c.engagement >= 75 ? "text-green-400" : c.engagement >= 50 ? "text-yellow-400" : "text-red-400"}`}>{c.engagement}</td>
                        <td className="text-center py-2 text-muted">{c.last_contact}</td>
                        <td className="text-center py-2 text-muted">{c.content_count}</td>
                        <td className={`text-center py-2 ${c.nps >= 8 ? "text-green-400" : c.nps >= 6 ? "text-yellow-400" : "text-red-400"}`}>{c.nps}</td>
                        <td className={`text-center py-2 font-bold ${getHealthColor(c.health_score)}`}>{c.health_score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Alerts ---- */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bell size={14} className="text-gold" /> Automated Health Alerts
            </h3>
            <div className="space-y-2">
              {HEALTH_ALERTS.map(alert => (
                <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.type === "critical" ? "bg-red-400/5 border-red-400/15" :
                  alert.type === "warning" ? "bg-yellow-400/5 border-yellow-400/15" :
                  "bg-blue-400/5 border-blue-400/15"
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    alert.type === "critical" ? "bg-red-400/10" :
                    alert.type === "warning" ? "bg-yellow-400/10" : "bg-blue-400/10"
                  }`}>
                    {alert.type === "critical" ? <AlertTriangle size={13} className="text-red-400" /> :
                     alert.type === "warning" ? <AlertTriangle size={13} className="text-yellow-400" /> :
                     <Eye size={13} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{alert.client}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${
                        alert.type === "critical" ? "bg-red-400/10 text-red-400" :
                        alert.type === "warning" ? "bg-yellow-400/10 text-yellow-400" :
                        "bg-blue-400/10 text-blue-400"
                      }`}>{alert.type}</span>
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">{alert.message}</p>
                  </div>
                  <span className="text-[9px] text-muted shrink-0">{alert.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Frequency Monitor */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock size={14} className="text-gold" /> Last Contact Tracker
            </h3>
            <div className="space-y-2">
              {clients.sort((a, b) => new Date(a.last_contact).getTime() - new Date(b.last_contact).getTime()).map(c => {
                const daysSince = Math.floor((new Date().getTime() - new Date(c.last_contact).getTime()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${daysSince <= 3 ? "bg-green-400" : daysSince <= 7 ? "bg-yellow-400" : "bg-red-400"}`} />
                      <span className="text-xs font-medium">{c.business_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted">{c.last_contact}</span>
                      <span className={`text-[10px] font-mono ${daysSince <= 3 ? "text-green-400" : daysSince <= 7 ? "text-yellow-400" : "text-red-400"}`}>
                        {daysSince}d ago
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: NPS & Survey ---- */}
      {activeTab === "nps" && (
        <div className="space-y-4">
          {/* NPS Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <Star size={20} className="text-gold mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-gold">{avgNPS}</p>
              <p className="text-[10px] text-muted">Average NPS Score</p>
            </div>
            <div className="card p-4 text-center">
              <ThumbsUp size={20} className="text-green-400 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-green-400">{clients.filter(c => c.nps >= 9).length}</p>
              <p className="text-[10px] text-muted">Promoters (9-10)</p>
            </div>
            <div className="card p-4 text-center">
              <MessageSquare size={20} className="text-yellow-400 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-yellow-400">{clients.filter(c => c.nps >= 7 && c.nps < 9).length}</p>
              <p className="text-[10px] text-muted">Passives (7-8)</p>
            </div>
          </div>

          {/* NPS Distribution */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">NPS Distribution</h3>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 11 }, (_, i) => {
                const count = clients.filter(c => c.nps === i).length;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {count > 0 && <span className="text-[8px] text-muted">{count}</span>}
                    <div className={`w-full rounded-t ${i >= 9 ? "bg-green-400/40" : i >= 7 ? "bg-yellow-400/40" : "bg-red-400/40"}`}
                      style={{ height: count > 0 ? `${(count / clients.length) * 100}%` : "2px", minHeight: "2px" }} />
                    <span className="text-[8px] text-muted">{i}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Satisfaction Survey */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-gold" /> Client Satisfaction Survey
            </h3>
            {surveySubmitted ? (
              <div className="text-center py-6">
                <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium">Survey recorded!</p>
                <button onClick={() => { setSurveySubmitted(false); setSurveyFeedback(""); }} className="text-xs text-gold mt-2 underline">Submit another</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Client</label>
                  <select value={surveyClient} onChange={e => setSurveyClient(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">NPS Score (0-10)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={10} value={surveyScore} onChange={e => setSurveyScore(Number(e.target.value))} className="flex-1" />
                    <span className={`text-lg font-bold font-mono ${surveyScore >= 9 ? "text-green-400" : surveyScore >= 7 ? "text-yellow-400" : "text-red-400"}`}>{surveyScore}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Feedback</label>
                  <textarea value={surveyFeedback} onChange={e => setSurveyFeedback(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-20" placeholder="Any additional feedback..." />
                </div>
                <button onClick={() => { if (surveyClient) setSurveySubmitted(true); }}
                  className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold">
                  Submit Survey
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: History ---- */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-gold" /> Health Score History
            </h3>
            <div className="flex items-end gap-2 h-32">
              {HEALTH_HISTORY.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-xs font-bold ${getHealthColor(m.avg)}`}>{m.avg}%</span>
                  <div className="w-full rounded-t transition-all" style={{
                    height: `${m.avg}%`,
                    background: i === HEALTH_HISTORY.length - 1 ? "rgba(200,168,85,0.5)" : "rgba(200,168,85,0.2)",
                  }} />
                  <span className="text-[9px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-client health history */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Client Health Trends</h3>
            <div className="space-y-3">
              {clients.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs w-36 truncate font-medium">{c.business_name}</span>
                  <div className="flex-1 flex items-center gap-0.5 h-4">
                    {c.revenue_trend.map((_, i) => {
                      const score = Math.max(20, c.health_score + (i - 5) * (c.trend > 0 ? 2 : c.trend < 0 ? -2 : 0));
                      return (
                        <div key={i} className="flex-1 rounded h-full" style={{
                          background: score >= 75 ? "rgba(74,222,128,0.3)" : score >= 50 ? "rgba(250,204,21,0.3)" : "rgba(248,113,113,0.3)",
                          opacity: 0.4 + (i * 0.12),
                        }} />
                      );
                    })}
                  </div>
                  <span className={`text-xs font-mono font-bold w-10 text-right ${getHealthColor(c.health_score)}`}>{c.health_score}</span>
                  {c.trend > 0 ? <ArrowUpRight size={10} className="text-green-400" /> :
                   c.trend < 0 ? <ArrowDownRight size={10} className="text-red-400" /> :
                   <span className="w-[10px]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
