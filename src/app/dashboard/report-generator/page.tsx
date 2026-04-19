"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  FileText, Sparkles, BarChart3, DollarSign,
  Target, Megaphone, PieChart, Globe, Calendar,
  Download, Mail, Send, Eye, Edit3, Trash2, Plus, X, Check,
  ChevronDown, Clock, Pause, Play,
  Layout, Image, Palette,
  Settings, Loader, ArrowRight,
  FileDown, Presentation,
  FileBarChart2,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import PageAI from "@/components/page-ai";

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

type ReportType = "monthly" | "ad_spend" | "social_media" | "seo" | "lead_gen" | "revenue";
type DateRange = "this_month" | "last_month" | "last_quarter" | "custom";
type Tab = "builder" | "templates" | "scheduled" | "history";
type ExportFormat = "pdf" | "branded_pdf" | "slides" | "email";

interface ReportSection {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface ScheduledReport {
  id: string;
  client: string;
  reportType: ReportType;
  frequency: "weekly" | "monthly" | "quarterly";
  nextSend: string;
  status: "active" | "paused";
  recipients: string[];
  includeAI: boolean;
}

interface HistoryReport {
  id: string;
  date: string;
  client: string;
  type: ReportType;
  pages: number;
  size: string;
  status: "sent" | "draft" | "failed";
}

interface Template {
  id: string;
  name: string;
  description: string;
  color: string;
  accentColor: string;
  sectionsIncluded: number;
  sections: string[];
  type: ReportType;
}

interface MockClient {
  id: string;
  business_name: string;
}

/* ══════════════════════════════════════════════════════════════════
   MOCK DATA
   ══════════════════════════════════════════════════════════════════ */

const REPORT_TYPES: { id: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  { id: "monthly", label: "Monthly Performance", description: "Full monthly overview with KPIs and trends", icon: BarChart3 },
  { id: "ad_spend", label: "Ad Spend Analysis", description: "ROAS, CPC, CPA breakdowns by campaign", icon: DollarSign },
  { id: "social_media", label: "Social Media Growth", description: "Followers, engagement, content metrics", icon: Megaphone },
  { id: "seo", label: "SEO Progress", description: "Rankings, traffic, backlinks, domain authority", icon: Globe },
  { id: "lead_gen", label: "Lead Generation", description: "Lead volume, sources, conversion rates", icon: Target },
  { id: "revenue", label: "Revenue Summary", description: "MRR, churn, LTV, revenue by channel", icon: PieChart },
];

const MOCK_CLIENTS: MockClient[] = [];

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: "cover", label: "Cover Page", enabled: true, order: 0 },
  { id: "executive_summary", label: "Executive Summary", enabled: true, order: 1 },
  { id: "key_metrics", label: "Key Metrics", enabled: true, order: 2 },
  { id: "charts", label: "Charts & Visualizations", enabled: true, order: 3 },
  { id: "campaign_table", label: "Campaign Performance", enabled: true, order: 4 },
  { id: "ai_insights", label: "AI-Generated Insights", enabled: true, order: 5 },
  { id: "recommendations", label: "Next Steps & Recommendations", enabled: true, order: 6 },
];

const TEMPLATES: Template[] = [
  { id: "t1", name: "Agency Monthly", description: "Comprehensive monthly report with all sections. Ideal for retainer clients.", color: "#C9A84C", accentColor: "#1a1a2e", sectionsIncluded: 7, sections: ["cover", "executive_summary", "key_metrics", "charts", "campaign_table", "ai_insights", "recommendations"], type: "monthly" },
  { id: "t2", name: "Quick Snapshot", description: "One-page overview with key metrics and highlights. Fast to generate.", color: "#38bdf8", accentColor: "#0c4a6e", sectionsIncluded: 3, sections: ["cover", "key_metrics", "recommendations"], type: "monthly" },
  { id: "t3", name: "Detailed Analytics", description: "Deep dive into data with charts, tables, and trend analysis.", color: "#10b981", accentColor: "#064e3b", sectionsIncluded: 6, sections: ["cover", "executive_summary", "key_metrics", "charts", "campaign_table", "ai_insights"], type: "monthly" },
  { id: "t4", name: "Executive Brief", description: "High-level summary for stakeholders. Concise and actionable.", color: "#8b5cf6", accentColor: "#3b0764", sectionsIncluded: 4, sections: ["cover", "executive_summary", "key_metrics", "recommendations"], type: "revenue" },
  { id: "t5", name: "Campaign Report", description: "Focused on campaign performance, ad spend, and conversion data.", color: "#f43f5e", accentColor: "#4c0519", sectionsIncluded: 5, sections: ["cover", "key_metrics", "charts", "campaign_table", "recommendations"], type: "ad_spend" },
  { id: "t6", name: "Quarterly Review", description: "In-depth quarterly analysis with QoQ comparisons and strategic outlook.", color: "#f59e0b", accentColor: "#451a03", sectionsIncluded: 7, sections: ["cover", "executive_summary", "key_metrics", "charts", "campaign_table", "ai_insights", "recommendations"], type: "monthly" },
];

const MOCK_SCHEDULED: ScheduledReport[] = [];

const MOCK_HISTORY: HistoryReport[] = [];

const REPORT_LABELS: Record<ReportType, string> = {
  monthly: "Monthly Performance",
  ad_spend: "Ad Spend Analysis",
  social_media: "Social Media Growth",
  seo: "SEO Progress",
  lead_gen: "Lead Generation",
  revenue: "Revenue Summary",
};

/* ══════════════════════════════════════════════════════════════════
   MOCK METRIC DATA (for preview)
   ══════════════════════════════════════════════════════════════════ */

const MOCK_METRICS = {
  leads: { value: 0, change: 0, label: "New Leads" },
  revenue: { value: 0, change: 0, label: "Revenue" },
  engagement: { value: 0, change: 0, label: "Engagement Rate" },
  conversions: { value: 0, change: 0, label: "Conversions" },
  traffic: { value: 0, change: 0, label: "Website Traffic" },
  roas: { value: 0, change: 0, label: "ROAS" },
};

const MOCK_CAMPAIGNS: { name: string; spend: number; impressions: number; clicks: number; conversions: number; roas: number }[] = [];

const MOCK_BAR_DATA: { label: string; value: number }[] = [];

const MOCK_LINE_DATA: { label: string; value: number }[] = [];

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function ReportGeneratorPage() {
  const { profile } = useAuth();
  createClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("builder");

  // Branded logo for the Report Preview cover page. Priority:
  //   1. brand_kit.logos[0] (preferred — user's explicit brand logo)
  //   2. brand_kit.favicon / ogImage (fallback from extracted website)
  //   3. profiles.avatar_url (user avatar)
  //   4. null → renders "T" initial placeholder
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("ss_brand_kit_data");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          logos?: string[];
          favicon?: string;
          ogImage?: string;
          images?: string[];
        };
        const fromLogos = Array.isArray(parsed?.logos) && parsed.logos[0];
        const fromFavicon = typeof parsed?.favicon === "string" && parsed.favicon;
        const fromOg = typeof parsed?.ogImage === "string" && parsed.ogImage;
        const firstImage = Array.isArray(parsed?.images) && parsed.images[0];
        const picked = fromLogos || fromFavicon || fromOg || firstImage || null;
        if (picked) {
          setBrandLogo(picked);
          return;
        }
      }
    } catch { /* ignore — fall through to avatar */ }
    const avatar = profile?.avatar_url;
    if (typeof avatar === "string" && avatar) setBrandLogo(avatar);
  }, [profile]);

  // Builder state
  const [selectedType, setSelectedType] = useState<ReportType>("monthly");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedClient, setSelectedClient] = useState("c1");
  const [whiteLabel, setWhiteLabel] = useState(true);
  const [includeAI, setIncludeAI] = useState(true);
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [generating, setGenerating] = useState(false);
  const [, setPreviewReady] = useState(true);

  // Schedule modal state
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleClient, setScheduleClient] = useState("c1");
  const [scheduleType, setScheduleType] = useState<ReportType>("monthly");
  const [scheduleFreq, setScheduleFreq] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleAI, setScheduleAI] = useState(true);

  // Send email modal
  const [sendModal, setSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");

  // History + scheduled state
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(MOCK_SCHEDULED);
  const [historyReports] = useState<HistoryReport[]>(MOCK_HISTORY);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportOpen]);

  /* ── Handlers ─────────────────────────────────────────────────── */

  const toggleSection = useCallback((sectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: selectedType,
          client_id: selectedClient,
          date_range: dateRange,
          sections: sections.filter(s => s.enabled).map(s => s.id),
          include_ai_insights: includeAI,
        }),
      });
      if (res.ok) {
        toast.success("Report generated successfully");
        setPreviewReady(true);
      } else {
        toast.error("Failed to generate report");
      }
    } catch {
      toast.error("Network error — try again");
    }
    setGenerating(false);
  }, [selectedType, selectedClient, dateRange, sections, includeAI]);

  const handleExport = useCallback((format: ExportFormat) => {
    setExportOpen(false);
    const labels: Record<ExportFormat, string> = {
      pdf: "PDF",
      branded_pdf: "Branded PDF",
      slides: "Google Slides",
      email: "Email",
    };
    toast.success(`Exporting as ${labels[format]}...`);
  }, []);

  const handleSendToClient = useCallback(() => {
    if (!sendEmail.trim()) { toast.error("Enter an email address"); return; }
    toast.success(`Report sent to ${sendEmail}`);
    setSendModal(false);
    setSendEmail("");
  }, [sendEmail]);

  const handleCreateSchedule = useCallback(() => {
    if (!scheduleEmail.trim()) { toast.error("Enter recipient email"); return; }
    const newSchedule: ScheduledReport = {
      id: `s${Date.now()}`,
      client: MOCK_CLIENTS.find(c => c.id === scheduleClient)?.business_name || "Unknown",
      reportType: scheduleType,
      frequency: scheduleFreq,
      nextSend: scheduleFreq === "weekly" ? "2026-04-22" : scheduleFreq === "monthly" ? "2026-05-15" : "2026-07-01",
      status: "active",
      recipients: scheduleEmail.split(",").map(e => e.trim()),
      includeAI: scheduleAI,
    };
    setScheduledReports(prev => [...prev, newSchedule]);
    setScheduleModal(false);
    setScheduleEmail("");
    toast.success("Report schedule created");
  }, [scheduleClient, scheduleType, scheduleFreq, scheduleEmail, scheduleAI]);

  const toggleScheduleStatus = useCallback((id: string) => {
    setScheduledReports(prev => prev.map(s => s.id === id ? { ...s, status: s.status === "active" ? "paused" : "active" } : s));
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setScheduledReports(prev => prev.filter(s => s.id !== id));
    toast.success("Schedule removed");
  }, []);

  const applyTemplate = useCallback((template: Template) => {
    setSelectedType(template.type);
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s, enabled: template.sections.includes(s.id) })));
    setActiveTab("builder");
    toast.success(`Template "${template.name}" applied`);
  }, []);

  /* ── Helpers ──────────────────────────────────────────────────── */

  const clientName = MOCK_CLIENTS.find(c => c.id === selectedClient)?.business_name || "Client";
  const enabledSections = sections.filter(s => s.enabled);

  const dateLabel = (d: DateRange) => {
    const labels: Record<DateRange, string> = { this_month: "This Month", last_month: "Last Month", last_quarter: "Last Quarter", custom: "Custom" };
    return labels[d];
  };
  const freqLabel = (f: string) => {
    const labels: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly" };
    return labels[f] || f;
  };
  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      draft: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      failed: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return styles[status] || "";
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER — TABS
     ══════════════════════════════════════════════════════════════════ */

  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "builder", label: "Report Builder", icon: Layout },
    { id: "templates", label: "Templates", icon: Image },
    { id: "scheduled", label: "Scheduled Reports", icon: Clock },
    { id: "history", label: "Report History", icon: FileText },
  ];

  /* ── Preview: CSS-only charts ────────────────────────────────── */

  function BarChartCSS() {
    if (MOCK_BAR_DATA.length === 0) return <p className="text-xs text-gray-400 text-center py-8">No data</p>;
    const maxVal = Math.max(...MOCK_BAR_DATA.map(d => d.value), 1);
    return (
      <div className="flex items-end gap-2 h-32 w-full">
        {MOCK_BAR_DATA.map((d) => (
          <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
            <div
              className="w-full rounded-t bg-gold/80 transition-all duration-500"
              style={{ height: `${(d.value / maxVal) * 100}%` }}
            />
            <span className="text-[10px] text-muted">{d.label}</span>
          </div>
        ))}
      </div>
    );
  }

  function LineChartCSS() {
    if (MOCK_LINE_DATA.length === 0) return <p className="text-xs text-gray-400 text-center py-8">No data</p>;
    const maxVal = Math.max(...MOCK_LINE_DATA.map(d => d.value), 1);
    const divisor = MOCK_LINE_DATA.length > 1 ? MOCK_LINE_DATA.length - 1 : 1;
    const points = MOCK_LINE_DATA.map((d, i) => ({
      x: (i / divisor) * 100,
      y: 100 - (d.value / maxVal) * 100,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
      <div className="w-full h-32 relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <path d={pathD} fill="none" stroke="#C9A84C" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill="#C9A84C" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="flex justify-between mt-1">
          {MOCK_LINE_DATA.map(d => (
            <span key={d.label} className="text-[10px] text-muted">{d.label}</span>
          ))}
        </div>
      </div>
    );
  }

  function DonutChartCSS() {
    const data = [
      { label: "Organic", pct: 38, color: "#C9A84C" },
      { label: "Paid", pct: 28, color: "#38bdf8" },
      { label: "Referral", pct: 20, color: "#10b981" },
      { label: "Direct", pct: 14, color: "#8b5cf6" },
    ];
    let accumulated = 0;
    return (
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            {data.map((d) => {
              const dashArray = `${d.pct} ${100 - d.pct}`;
              const offset = 100 - accumulated;
              accumulated += d.pct;
              return (
                <circle key={d.label} cx="18" cy="18" r="15.9155" fill="none" stroke={d.color} strokeWidth="3.5"
                  strokeDasharray={dashArray} strokeDashoffset={offset}
                />
              );
            })}
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          {data.map(d => (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="text-gray-600">{d.label}</span>
              <span className="font-semibold text-gray-800 ml-auto">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER — MAIN
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="fade-in space-y-6">
      <PageHero
        icon={<FileBarChart2 size={28} />}
        title="Report Generator"
        subtitle="Build, schedule & send professional reports."
        gradient="ocean"
        actions={
          <>
            <div className="relative" ref={exportRef}>
              <button onClick={() => setExportOpen(!exportOpen)} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-2">
                <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
                  <button onClick={() => handleExport("pdf")} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-light flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-muted" /> PDF Download
                  </button>
                  <button onClick={() => handleExport("branded_pdf")} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-light flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted" /> Branded PDF
                  </button>
                  <button onClick={() => handleExport("slides")} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-light flex items-center gap-2">
                    <Presentation className="w-4 h-4 text-muted" /> Google Slides
                  </button>
                  <button onClick={() => handleExport("email")} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-light flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted" /> Email Directly
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setSendModal(true)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-2">
              <Send className="w-4 h-4" /> Send to Client
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? "bg-gold/10 text-gold" : "text-muted hover:text-white hover:bg-surface-light"}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
         TAB: BUILDER
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Builder Controls */}
          <div className="space-y-6">
            {/* Report Type */}
            <div className="card p-6">
              <h2 className="section-header text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gold" /> Report Type
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {REPORT_TYPES.map(rt => (
                  <button key={rt.id} onClick={() => setSelectedType(rt.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${selectedType === rt.id
                      ? "border-gold bg-gold/10 ring-1 ring-gold/30"
                      : "border-border bg-surface hover:bg-surface-light hover:border-border"}`}>
                    <rt.icon className={`w-5 h-5 mb-2 ${selectedType === rt.id ? "text-gold" : "text-muted"}`} />
                    <p className="text-sm font-medium">{rt.label}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{rt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range + Client */}
            <div className="card p-6">
              <h2 className="section-header text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gold" /> Date Range & Client
              </h2>
              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <label className="text-sm text-muted mb-2 block">Date Range</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["this_month", "last_month", "last_quarter", "custom"] as DateRange[]).map(dr => (
                      <button key={dr} onClick={() => setDateRange(dr)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${dateRange === dr
                          ? "bg-gold/10 text-gold border border-gold/30"
                          : "bg-surface-light text-muted border border-border hover:text-white"}`}>
                        {dateLabel(dr)}
                      </button>
                    ))}
                  </div>
                  {dateRange === "custom" && (
                    <div className="flex gap-3 mt-3">
                      <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                        className="input-field flex-1 text-sm" />
                      <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                        className="input-field flex-1 text-sm" />
                    </div>
                  )}
                </div>

                {/* Client Selector */}
                <div>
                  <label className="text-sm text-muted mb-2 block">Client</label>
                  <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                    className="input-field w-full text-sm">
                    {MOCK_CLIENTS.map(c => (
                      <option key={c.id} value={c.id}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="card p-6">
              <h2 className="section-header text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gold" /> Options
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">White-Label Branding</p>
                    <p className="text-xs text-muted">Include company logo and custom brand colors</p>
                  </div>
                  <button onClick={() => setWhiteLabel(!whiteLabel)}
                    className={`w-10 h-6 rounded-full relative transition-all ${whiteLabel ? "bg-gold" : "bg-surface-light border border-border"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${whiteLabel ? "left-5" : "left-1"}`} />
                  </button>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">Include AI Insights <Sparkles className="w-4 h-4 text-gold" /></p>
                    <p className="text-xs text-muted">AI-generated analysis and recommendations</p>
                  </div>
                  <button onClick={() => setIncludeAI(!includeAI)}
                    className={`w-10 h-6 rounded-full relative transition-all ${includeAI ? "bg-gold" : "bg-surface-light border border-border"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${includeAI ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sections toggle */}
            <div className="card p-6">
              <h2 className="section-header text-lg font-semibold mb-4 flex items-center gap-2">
                <Layout className="w-5 h-5 text-gold" /> Report Sections
              </h2>
              <div className="space-y-2">
                {sections.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-light transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-6 rounded-full ${s.enabled ? "bg-gold" : "bg-surface-light"}`} />
                      <span className="text-sm">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSection(s.id)} title="Toggle section"
                        className={`w-8 h-5 rounded-full relative transition-all ${s.enabled ? "bg-gold" : "bg-surface-light border border-border"}`}>
                        <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-all ${s.enabled ? "left-4" : "left-1"}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={generating}
              className="w-full py-3 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {generating ? <><Loader className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5" /> Generate Report</>}
            </button>
          </div>

          {/* Right: Report Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-header text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-gold" /> Report Preview
              </h2>
              <span className="text-xs text-muted bg-surface-light px-2 py-1 rounded">Live Preview</span>
            </div>

            {/* A4 preview container */}
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden" style={{ aspectRatio: "210/297", maxHeight: "80vh" }}>
              <div className="h-full overflow-y-auto px-8 py-6 text-gray-800" style={{ fontSize: "11px" }}>

                {/* Cover Page */}
                {enabledSections.some(s => s.id === "cover") && (
                  <div className="text-center mb-6 pb-6 border-b-2 border-gray-200 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    {whiteLabel && (
                      <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center overflow-hidden">
                        {brandLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={brandLogo}
                            alt="Brand logo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If the logo URL fails, fall back to initials by clearing state.
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              setBrandLogo(null);
                            }}
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">T</span>
                        )}
                      </div>
                    )}
                    <h1 className="text-xl font-bold text-gray-900">{REPORT_LABELS[selectedType]}</h1>
                    <p className="text-gray-500 mt-1 text-sm">Prepared for {clientName}</p>
                    <p className="text-gray-400 mt-1">{dateLabel(dateRange)} &mdash; {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>
                    {whiteLabel && <p className="text-[9px] text-gray-300 mt-3">Powered by Trinity</p>}
                  </div>
                )}

                {/* Executive Summary */}
                {enabledSections.some(s => s.id === "executive_summary") && (
                  <div className="mb-5 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-2 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> Executive Summary
                    </h2>
                    <p className="text-gray-600 leading-relaxed">
                      This period demonstrated strong performance across key metrics. {clientName} saw
                      an 18.3% increase in lead generation with 247 new qualified leads entering the pipeline.
                      Revenue grew 12.7% to $34,500, driven by successful Meta and Google campaigns.
                      Engagement rates remain healthy at 8.4%, above the industry average of 6.2%.
                      We recommend increasing spend on high-ROAS channels while optimizing underperforming campaigns.
                    </p>
                  </div>
                )}

                {/* Key Metrics */}
                {enabledSections.some(s => s.id === "key_metrics") && (
                  <div className="mb-5 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> Key Metrics
                    </h2>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(MOCK_METRICS).map(([key, m]) => (
                        <div key={key} className="bg-gray-50 rounded-lg p-2.5 text-center border border-gray-100">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider">{m.label}</p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">
                            {key === "revenue" ? `$${(m.value as number).toLocaleString()}` :
                              key === "engagement" || key === "roas" ? m.value.toFixed(1) : m.value.toLocaleString()}
                            {key === "engagement" && "%"}
                            {key === "roas" && "x"}
                          </p>
                          <p className={`text-[9px] mt-0.5 font-medium ${m.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {m.change >= 0 ? "+" : ""}{m.change}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts */}
                {enabledSections.some(s => s.id === "charts") && (
                  <div className="mb-5 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> Charts & Visualizations
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Leads by Month</p>
                        <BarChartCSS />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Traffic Trend</p>
                        <LineChartCSS />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-3">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Traffic Sources</p>
                      <DonutChartCSS />
                    </div>
                  </div>
                )}

                {/* Campaign Performance Table */}
                {enabledSections.some(s => s.id === "campaign_table") && (
                  <div className="mb-5 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> Campaign Performance
                    </h2>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-gray-100 text-gray-600">
                            <th className="text-left px-2 py-1.5 font-medium">Campaign</th>
                            <th className="text-right px-2 py-1.5 font-medium">Spend</th>
                            <th className="text-right px-2 py-1.5 font-medium">Clicks</th>
                            <th className="text-right px-2 py-1.5 font-medium">Conv.</th>
                            <th className="text-right px-2 py-1.5 font-medium">ROAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_CAMPAIGNS.map((c, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-2 py-1.5 text-gray-800">{c.name}</td>
                              <td className="text-right px-2 py-1.5 text-gray-600">${c.spend.toLocaleString()}</td>
                              <td className="text-right px-2 py-1.5 text-gray-600">{c.clicks.toLocaleString()}</td>
                              <td className="text-right px-2 py-1.5 text-gray-600">{c.conversions}</td>
                              <td className="text-right px-2 py-1.5 font-medium">
                                <span className={c.roas >= 4 ? "text-emerald-600" : c.roas >= 3 ? "text-amber-600" : "text-red-500"}>
                                  {c.roas}x
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* AI Insights */}
                {includeAI && enabledSections.some(s => s.id === "ai_insights") && (
                  <div className="mb-5 relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-2 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> AI-Generated Insights
                    </h2>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-gray-700 leading-relaxed">
                        <strong>Performance Analysis:</strong> The data reveals a compelling opportunity in your
                        Email Retargeting channel, which delivers 11.4x ROAS at significantly lower spend ($320).
                        Scaling this channel by 3x could yield an estimated additional $7,200 in revenue.
                        Meanwhile, the LinkedIn campaign&apos;s 2.1x ROAS suggests refining audience targeting
                        before increasing spend. Your organic traffic share at 38% is strong, but the 28% paid
                        dependency warrants building more content-driven acquisition to reduce long-term ad costs.
                        Week-over-week engagement improvements indicate that the current content strategy resonates
                        with your audience segment.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {enabledSections.some(s => s.id === "recommendations") && (
                  <div className="relative group">
                    <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-gray-100" title="Edit section">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <h2 className="font-bold text-sm text-gray-900 mb-2 flex items-center gap-1.5">
                      <div className="w-1 h-4 bg-amber-500 rounded" /> Next Steps & Recommendations
                    </h2>
                    <div className="space-y-2">
                      {[
                        { n: 1, text: "Scale Email Retargeting budget from $320 to $1,000 based on strong 11.4x ROAS" },
                        { n: 2, text: "Refine LinkedIn targeting to improve from 2.1x ROAS before scaling spend" },
                        { n: 3, text: "Launch 4 new blog articles targeting high-intent keywords to grow organic traffic" },
                        { n: 4, text: "A/B test Meta ad creative with video variants to improve conversion rate" },
                        { n: 5, text: "Set up automated lead scoring to prioritize the 247 new leads by intent" },
                      ].map(r => (
                        <div key={r.n} className="flex gap-2 items-start">
                          <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[8px] font-bold text-amber-700">{r.n}</span>
                          </div>
                          <p className="text-gray-600">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No sections enabled */}
                {enabledSections.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Layout className="w-12 h-12 mb-3" />
                    <p className="text-sm">Enable at least one section to preview the report</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         TAB: TEMPLATES
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === "templates" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-header text-lg font-semibold">Report Templates</h2>
              <p className="text-muted text-sm mt-1">Pre-built templates to get started quickly</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map(t => (
              <div key={t.id} className="card p-0 overflow-hidden hover:ring-1 hover:ring-gold/20 transition-all">
                {/* Color preview banner */}
                <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${t.accentColor} 0%, ${t.color}40 100%)` }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex gap-1.5">
                      {["w-8 h-10", "w-8 h-7", "w-8 h-12"].map((size, i) => (
                        <div key={i} className={`${size} rounded bg-white/20`} />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-black/30 text-white">
                    {t.sectionsIncluded} sections
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </h3>
                  <p className="text-xs text-muted mt-1">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {t.sections.slice(0, 4).map(s => {
                      const section = DEFAULT_SECTIONS.find(ds => ds.id === s);
                      return section ? (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-muted">
                          {section.label}
                        </span>
                      ) : null;
                    })}
                    {t.sections.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-muted">
                        +{t.sections.length - 4} more
                      </span>
                    )}
                  </div>
                  <button onClick={() => applyTemplate(t)}
                    className="w-full mt-4 py-2 rounded-lg border border-gold/30 text-gold text-sm font-medium hover:bg-gold/10 transition-all flex items-center justify-center gap-2">
                    <ArrowRight className="w-4 h-4" /> Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         TAB: SCHEDULED
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === "scheduled" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-header text-lg font-semibold">Scheduled Reports</h2>
              <p className="text-muted text-sm mt-1">Automatically send reports to clients on a recurring basis</p>
            </div>
            <button onClick={() => setScheduleModal(true)}
              className="btn-primary flex items-center gap-2 bg-gold text-black hover:bg-gold/90">
              <Plus className="w-4 h-4" /> Create Schedule
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Report Type</th>
                    <th className="text-left px-4 py-3 font-medium">Frequency</th>
                    <th className="text-left px-4 py-3 font-medium">Next Send</th>
                    <th className="text-left px-4 py-3 font-medium">AI</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-surface-light/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{s.client}</td>
                      <td className="px-4 py-3 text-muted">{REPORT_LABELS[s.reportType]}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-surface-light text-muted border border-border">
                          {freqLabel(s.frequency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{new Date(s.nextSend).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3">
                        {s.includeAI ? <Sparkles className="w-4 h-4 text-gold" /> : <span className="text-muted">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleScheduleStatus(s.id)} title={s.status === "active" ? "Pause" : "Resume"}
                            className="p-1.5 rounded hover:bg-surface-light transition-colors text-muted hover:text-white">
                            {s.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteSchedule(s.id)} title="Delete"
                            className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-muted hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scheduledReports.length === 0 && (
              <div className="text-center py-12 text-muted">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No scheduled reports yet</p>
                <p className="text-xs mt-1">Create a schedule to automatically send reports</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         TAB: HISTORY
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-header text-lg font-semibold">Report History</h2>
              <p className="text-muted text-sm mt-1">Previously generated reports</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{historyReports.length} reports</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Pages</th>
                    <th className="text-right px-4 py-3 font-medium">Size</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyReports.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-surface-light/50 transition-colors">
                      <td className="px-4 py-3 text-muted">
                        {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.client}</td>
                      <td className="px-4 py-3 text-muted">{REPORT_LABELS[r.type]}</td>
                      <td className="text-right px-4 py-3 text-muted">{r.pages}</td>
                      <td className="text-right px-4 py-3 text-muted">{r.size}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toast.success("Opening preview...")} title="Preview"
                            className="p-1.5 rounded hover:bg-surface-light transition-colors text-muted hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => toast.success("Downloading report...")} title="Download"
                            className="p-1.5 rounded hover:bg-surface-light transition-colors text-muted hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                          {r.status !== "failed" && (
                            <button onClick={() => toast.success("Report resent!")} title="Resend"
                              className="p-1.5 rounded hover:bg-surface-light transition-colors text-muted hover:text-white">
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         MODAL: Create Schedule
         ═══════════════════════════════════════════════════════════ */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setScheduleModal(false)}>
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Create Report Schedule</h3>
              <button onClick={() => setScheduleModal(false)} className="p-1 rounded hover:bg-surface-light text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1.5 block">Client</label>
                <select value={scheduleClient} onChange={e => setScheduleClient(e.target.value)} className="input-field w-full">
                  {MOCK_CLIENTS.map(c => (
                    <option key={c.id} value={c.id}>{c.business_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">Report Type</label>
                <select value={scheduleType} onChange={e => setScheduleType(e.target.value as ReportType)} className="input-field w-full">
                  {REPORT_TYPES.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">Frequency</label>
                <div className="flex gap-2">
                  {(["weekly", "monthly", "quarterly"] as const).map(f => (
                    <button key={f} onClick={() => setScheduleFreq(f)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${scheduleFreq === f
                        ? "bg-gold/10 text-gold border border-gold/30"
                        : "bg-surface-light text-muted border border-border hover:text-white"}`}>
                      {freqLabel(f)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">Email Recipients</label>
                <input type="text" value={scheduleEmail} onChange={e => setScheduleEmail(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  className="input-field w-full" />
                <p className="text-xs text-muted mt-1">Separate multiple emails with commas</p>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">Send Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="input-field w-full" />
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-light">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">Include AI Insights <Sparkles className="w-4 h-4 text-gold" /></p>
                  <p className="text-xs text-muted">Add AI-generated analysis to the report</p>
                </div>
                <button onClick={() => setScheduleAI(!scheduleAI)}
                  className={`w-10 h-6 rounded-full relative transition-all ${scheduleAI ? "bg-gold" : "bg-surface border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${scheduleAI ? "left-5" : "left-1"}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setScheduleModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted hover:text-white transition-all text-sm">
                Cancel
              </button>
              <button onClick={handleCreateSchedule}
                className="flex-1 py-2.5 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-all text-sm flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         MODAL: Send to Client
         ═══════════════════════════════════════════════════════════ */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSendModal(false)}>
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Send Report to Client</h3>
              <button onClick={() => setSendModal(false)} className="p-1 rounded hover:bg-surface-light text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-light rounded-lg p-3 border border-border">
                <p className="text-sm"><span className="text-muted">Report:</span> <span className="font-medium">{REPORT_LABELS[selectedType]}</span></p>
                <p className="text-sm mt-1"><span className="text-muted">Client:</span> <span className="font-medium">{clientName}</span></p>
                <p className="text-sm mt-1"><span className="text-muted">Period:</span> <span className="font-medium">{dateLabel(dateRange)}</span></p>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">Recipient Email</label>
                <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="input-field w-full" />
              </div>

              <div className="flex gap-2 text-xs text-muted">
                <FileDown className="w-4 h-4 flex-shrink-0" />
                <span>The report will be attached as a branded PDF with your company logo</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setSendModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted hover:text-white transition-all text-sm">
                Cancel
              </button>
              <button onClick={handleSendToClient}
                className="flex-1 py-2.5 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-all text-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Send Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page AI */}
      <PageAI
        pageName="Report Generator"
        context="This page lets users build, customize, schedule, and send professional client reports. It supports multiple report types, date ranges, templates, scheduled deliveries, and export formats."
        suggestions={[
          "What report type is best for monthly retainer clients?",
          "How do I set up automatic weekly reports?",
          "What sections should I include for an executive audience?",
          "Help me write a custom executive summary",
        ]}
      />
    </div>
  );
}
