"use client";

import { useState } from "react";
import {
  FileText, Download, Sparkles, Send, TrendingUp, Users, BarChart3,
  Copy, Calendar, Eye, Clock, Layout, Palette, Sliders,
  CheckCircle, Mail, PlusCircle, Trash2,
  Globe, Star, Target, ArrowUpRight, ArrowDownRight,
  RefreshCw, ChevronRight, Shield, X
} from "lucide-react";
import Modal from "@/components/ui/modal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ScheduledReport {
  id: string;
  client: string;
  clientAvatar: string;
  template: string;
  frequency: string;
  deliveryDay: string;
  deliveryTime: string;
  nextSend: string;
  recipients: string[];
  enabled: boolean;
  lastSent: string;
}

interface ReportHistory {
  id: string;
  client: string;
  template: string;
  sentDate: string;
  opened: boolean;
  openedDate: string | null;
  clicked: boolean;
  downloaded: boolean;
  viewTime: string;
}

type Tab = "dashboard" | "builder" | "preview" | "history" | "branding";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const CLIENTS: { id: string; name: string; tier: string; mrr: number; avatar: string }[] = [];

const REPORT_TEMPLATES = [
  { id: "executive", name: "Executive Summary", description: "High-level results for stakeholders and decision-makers", icon: Star, metrics: 4, pages: 2 },
  { id: "detailed", name: "Detailed Analytics", description: "Comprehensive deep-dive with full data breakdowns", icon: BarChart3, metrics: 12, pages: 6 },
  { id: "quick", name: "Quick Stats", description: "One-page overview with key KPIs and trends", icon: TrendingUp, metrics: 6, pages: 1 },
  { id: "social", name: "Social Media Report", description: "Platform-specific social analytics and engagement", icon: Users, metrics: 8, pages: 3 },
  { id: "seo", name: "SEO Progress Report", description: "Keyword rankings, organic traffic, and backlinks", icon: Globe, metrics: 9, pages: 4 },
  { id: "ads", name: "Ad Campaign Report", description: "ROAS, CPC, impressions, and conversion data", icon: Target, metrics: 10, pages: 3 },
];

const AVAILABLE_METRICS = [
  { id: "traffic", label: "Website Traffic", category: "Web" },
  { id: "leads", label: "Leads Generated", category: "Sales" },
  { id: "social_growth", label: "Social Growth", category: "Social" },
  { id: "ad_spend", label: "Ad Spend", category: "Ads" },
  { id: "roi", label: "Return on Investment", category: "Finance" },
  { id: "conversion", label: "Conversion Rate", category: "Sales" },
  { id: "engagement", label: "Engagement Rate", category: "Social" },
  { id: "bounce_rate", label: "Bounce Rate", category: "Web" },
  { id: "email_open", label: "Email Open Rate", category: "Email" },
  { id: "click_through", label: "Click-Through Rate", category: "Email" },
  { id: "revenue", label: "Revenue Attributed", category: "Finance" },
  { id: "keywords", label: "Keyword Rankings", category: "SEO" },
  { id: "backlinks", label: "Backlinks", category: "SEO" },
  { id: "sessions", label: "Avg Session Duration", category: "Web" },
  { id: "top_pages", label: "Top Pages", category: "Web" },
];

const FREQUENCY_OPTIONS = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-weekly" },
  { id: "monthly", label: "Monthly" },
];

const MOCK_SCHEDULES: ScheduledReport[] = [];

const MOCK_HISTORY: ReportHistory[] = [];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function ClientReportsPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [showGenerateNow, setShowGenerateNow] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState(false);

  // Builder state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["traffic", "leads", "social_growth", "roi", "conversion"]);
  const [selectedTemplate, setSelectedTemplate] = useState("executive");
  const [selectedFrequency, setSelectedFrequency] = useState("monthly");
  const [deliveryDay, setDeliveryDay] = useState("1st");
  const [deliveryTime, setDeliveryTime] = useState("09:00");

  // Branding state
  const [brandColor, setBrandColor] = useState("#C9A84C");
  const [agencyName, setAgencyName] = useState("ShortStack Digital");
  const [tagline, setTagline] = useState("Results-Driven Marketing");
  const [showLogo, setShowLogo] = useState(true);

  function toggleSchedule(id: string) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function deleteSchedule(id: string) {
    setSchedules(prev => prev.filter(s => s.id !== id));
  }

  function toggleClient(id: string) {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleMetric(id: string) {
    setSelectedMetrics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleGenerateNow() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGeneratedPreview(true);
      setTab("preview");
      setShowGenerateNow(false);
    }, 2000);
  }

  // Stats
  const totalSent = MOCK_HISTORY.length;
  const openRate = totalSent > 0 ? Math.round((MOCK_HISTORY.filter(h => h.opened).length / totalSent) * 100) : 0;
  const downloadRate = totalSent > 0 ? Math.round((MOCK_HISTORY.filter(h => h.downloaded).length / totalSent) * 100) : 0;
  const activeSchedules = schedules.filter(s => s.enabled).length;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <Layout size={13} /> },
    { id: "builder", label: "Report Builder", icon: <Sliders size={13} /> },
    { id: "preview", label: "Preview", icon: <Eye size={13} /> },
    { id: "history", label: "History", icon: <Clock size={13} /> },
    { id: "branding", label: "Branding", icon: <Palette size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <FileText size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Auto Client Reports</h1>
            <p className="text-xs text-muted">Generate, schedule, and track professional client reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenerateNow(true)}
            className="btn-secondary text-xs flex items-center gap-1.5">
            <Sparkles size={12} /> Generate Now
          </button>
          <button onClick={() => setShowNewSchedule(true)}
            className="btn-primary text-xs flex items-center gap-1.5">
            <PlusCircle size={12} /> New Schedule
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{activeSchedules}</p>
          <p className="text-[10px] text-muted">Active Schedules</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{totalSent}</p>
          <p className="text-[10px] text-muted">Reports Sent</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{openRate}%</p>
          <p className="text-[10px] text-muted">Open Rate</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{downloadRate}%</p>
          <p className="text-[10px] text-muted">Download Rate</p>
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

      {/* ---- TAB: DASHBOARD ---- */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Scheduled Reports */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Calendar size={12} className="text-gold" /> Scheduled Reports
              </h3>
              <span className="text-[10px] text-muted">{activeSchedules} active</span>
            </div>
            <div className="space-y-2">
              {schedules.map(s => (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  s.enabled ? "border-border hover:border-gold/20" : "border-border/50 opacity-50"
                }`}>
                  <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold shrink-0">
                    {s.clientAvatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate">{s.client}</p>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-light border border-border text-muted">{s.template}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted mt-0.5">
                      <span className="flex items-center gap-1"><RefreshCw size={8} /> {s.frequency}</span>
                      <span className="flex items-center gap-1"><Clock size={8} /> {s.deliveryDay} at {s.deliveryTime}</span>
                      <span className="flex items-center gap-1"><Mail size={8} /> {s.recipients.length} recipient{s.recipients.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-2">
                      <p className="text-[10px] text-muted">Next: {s.nextSend}</p>
                      <p className="text-[9px] text-muted/60">Last: {s.lastSent}</p>
                    </div>
                    <button onClick={() => toggleSchedule(s.id)}
                      className={`w-9 h-5 rounded-full transition-all relative ${s.enabled ? "bg-gold" : "bg-white/10"}`}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all"
                        style={{ left: s.enabled ? 18 : 3 }} />
                    </button>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="p-1 rounded text-muted hover:text-red-400 transition-all">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setTab("builder")}
              className="card p-4 text-left hover:border-gold/20 transition-all group">
              <Sliders size={18} className="text-gold mb-2" />
              <p className="text-xs font-semibold">Build Custom Report</p>
              <p className="text-[10px] text-muted">Select metrics and templates</p>
            </button>
            <button onClick={() => setShowGenerateNow(true)}
              className="card p-4 text-left hover:border-gold/20 transition-all group">
              <Sparkles size={18} className="text-gold mb-2" />
              <p className="text-xs font-semibold">One-Off Report</p>
              <p className="text-[10px] text-muted">Generate a report right now</p>
            </button>
            <button onClick={() => setTab("branding")}
              className="card p-4 text-left hover:border-gold/20 transition-all group">
              <Palette size={18} className="text-gold mb-2" />
              <p className="text-xs font-semibold">White-Label Setup</p>
              <p className="text-[10px] text-muted">Customize branding</p>
            </button>
          </div>

          {/* Recent Report Performance */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Eye size={12} className="text-gold" /> Recent Report Engagement
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted font-semibold">Client</th>
                    <th className="text-left py-2 text-muted font-semibold">Report</th>
                    <th className="text-center py-2 text-muted font-semibold">Sent</th>
                    <th className="text-center py-2 text-muted font-semibold">Opened</th>
                    <th className="text-center py-2 text-muted font-semibold">Clicked</th>
                    <th className="text-center py-2 text-muted font-semibold">Downloaded</th>
                    <th className="text-center py-2 text-muted font-semibold">View Time</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_HISTORY.slice(0, 5).map(h => (
                    <tr key={h.id} className="border-b border-border/30">
                      <td className="py-2 font-medium">{h.client}</td>
                      <td className="py-2 text-muted">{h.template}</td>
                      <td className="py-2 text-center text-muted">{h.sentDate}</td>
                      <td className="py-2 text-center">
                        {h.opened
                          ? <CheckCircle size={11} className="inline text-emerald-400" />
                          : <X size={11} className="inline text-red-400/50" />}
                      </td>
                      <td className="py-2 text-center">
                        {h.clicked
                          ? <CheckCircle size={11} className="inline text-emerald-400" />
                          : <X size={11} className="inline text-red-400/50" />}
                      </td>
                      <td className="py-2 text-center">
                        {h.downloaded
                          ? <CheckCircle size={11} className="inline text-gold" />
                          : <X size={11} className="inline text-red-400/50" />}
                      </td>
                      <td className="py-2 text-center text-muted">{h.viewTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: REPORT BUILDER ---- */}
      {tab === "builder" && (
        <div className="space-y-4">
          {/* Step 1: Select Clients */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">1</span>
              Select Client(s)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CLIENTS.map(c => (
                <button key={c.id} onClick={() => toggleClient(c.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    selectedClients.includes(c.id) ? "border-gold/30 bg-gold/[0.04]" : "border-border hover:border-gold/20"
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    selectedClients.includes(c.id) ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"
                  }`}>
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{c.name}</p>
                    <p className="text-[9px] text-muted">{c.tier} -- ${c.mrr.toLocaleString()}/mo</p>
                  </div>
                  {selectedClients.includes(c.id) && <CheckCircle size={14} className="text-gold shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Choose Metrics */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">2</span>
              Choose Metrics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_METRICS.map(m => (
                <button key={m.id} onClick={() => toggleMetric(m.id)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                    selectedMetrics.includes(m.id)
                      ? "border-gold/30 bg-gold/[0.05] text-gold"
                      : "border-border text-muted hover:border-gold/20"
                  }`}>
                  {m.label}
                  <span className="text-[8px] ml-1 text-muted/50">({m.category})</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted mt-2">{selectedMetrics.length} metrics selected</p>
          </div>

          {/* Step 3: Pick Template */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">3</span>
              Choose Template
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {REPORT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selectedTemplate === t.id ? "border-gold/30 bg-gold/[0.04]" : "border-border hover:border-gold/20"
                  }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      selectedTemplate === t.id ? "bg-gold/20" : "bg-surface-light"
                    }`}>
                      <t.icon size={14} className={selectedTemplate === t.id ? "text-gold" : "text-muted"} />
                    </div>
                    <p className="text-[11px] font-semibold">{t.name}</p>
                  </div>
                  <p className="text-[9px] text-muted">{t.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[8px] text-muted">
                    <span>{t.metrics} metrics</span>
                    <span>{t.pages} pages</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Schedule */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">4</span>
              Schedule Delivery
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Frequency</label>
                <select value={selectedFrequency} onChange={e => setSelectedFrequency(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  {FREQUENCY_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Delivery Day</label>
                <select value={deliveryDay} onChange={e => setDeliveryDay(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="1st">1st of month</option>
                  <option value="15th">15th of month</option>
                  <option value="Monday">Every Monday</option>
                  <option value="Friday">Every Friday</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Delivery Time</label>
                <select value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted">
              {selectedClients.length} client{selectedClients.length !== 1 ? "s" : ""} selected, {selectedMetrics.length} metrics, {selectedTemplate} template
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setGenerating(true); setTimeout(() => { setGenerating(false); setGeneratedPreview(true); setTab("preview"); }, 2000); }}
                disabled={selectedClients.length === 0 || generating}
                className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50">
                {generating ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />}
                Preview Report
              </button>
              <button disabled={selectedClients.length === 0}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Calendar size={12} /> Schedule Reports
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: PREVIEW ---- */}
      {tab === "preview" && (
        <div className="space-y-4">
          {!generatedPreview ? (
            <div className="card p-4 text-center py-16">
              <FileText size={32} className="mx-auto mb-3 text-muted/20" />
              <p className="text-sm text-muted mb-1">No report preview generated yet</p>
              <p className="text-[10px] text-muted/50 mb-4">Build a report and click Preview to see it here</p>
              <button onClick={() => setTab("builder")} className="btn-primary text-xs">Go to Builder</button>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Report Preview -- Executive Summary</p>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs flex items-center gap-1"><Copy size={10} /> Copy</button>
                  <button className="btn-secondary text-xs flex items-center gap-1"><Download size={10} /> PDF</button>
                  <button className="btn-primary text-xs flex items-center gap-1"><Send size={10} /> Send to Client</button>
                </div>
              </div>

              {/* Professional Report Preview */}
              <div className="card p-0 overflow-hidden">
                {/* Report Header */}
                <div className="p-6 border-b border-border" style={{ background: `${brandColor}08` }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {showLogo && <p className="text-sm font-bold" style={{ color: brandColor }}>{agencyName}</p>}
                      <p className="text-[10px] text-muted">{tagline}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted">Monthly Marketing Report</p>
                      <p className="text-xs font-semibold">
                        {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">CL</div>
                    <div>
                      <p className="text-xs font-semibold">[Client Name]</p>
                      <p className="text-[9px] text-muted">[Package] -- [Price]/mo</p>
                    </div>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="p-6">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">Key Performance Indicators</h3>
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "Total Leads", value: "--", change: "--", up: true },
                      { label: "Website Traffic", value: "--", change: "--", up: true },
                      { label: "Engagement Rate", value: "--", change: "--", up: true },
                      { label: "Revenue Attributed", value: "--", change: "--", up: true },
                    ].map((kpi, i) => (
                      <div key={i} className="p-3 rounded-xl border border-border">
                        <p className="text-[9px] text-muted mb-1">{kpi.label}</p>
                        <p className="text-lg font-bold">{kpi.value}</p>
                        <div className={`flex items-center gap-0.5 text-[9px] ${kpi.up ? "text-emerald-400" : "text-red-400"}`}>
                          {kpi.up ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                          {kpi.change} vs last month
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chart Placeholder */}
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">Traffic & Leads Trend</h3>
                  <div className="h-32 rounded-xl border border-dashed border-border mb-6 flex items-center justify-center text-[10px] text-muted">
                    Chart will render here once real monthly data is available
                  </div>

                  {/* AI Insights */}
                  <div className="p-4 rounded-xl border border-gold/20 bg-gold/[0.03] mb-6">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles size={12} className="text-gold" />
                      <span className="text-[10px] font-semibold text-gold uppercase tracking-wider">AI-Generated Insights</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted leading-relaxed">
                      <p>[AI-generated insights based on this month&apos;s performance data will appear here.]</p>
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div className="p-4 rounded-xl border border-blue-400/20 bg-blue-400/[0.03]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target size={12} className="text-blue-400" />
                      <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Recommendations</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        "[AI-generated recommendations will be listed here based on report data.]",
                      ].map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted">
                          <CheckCircle size={10} className="text-blue-400 mt-0.5 shrink-0" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Report Footer */}
                <div className="px-6 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-[9px] text-muted" style={{ color: `${brandColor}80` }}>{agencyName} -- Confidential</p>
                  <p className="text-[9px] text-muted">
                    Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- TAB: HISTORY ---- */}
      {tab === "history" && (
        <div className="space-y-4">
          {/* Engagement Summary */}
          <div className="grid grid-cols-5 gap-3">
            <div className="card p-3 text-center">
              <p className="text-lg font-bold">{totalSent}</p>
              <p className="text-[10px] text-muted">Total Sent</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{MOCK_HISTORY.filter(h => h.opened).length}</p>
              <p className="text-[10px] text-muted">Opened</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-blue-400">{MOCK_HISTORY.filter(h => h.clicked).length}</p>
              <p className="text-[10px] text-muted">Clicked</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-gold">{MOCK_HISTORY.filter(h => h.downloaded).length}</p>
              <p className="text-[10px] text-muted">Downloaded</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-purple-400">{openRate}%</p>
              <p className="text-[10px] text-muted">Open Rate</p>
            </div>
          </div>

          {/* Full History Table */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Clock size={12} className="text-gold" /> Report History
            </h3>
            <div className="space-y-2">
              {MOCK_HISTORY.map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-gold/20 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center">
                    <FileText size={14} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{h.client}</p>
                    <p className="text-[10px] text-muted">{h.template} -- {h.sentDate}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full ${h.opened ? "bg-emerald-400/10 text-emerald-400" : "bg-surface-light text-muted"}`}>
                        <Eye size={8} /> {h.opened ? "Opened" : "Unopened"}
                      </div>
                      {h.clicked && (
                        <div className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                          <ChevronRight size={8} /> Clicked
                        </div>
                      )}
                      {h.downloaded && (
                        <div className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-gold/10 text-gold">
                          <Download size={8} /> PDF
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-muted w-12 text-right">{h.viewTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: BRANDING ---- */}
      {tab === "branding" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Settings */}
            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                  <Palette size={12} className="text-gold" /> White-Label Branding
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Agency Name</label>
                    <input value={agencyName} onChange={e => setAgencyName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Tagline</label>
                    <input value={tagline} onChange={e => setTagline(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Brand Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer" />
                      <input value={brandColor} onChange={e => setBrandColor(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground font-mono" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} className="accent-gold" />
                    Show agency logo on reports
                  </label>
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                  <Shield size={12} className="text-gold" /> Report Settings
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Include AI insights section", defaultChecked: true },
                    { label: "Include recommendations section", defaultChecked: true },
                    { label: "Show comparison to previous period", defaultChecked: true },
                    { label: "Include executive summary", defaultChecked: true },
                    { label: "Add confidentiality notice", defaultChecked: false },
                  ].map((setting, i) => (
                    <label key={i} className="flex items-center gap-2 text-xs text-muted cursor-pointer p-2 rounded-lg hover:bg-surface-light transition-all">
                      <input type="checkbox" defaultChecked={setting.defaultChecked} className="accent-gold" />
                      {setting.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                <Eye size={12} className="text-gold" /> Live Preview
              </h3>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border" style={{ background: `${brandColor}10` }}>
                  {showLogo && <p className="text-sm font-bold" style={{ color: brandColor }}>{agencyName}</p>}
                  <p className="text-[9px] text-muted">{tagline}</p>
                </div>
                <div className="p-4">
                  <p className="text-[10px] text-muted mb-2">
                    {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} -- Monthly Report
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 rounded-lg border border-border text-center">
                      <p className="text-sm font-bold">--</p>
                      <p className="text-[8px] text-muted">Leads</p>
                    </div>
                    <div className="p-2 rounded-lg border border-border text-center">
                      <p className="text-sm font-bold">--</p>
                      <p className="text-[8px] text-muted">ROAS</p>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border border-border/50 bg-gold/[0.02]">
                    <p className="text-[8px] font-semibold mb-0.5" style={{ color: brandColor }}>AI Insight</p>
                    <p className="text-[8px] text-muted">Insights will appear once real performance data is available...</p>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-border">
                  <p className="text-[8px] text-muted" style={{ color: `${brandColor}60` }}>{agencyName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- GENERATE NOW MODAL ---- */}
      <Modal isOpen={showGenerateNow} onClose={() => setShowGenerateNow(false)} title="Generate One-Off Report" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
              <option value="">Select a client...</option>
              {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Template</label>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
              {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Date Range</label>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
              <option>This Month</option>
              <option>Last Month</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowGenerateNow(false)} className="btn-secondary text-xs flex-1">Cancel</button>
            <button onClick={handleGenerateNow} disabled={generating}
              className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5">
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---- NEW SCHEDULE MODAL ---- */}
      <Modal isOpen={showNewSchedule} onClose={() => setShowNewSchedule(false)} title="New Report Schedule" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
              <option value="">Select a client...</option>
              {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Template</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Frequency</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                {FREQUENCY_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Delivery Day</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                <option>1st of month</option><option>15th of month</option><option>Monday</option><option>Friday</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Delivery Time</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                <option>9:00 AM</option><option>10:00 AM</option><option>2:00 PM</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Recipient Email(s)</label>
            <input placeholder="email@client.com"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowNewSchedule(false)} className="btn-secondary text-xs flex-1">Cancel</button>
            <button onClick={() => setShowNewSchedule(false)} className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5">
              <Calendar size={12} /> Create Schedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
