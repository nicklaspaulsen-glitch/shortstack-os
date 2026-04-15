"use client";

import { useState } from "react";
import {
  FileText, Download, Sparkles, Send, TrendingUp, Users, BarChart3,
  Copy, Calendar, Eye, Clock, Layout, Palette, Sliders, Filter,
  ChevronDown, CheckCircle, Mail, FileDown, Layers, PlusCircle, Trash2
} from "lucide-react";
import EmptyState from "@/components/empty-state";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_CLIENTS: { id: string; business_name: string; package_tier: string; mrr: number; health_score: number; services: string[] }[] = [];

const REPORT_TEMPLATES = [
  { id: "t1", name: "Monthly Performance", description: "Full marketing performance overview with KPIs", widgets: 8, icon: BarChart3 },
  { id: "t2", name: "Executive Summary", description: "High-level results for stakeholders", widgets: 4, icon: FileText },
  { id: "t3", name: "Social Media Report", description: "Platform-specific social analytics", widgets: 6, icon: Users },
  { id: "t4", name: "SEO Progress", description: "Keyword rankings, traffic, and backlinks", widgets: 7, icon: TrendingUp },
  { id: "t5", name: "Ad Campaign Report", description: "ROAS, CPC, impressions, and conversions", widgets: 6, icon: Sparkles },
  { id: "t6", name: "Quarterly Review", description: "3-month comprehensive performance review", widgets: 10, icon: Calendar },
  { id: "t7", name: "Lead Generation", description: "Leads, sources, conversion rates", widgets: 5, icon: Filter },
  { id: "t8", name: "Content Performance", description: "Content engagement, reach, and virality", widgets: 6, icon: Layout },
];

const AVAILABLE_METRICS = [
  "Total Leads", "Conversion Rate", "Website Traffic", "Social Followers", "Engagement Rate",
  "Revenue Generated", "Ad Spend", "ROAS", "Email Open Rate", "Click-Through Rate",
  "Bounce Rate", "Avg Session Duration", "New vs Returning", "Top Pages", "Keyword Rankings",
];

const WIDGET_TYPES = [
  { id: "kpi", label: "KPI Card", icon: BarChart3 },
  { id: "chart", label: "Line Chart", icon: TrendingUp },
  { id: "table", label: "Data Table", icon: Layout },
  { id: "pie", label: "Pie Chart", icon: Layers },
  { id: "text", label: "Text Block", icon: FileText },
  { id: "metric", label: "Metric Grid", icon: Sliders },
];

interface ScheduledReport {
  id: string;
  client: string;
  template: string;
  frequency: string;
  nextSend: string;
  recipients: string;
  enabled: boolean;
}

const MOCK_SCHEDULES: ScheduledReport[] = [
  { id: "s1", client: "Bright Smiles Dental", template: "Monthly Performance", frequency: "Monthly", nextSend: "2026-05-01", recipients: "sarah@brightsmiles.com", enabled: true },
  { id: "s2", client: "Peak Fitness Studio", template: "Social Media Report", frequency: "Bi-weekly", nextSend: "2026-04-28", recipients: "mike@peakfit.com", enabled: true },
  { id: "s3", client: "Elite Auto Detailing", template: "Executive Summary", frequency: "Monthly", nextSend: "2026-05-01", recipients: "carlos@eliteauto.com", enabled: false },
];

const REPORT_ANALYTICS = [
  { client: "Bright Smiles Dental", sent: 6, viewed: 5, downloaded: 3, avgViewTime: "2m 34s", lastViewed: "2026-04-12" },
  { client: "Peak Fitness Studio", sent: 4, viewed: 4, downloaded: 4, avgViewTime: "3m 12s", lastViewed: "2026-04-10" },
  { client: "Metro Legal Group", sent: 6, viewed: 2, downloaded: 1, avgViewTime: "0m 45s", lastViewed: "2026-03-15" },
  { client: "Elite Auto Detailing", sent: 5, viewed: 5, downloaded: 5, avgViewTime: "4m 01s", lastViewed: "2026-04-13" },
];

const MOCK_REPORT = `EXECUTIVE SUMMARY
This month showed strong performance across all key metrics. Lead generation increased 23% month-over-month, driven by optimized ad campaigns and improved landing page conversions.

KEY METRICS
- Leads Generated: 47 (+23%)
- Website Traffic: 3,240 sessions (+15%)
- Social Engagement: 12.4% (+2.1%)
- Revenue Attributed: $8,500
- Ad ROAS: 4.2x

HIGHLIGHTS
- Instagram Reels campaign drove 60% of new followers
- Google Ads CPC decreased by $0.42
- Top blog post received 890 organic visits
- Email open rate reached 34% (industry avg: 21%)

NEXT MONTH PLAN
- Launch TikTok content series
- A/B test new landing page design
- Increase Google Ads budget by 15%
- Begin local SEO optimization push`;

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ClientReportsPage() {
  const [activeTab, setActiveTab] = useState<"generate" | "templates" | "builder" | "schedule" | "analytics" | "portal">("generate");
  const [selectedClient, setSelectedClient] = useState("");
  const [report, setReport] = useState("");
  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState<"this_month" | "last_month" | "last_90" | "custom">("this_month");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["Total Leads", "Conversion Rate", "Website Traffic", "Engagement Rate"]);
  const [selectedTemplate, setSelectedTemplate] = useState("t1");
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [brandColor, setBrandColor] = useState("#c8a855");
  const [brandLogo, setBrandLogo] = useState("ShortStack Digital");
  const [builderWidgets, setBuilderWidgets] = useState<string[]>(["kpi", "chart", "table"]);
  const [batchClients, setBatchClients] = useState<string[]>([]);

  function toggleMetric(m: string) {
    setSelectedMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  function generateReport() {
    if (!selectedClient) return;
    setGenerating(true);
    setTimeout(() => {
      setReport(MOCK_REPORT);
      setGenerating(false);
    }, 1500);
  }

  function toggleSchedule(id: string) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function toggleBatchClient(id: string) {
    setBatchClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function removeWidget(idx: number) {
    setBuilderWidgets(prev => prev.filter((_, i) => i !== idx));
  }

  function addWidget(type: string) {
    setBuilderWidgets(prev => [...prev, type]);
  }

  const tabs = [
    { id: "generate" as const, label: "Generate", icon: Sparkles },
    { id: "templates" as const, label: "Templates", icon: Layers },
    { id: "builder" as const, label: "Builder", icon: Layout },
    { id: "schedule" as const, label: "Schedule", icon: Clock },
    { id: "analytics" as const, label: "Analytics", icon: Eye },
    { id: "portal" as const, label: "Portal Preview", icon: FileText },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FileText size={18} className="text-gold" /> Client Reports
          </h1>
          <p className="text-xs text-muted mt-0.5">Generate, customize, and auto-send professional reports</p>
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

      {/* ---- TAB: Generate ---- */}
      {activeTab === "generate" && (
        <div className="space-y-4">
          {MOCK_CLIENTS.length === 0 && (
            <EmptyState
              icon={<FileText size={24} />}
              title="No client reports yet"
              description="Add a client and generate your first report"
              actionLabel="Add Client"
              actionHref="/dashboard/clients"
            />
          )}

          {/* Client selector + options */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Client</label>
                <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="">Choose a client...</option>
                  {MOCK_CLIENTS.map(c => (
                    <option key={c.id} value={c.id}>{c.business_name} -- {c.package_tier} (${c.mrr}/mo)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Date Range</label>
                <select value={dateRange} onChange={e => setDateRange(e.target.value as typeof dateRange)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_90">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Template</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={comparisonEnabled} onChange={e => setComparisonEnabled(e.target.checked)} className="rounded" />
                Enable period comparison
              </label>
              <button onClick={generateReport} disabled={generating || !selectedClient}
                className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 ml-auto">
                {generating ? <Clock size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>

          {/* Metric Selector */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Sliders size={12} className="text-gold" /> Metrics to Include</h3>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_METRICS.map(m => (
                <button key={m} onClick={() => toggleMetric(m)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    selectedMetrics.includes(m) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          {/* Quick stats for selected client */}
          {selectedClient && (
            <div className="grid grid-cols-4 gap-3">
              {(() => {
                const client = MOCK_CLIENTS.find(c => c.id === selectedClient);
                if (!client) return null;
                return (
                  <>
                    <div className="card p-3 text-center">
                      <TrendingUp size={14} className="mx-auto mb-1 text-gold" />
                      <p className="text-lg font-bold">{client.health_score}%</p>
                      <p className="text-[9px] text-muted">Health Score</p>
                    </div>
                    <div className="card p-3 text-center">
                      <BarChart3 size={14} className="mx-auto mb-1 text-gold" />
                      <p className="text-lg font-bold">${client.mrr.toLocaleString()}</p>
                      <p className="text-[9px] text-muted">MRR</p>
                    </div>
                    <div className="card p-3 text-center">
                      <Users size={14} className="mx-auto mb-1 text-gold" />
                      <p className="text-lg font-bold">{client.package_tier}</p>
                      <p className="text-[9px] text-muted">Package</p>
                    </div>
                    <div className="card p-3 text-center">
                      <Layout size={14} className="mx-auto mb-1 text-gold" />
                      <p className="text-lg font-bold">{client.services.length}</p>
                      <p className="text-[9px] text-muted">Services</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Report output */}
          {report && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Generated Report</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(report)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"><Copy size={10} /> Copy</button>
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"><Download size={10} /> PDF</button>
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"><FileDown size={10} /> TXT</button>
                  <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1"><Send size={10} /> Email to Client</button>
                </div>
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-muted p-4 rounded-lg bg-white/[0.02] border border-border">{report}</pre>
            </div>
          )}

          {!report && !generating && (
            <div className="card p-4 text-center py-16">
              <FileText size={32} className="mx-auto mb-3 text-muted/20" />
              <p className="text-sm text-muted mb-1">Select a client and generate their report</p>
              <p className="text-[10px] text-muted/50">AI analyzes their data and creates a professional report</p>
            </div>
          )}
        </div>
      )}

      {/* ---- TAB: Templates ---- */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {REPORT_TEMPLATES.map(t => (
              <div key={t.id} className={`card p-4 cursor-pointer transition-all hover:border-gold/20 ${
                selectedTemplate === t.id ? "border-gold/30 bg-gold/[0.03]" : ""
              }`} onClick={() => setSelectedTemplate(t.id)}>
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mb-2">
                  <t.icon size={16} className="text-gold" />
                </div>
                <h4 className="text-xs font-semibold">{t.name}</h4>
                <p className="text-[10px] text-muted mt-0.5">{t.description}</p>
                <p className="text-[9px] text-gold mt-2">{t.widgets} widgets</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: Builder ---- */}
      {activeTab === "builder" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Widget palette */}
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><PlusCircle size={12} className="text-gold" /> Add Widgets</h3>
              <div className="space-y-2">
                {WIDGET_TYPES.map(w => (
                  <button key={w.id} onClick={() => addWidget(w.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-border text-xs hover:border-gold/20 hover:bg-gold/[0.02] transition-all">
                    <w.icon size={14} className="text-gold" />
                    <span>{w.label}</span>
                    <PlusCircle size={10} className="ml-auto text-muted" />
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="lg:col-span-2 card p-4">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Layout size={12} className="text-gold" /> Report Canvas</h3>
              {builderWidgets.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Layout size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">Drag widgets from the palette or click to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {builderWidgets.map((w, i) => {
                    const wt = WIDGET_TYPES.find(x => x.id === w);
                    return (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-white/[0.02]">
                        <ChevronDown size={12} className="text-muted cursor-grab" />
                        {wt && <wt.icon size={14} className="text-gold" />}
                        <span className="text-xs flex-1">{wt?.label || w}</span>
                        <button onClick={() => removeWidget(i)} className="text-muted hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* White-label Branding */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Palette size={12} className="text-gold" /> White-Label Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Agency Name</label>
                <input value={brandLogo} onChange={e => setBrandLogo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Brand Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  <input value={brandColor} onChange={e => setBrandColor(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground font-mono" />
                </div>
              </div>
              <div className="flex items-end">
                <div className="w-full p-3 rounded-lg border border-border text-center" style={{ borderColor: brandColor + "40" }}>
                  <p className="text-xs font-bold" style={{ color: brandColor }}>{brandLogo}</p>
                  <p className="text-[9px] text-muted">Preview header</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Schedule ---- */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* Batch Generate */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-gold" /> Batch Generate Reports</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MOCK_CLIENTS.map(c => (
                <button key={c.id} onClick={() => toggleBatchClient(c.id)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    batchClients.includes(c.id) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                  }`}>{c.business_name}</button>
              ))}
            </div>
            <button className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              disabled={batchClients.length === 0}>
              <Sparkles size={12} /> Generate {batchClients.length} Report{batchClients.length !== 1 ? "s" : ""}
            </button>
          </div>

          {/* Scheduled Auto-Send */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Clock size={12} className="text-gold" /> Scheduled Auto-Send</h3>
              <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
                <PlusCircle size={10} /> New Schedule
              </button>
            </div>
            <div className="space-y-2">
              {schedules.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleSchedule(s.id)}
                      className={`w-8 h-4 rounded-full transition-all relative ${s.enabled ? "bg-gold" : "bg-white/10"}`}>
                      <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${s.enabled ? "left-4.5" : "left-0.5"}`}
                        style={{ left: s.enabled ? "18px" : "2px" }} />
                    </button>
                    <div>
                      <p className="text-xs font-medium">{s.client}</p>
                      <p className="text-[10px] text-muted">{s.template} &middot; {s.frequency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-muted">Next send: {s.nextSend}</p>
                      <p className="text-[9px] text-muted flex items-center gap-1 justify-end"><Mail size={8} /> {s.recipients}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email Briefing Scheduler */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Mail size={12} className="text-gold" /> Email Delivery Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Subject Line Template</label>
                <input defaultValue="{client_name} - Monthly Marketing Report - {month} {year}"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Send Time</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option>9:00 AM (client timezone)</option>
                  <option>10:00 AM (client timezone)</option>
                  <option>2:00 PM (client timezone)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Analytics ---- */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">{REPORT_ANALYTICS.reduce((s, r) => s + r.sent, 0)}</p>
              <p className="text-[10px] text-muted">Total Sent</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-green-400">{REPORT_ANALYTICS.reduce((s, r) => s + r.viewed, 0)}</p>
              <p className="text-[10px] text-muted">Total Viewed</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-gold">{REPORT_ANALYTICS.reduce((s, r) => s + r.downloaded, 0)}</p>
              <p className="text-[10px] text-muted">Downloaded</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">
                {Math.round((REPORT_ANALYTICS.reduce((s, r) => s + r.viewed, 0) / REPORT_ANALYTICS.reduce((s, r) => s + r.sent, 0)) * 100)}%
              </p>
              <p className="text-[10px] text-muted">View Rate</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Eye size={12} className="text-gold" /> Report Engagement by Client</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted font-medium">Client</th>
                    <th className="text-center py-2 text-muted font-medium">Sent</th>
                    <th className="text-center py-2 text-muted font-medium">Viewed</th>
                    <th className="text-center py-2 text-muted font-medium">Downloaded</th>
                    <th className="text-center py-2 text-muted font-medium">Avg View Time</th>
                    <th className="text-center py-2 text-muted font-medium">Last Viewed</th>
                  </tr>
                </thead>
                <tbody>
                  {REPORT_ANALYTICS.map(r => (
                    <tr key={r.client} className="border-b border-border/30">
                      <td className="py-2 font-medium">{r.client}</td>
                      <td className="text-center py-2">{r.sent}</td>
                      <td className="text-center py-2 text-green-400">{r.viewed}</td>
                      <td className="text-center py-2 text-gold">{r.downloaded}</td>
                      <td className="text-center py-2">{r.avgViewTime}</td>
                      <td className="text-center py-2 text-muted">{r.lastViewed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Portal Preview ---- */}
      {activeTab === "portal" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Eye size={12} className="text-gold" /> Client-Facing Portal Preview</h3>
            <p className="text-[10px] text-muted mb-4">This is how your client sees their report portal</p>
            <div className="border border-border rounded-xl overflow-hidden">
              {/* Mock portal header */}
              <div className="p-4 border-b border-border" style={{ background: brandColor + "10" }}>
                <p className="text-sm font-bold" style={{ color: brandColor }}>{brandLogo}</p>
                <p className="text-[10px] text-muted">Client Report Portal</p>
              </div>
              {/* Mock report list */}
              <div className="p-4 space-y-2">
                {["April 2026 Monthly Report", "March 2026 Monthly Report", "Q1 2026 Quarterly Review"].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gold" />
                      <div>
                        <p className="text-xs font-medium">{r}</p>
                        <p className="text-[9px] text-muted">Generated {i === 0 ? "2 days ago" : i === 1 ? "1 month ago" : "2 months ago"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button className="text-[10px] px-2 py-1 rounded border border-border text-muted flex items-center gap-1"><Eye size={9} /> View</button>
                      <button className="text-[10px] px-2 py-1 rounded border border-border text-muted flex items-center gap-1"><Download size={9} /> PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Executive Summary Auto-Gen */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={12} className="text-gold" /> Executive Summary Auto-Generation
            </h3>
            <p className="text-[10px] text-muted mb-3">AI generates a concise executive summary based on the report data</p>
            <div className="p-3 rounded-lg border border-gold/20 bg-gold/[0.03]">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle size={10} className="text-gold" />
                <span className="text-[10px] text-gold font-medium">AI-Generated Summary</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                This month marked a 23% increase in lead generation driven by optimized campaigns. Website traffic grew 15% and social engagement reached an all-time high of 12.4%. Total revenue attributed to marketing efforts was $8,500 with a 4.2x ROAS. Recommended focus areas for next month include TikTok content expansion and landing page A/B testing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
