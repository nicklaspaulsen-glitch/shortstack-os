"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FileText, Sparkles, Users, TrendingUp, TrendingDown,
  Loader, Clock, BarChart3, RefreshCw,
  ChevronDown, ChevronUp, Copy, Check, Calendar,
} from "lucide-react";

interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  mrr: number;
  health_score: number;
  is_active: boolean;
}

interface Report {
  id: string;
  description: string;
  client_id: string;
  created_at: string;
  result: {
    type: string;
    report: string;
    metrics?: {
      leads: number;
      leads_trend: string;
      outreach: number;
      replies: number;
      deals_won: number;
      deals_revenue: number;
    };
  };
}

interface GeneratedReport {
  report: string;
  client: string;
  type: string;
  metrics: {
    leads: number;
    leads_trend: string;
    outreach: number;
    replies: number;
    deals_won: number;
    deals_revenue: number;
    health_score: number;
    mrr: number;
  };
}

export default function ReportsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: clientData }, reportsRes] = await Promise.all([
      supabase.from("clients").select("id, business_name, contact_name, email, mrr, health_score, is_active").eq("is_active", true).order("business_name"),
      fetch("/api/reports/generate").then(r => r.json()),
    ]);
    setClients(clientData || []);
    setReports(reportsRes.reports || []);
    setLoading(false);
  }

  async function generateReport() {
    if (!selectedClient) return;
    setGenerating(true);
    setCurrentReport(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, report_type: reportType }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentReport(data);
        fetchData(); // Refresh report list
      }
    } catch {
      // Error handled silently
    }
    setGenerating(false);
  }

  function copyReport() {
    if (currentReport?.report) {
      navigator.clipboard.writeText(currentReport.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function getClientName(clientId: string) {
    return clients.find(c => c.id === clientId)?.business_name || "Unknown";
  }

  const totalReports = reports.length;
  const weeklyReports = reports.filter(r => r.result?.type === "weekly_report").length;
  const monthlyReports = reports.filter(r => r.result?.type === "monthly_report").length;
  const uniqueClients = new Set(reports.map(r => r.client_id)).size;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileText size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Client Reports</h1>
            <p className="text-xs text-muted">Generate AI-powered performance reports for your clients</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: totalReports, icon: FileText, color: "text-info" },
          { label: "Weekly Reports", value: weeklyReports, icon: Calendar, color: "text-gold" },
          { label: "Monthly Reports", value: monthlyReports, icon: BarChart3, color: "text-accent" },
          { label: "Clients Covered", value: uniqueClients, icon: Users, color: "text-success" },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-border/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={14} className={stat.color} />
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Generate Report Panel */}
        <div className="col-span-1 space-y-4">
          <div className="bg-surface border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-gold" />
              <h2 className="text-sm font-semibold text-foreground">Generate Report</h2>
            </div>

            {/* Client selector */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Client</label>
                <select
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                  className="input mt-1 text-xs"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.business_name}</option>
                  ))}
                </select>
              </div>

              {/* Report type */}
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Report Type</label>
                <div className="flex gap-2 mt-1">
                  {(["weekly", "monthly"] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                        reportType === type
                          ? "bg-gold/10 border-gold/30 text-gold"
                          : "bg-surface-light border-border/30 text-muted hover:text-foreground"
                      }`}
                    >
                      {type === "weekly" ? "Weekly" : "Monthly"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generateReport}
                disabled={!selectedClient || generating}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><Loader size={12} className="animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles size={12} /> Generate Report</>
                )}
              </button>
            </div>

            {/* Selected client preview */}
            {selectedClient && (() => {
              const client = clients.find(c => c.id === selectedClient);
              if (!client) return null;
              return (
                <div className="mt-4 p-3 rounded-xl bg-surface-light border border-border/30">
                  <p className="text-xs font-medium text-foreground">{client.business_name}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
                    <span>MRR: ${client.mrr.toLocaleString()}</span>
                    <span>Health: {client.health_score}%</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quick Generate for All */}
          <div className="bg-surface border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Batch Reports</h2>
            </div>
            <p className="text-[10px] text-muted mb-3">
              Weekly reports are auto-generated every Friday at 3 PM via cron job. You can also generate individual reports on-demand above.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-success">
              <Clock size={10} />
              <span>Next auto-run: Friday 3:00 PM</span>
            </div>
          </div>
        </div>

        {/* Report Output & History */}
        <div className="col-span-2 space-y-4">
          {/* Current Generated Report */}
          {currentReport && (
            <div className="bg-surface border border-gold/20 rounded-2xl p-5 fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-gold" />
                  <h2 className="text-sm font-semibold text-foreground">
                    {currentReport.type === "monthly" ? "Monthly" : "Weekly"} Report — {currentReport.client}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copyReport} className="btn-secondary text-[10px] flex items-center gap-1">
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Metrics bar */}
              {currentReport.metrics && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-surface-light rounded-xl text-[10px]">
                  <div>
                    <span className="text-muted">Leads</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-bold text-foreground">{currentReport.metrics.leads}</span>
                      {currentReport.metrics.leads_trend !== "N/A" && (
                        <span className={`flex items-center ${parseInt(currentReport.metrics.leads_trend) >= 0 ? "text-success" : "text-danger"}`}>
                          {parseInt(currentReport.metrics.leads_trend) >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                          {currentReport.metrics.leads_trend}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div>
                    <span className="text-muted">Outreach</span>
                    <p className="font-bold text-foreground mt-0.5">{currentReport.metrics.outreach}</p>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div>
                    <span className="text-muted">Replies</span>
                    <p className="font-bold text-foreground mt-0.5">{currentReport.metrics.replies}</p>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div>
                    <span className="text-muted">Deals</span>
                    <p className="font-bold text-foreground mt-0.5">{currentReport.metrics.deals_won} (${currentReport.metrics.deals_revenue.toLocaleString()})</p>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div>
                    <span className="text-muted">Health</span>
                    <p className={`font-bold mt-0.5 ${currentReport.metrics.health_score >= 70 ? "text-success" : currentReport.metrics.health_score >= 40 ? "text-warning" : "text-danger"}`}>
                      {currentReport.metrics.health_score}%
                    </p>
                  </div>
                </div>
              )}

              {/* Report text */}
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed font-sans bg-surface-light rounded-xl p-4 border border-border/30 max-h-[500px] overflow-y-auto">
                  {currentReport.report}
                </pre>
              </div>
            </div>
          )}

          {/* Report History */}
          <div className="bg-surface border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Report History</h2>
              <span className="text-[9px] text-muted bg-surface-light px-2 py-0.5 rounded-full">{reports.length}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size={16} className="animate-spin text-muted" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={24} className="text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-muted">No reports generated yet</p>
                <p className="text-[10px] text-muted/60 mt-1">Select a client and generate your first report</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map(report => (
                  <div key={report.id} className="border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-light transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${report.result?.type === "monthly_report" ? "bg-accent" : "bg-gold"}`} />
                        <div className="text-left">
                          <p className="text-xs font-medium text-foreground">{getClientName(report.client_id)}</p>
                          <p className="text-[10px] text-muted">
                            {report.result?.type === "monthly_report" ? "Monthly" : "Weekly"} Report — {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.result?.metrics && (
                          <span className="text-[9px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
                            {report.result.metrics.leads} leads
                          </span>
                        )}
                        {expandedReport === report.id ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                      </div>
                    </button>

                    {expandedReport === report.id && report.result?.report && (
                      <div className="px-4 pb-4 border-t border-border/20">
                        <pre className="whitespace-pre-wrap text-[11px] text-foreground leading-relaxed font-sans mt-3 bg-surface-light rounded-xl p-3 max-h-[300px] overflow-y-auto">
                          {report.result.report}
                        </pre>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(report.result.report);
                            }}
                            className="text-[10px] text-muted hover:text-foreground flex items-center gap-1 transition-colors"
                          >
                            <Copy size={10} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
