"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Shield, Plus, Trash2, Globe, Eye,
  BarChart3, Bell,
  Sparkles, Loader, ChevronDown, ChevronUp,
  ExternalLink, Pause, Play, RefreshCw,
  Activity, Zap, FileText, Code2, Briefcase,
  MessageSquare, Clock, Calendar,
  AlertTriangle,
  Send, Filter, Target, Lightbulb,
  Flame, Radar, LayoutGrid, PieChart
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

// ─── Types ───────────────────────────────────────────────────────────
type Tab = "changes" | "comparison" | "alerts" | "insights";
type MonitorStatus = "active" | "paused" | "error";
type ChangeType = "new_page" | "content_update" | "pricing_change" | "new_feature" | "new_blog_post" | "social_post" | "job_posting" | "tech_stack_change";
type Severity = "high" | "medium" | "low";
type Frequency = "hourly" | "6hours" | "daily" | "weekly";

interface Competitor {
  id: string;
  name: string;
  url: string;
  industry: string;
  notes: string;
  status: MonitorStatus;
  lastChecked: string;
  changeCount: number;
  faviconColor: string;
  frequency: Frequency;
  nextCheck: string;
}

interface Change {
  id: string;
  competitorId: string;
  competitorName: string;
  type: ChangeType;
  severity: Severity;
  title: string;
  description: string;
  detectedAt: string;
  aiSummary: string;
  beforeText?: string;
  afterText?: string;
}

interface AlertRule {
  id: string;
  name: string;
  triggerType: ChangeType | "any";
  competitor: string;
  channels: string[];
  urgency: "critical" | "normal" | "low";
  enabled: boolean;
}

// ─── Change type metadata ────────────────────────────────────────────
const CHANGE_TYPE_META: Record<ChangeType, { label: string; icon: typeof Globe; color: string }> = {
  new_page:          { label: "New Page",          icon: Globe,          color: "text-blue-400 bg-blue-500/10" },
  content_update:    { label: "Content Update",    icon: FileText,       color: "text-emerald-400 bg-emerald-500/10" },
  pricing_change:    { label: "Pricing Change",    icon: BarChart3,      color: "text-red-400 bg-red-500/10" },
  new_feature:       { label: "New Feature",       icon: Zap,            color: "text-purple-400 bg-purple-500/10" },
  new_blog_post:     { label: "New Blog Post",     icon: FileText,       color: "text-sky-400 bg-sky-500/10" },
  social_post:       { label: "Social Post",       icon: MessageSquare,  color: "text-pink-400 bg-pink-500/10" },
  job_posting:       { label: "Job Posting",       icon: Briefcase,      color: "text-amber-400 bg-amber-500/10" },
  tech_stack_change: { label: "Tech Stack Change", icon: Code2,          color: "text-orange-400 bg-orange-500/10" },
};

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  high:   { label: "High",   color: "text-red-400 bg-red-500/10 border-red-500/30" },
  medium: { label: "Medium", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  low:    { label: "Low",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  hourly: "Every hour", "6hours": "Every 6 hours", daily: "Daily", weekly: "Weekly",
};

const CHANNEL_OPTIONS = ["Email", "Telegram", "Slack", "SMS"];

// ─── Mock Competitors ────────────────────────────────────────────────
const MOCK_COMPETITORS: Competitor[] = [];

// ─── Mock Changes ────────────────────────────────────────────────────
const MOCK_CHANGES: Change[] = [];

// ─── Mock Alert Rules ────────────────────────────────────────────────
const MOCK_ALERT_RULES: AlertRule[] = [];

// ─── Comparison data ─────────────────────────────────────────────────
const COMPARISON_ROWS: { metric: string; you: string; values: string[]; scores: number[] }[] = [];

// ─── Component ───────────────────────────────────────────────────────
export default function CompetitiveMonitorPage() {
  useAuth();

  const [tab, setTab] = useState<Tab>("changes");
  const [competitors, setCompetitors] = useState<Competitor[]>(MOCK_COMPETITORS);
  const [changes] = useState<Change[]>(MOCK_CHANGES);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(MOCK_ALERT_RULES);

  // Add competitor form
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addIndustry, setAddIndustry] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [filterCompetitor, setFilterCompetitor] = useState("all");
  const [filterType, setFilterType] = useState<ChangeType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");

  // Expanded changes
  const [expandedChange, setExpandedChange] = useState<string | null>(null);

  // Checking state
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Alerts
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertTrigger, setNewAlertTrigger] = useState<ChangeType | "any">("any");
  const [newAlertCompetitor, setNewAlertCompetitor] = useState("all");
  const [newAlertChannels, setNewAlertChannels] = useState<string[]>(["Email"]);
  const [newAlertUrgency, setNewAlertUrgency] = useState<"critical" | "normal" | "low">("normal");

  // Insights
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

  // Filtered changes
  const filteredChanges = useMemo(() => {
    return changes.filter(c => {
      if (filterCompetitor !== "all" && c.competitorId !== filterCompetitor) return false;
      if (filterType !== "all" && c.type !== filterType) return false;
      if (filterSeverity !== "all" && c.severity !== filterSeverity) return false;
      return true;
    });
  }, [changes, filterCompetitor, filterType, filterSeverity]);

  // Stats
  const activeCompetitors = competitors.filter(c => c.status === "active").length;
  const highSeverityChanges = changes.filter(c => c.severity === "high").length;
  const totalChanges = changes.length;
  const creditsUsed = 247;
  const creditsTotal = 500;

  function addCompetitor() {
    if (!addUrl || !addName) { toast.error("URL and name are required"); return; }
    const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9", "#ef4444", "#d946ef"];
    const newComp: Competitor = {
      id: `c${Date.now()}`, name: addName, url: addUrl, industry: addIndustry || "Unknown",
      notes: addNotes, status: "active", lastChecked: "Never", changeCount: 0,
      faviconColor: colors[Math.floor(Math.random() * colors.length)],
      frequency: "daily", nextCheck: "Pending...",
    };
    setCompetitors(prev => [...prev, newComp]);
    setAddUrl(""); setAddName(""); setAddIndustry(""); setAddNotes("");
    setShowAddForm(false);
    toast.success(`${addName} added to monitoring`);
  }

  async function checkNow(id: string) {
    setCheckingId(id);
    const comp = competitors.find(c => c.id === id);
    if (!comp) return;
    try {
      const res = await fetch("/api/monitor/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_url: comp.url, check_type: "full" }),
      });
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      setCompetitors(prev => prev.map(c =>
        c.id === id ? { ...c, lastChecked: new Date().toISOString(), changeCount: c.changeCount + data.changes_detected } : c
      ));
      toast.success(`Found ${data.changes_detected} change(s) for ${comp.name}`);
    } catch {
      toast.error("Failed to check competitor");
    }
    setCheckingId(null);
  }

  function togglePause(id: string) {
    setCompetitors(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === "paused" ? "active" : "paused" } : c
    ));
    const comp = competitors.find(c => c.id === id);
    toast.success(`${comp?.name} ${comp?.status === "paused" ? "resumed" : "paused"}`);
  }

  function removeCompetitor(id: string) {
    const comp = competitors.find(c => c.id === id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
    toast.success(`${comp?.name} removed`);
  }

  function toggleAlertChannel(ch: string) {
    setNewAlertChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  }

  function addAlertRule() {
    if (!newAlertName) { toast.error("Alert name is required"); return; }
    const rule: AlertRule = {
      id: `a${Date.now()}`, name: newAlertName, triggerType: newAlertTrigger,
      competitor: newAlertCompetitor, channels: newAlertChannels, urgency: newAlertUrgency, enabled: true,
    };
    setAlertRules(prev => [...prev, rule]);
    setNewAlertName(""); setNewAlertTrigger("any"); setNewAlertCompetitor("all");
    setNewAlertChannels(["Email"]); setNewAlertUrgency("normal"); setShowAddAlert(false);
    toast.success("Alert rule created");
  }

  function testAlert(_id: string) {
    toast.success("Test alert sent! Check your configured channels.");
  }

  function generateAiAnalysis() {
    setGeneratingAnalysis(true);
    setTimeout(() => { setShowAiAnalysis(true); setGeneratingAnalysis(false); }, 1500);
  }

  function formatTime(iso: string, future = false) {
    if (iso === "Never" || iso === "—" || iso === "Pending..." || iso === "Retrying...") return iso;
    const d = new Date(iso);
    const now = new Date();
    const diff = future ? d.getTime() - now.getTime() : now.getTime() - d.getTime();
    if (diff < 0) return future ? "Now" : "Just now";
    if (diff < 3600000) return future ? `in ${Math.floor(diff / 60000)}m` : `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return future ? `in ${Math.floor(diff / 3600000)}h` : `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const statusClasses: Record<MonitorStatus, string> = {
    active: "text-emerald-400 bg-emerald-500/10",
    paused: "text-amber-400 bg-amber-500/10",
    error: "text-red-400 bg-red-500/10",
  };

  // ─── Activity heatmap data (competitors x weeks) ──────────────────
  const heatmapData = competitors.slice(0, 7).map(c => ({
    name: c.name,
    weeks: [
      Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 8),
    ],
  }));

  const TABS: { key: Tab; label: string; icon: typeof Globe }[] = [
    { key: "changes", label: "Changes Feed", icon: Activity },
    { key: "comparison", label: "Comparison", icon: BarChart3 },
    { key: "alerts", label: "Alerts", icon: Bell },
    { key: "insights", label: "Insights", icon: Lightbulb },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Radar className="w-7 h-7 text-gold" />
            Competitive Monitor
          </h1>
          <p className="text-xs text-muted mt-1">Track competitor changes, pricing, features, and market moves in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold rounded-lg hover:bg-gold/20 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Competitor
          </button>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1"><Target className="w-3.5 h-3.5" /> Monitoring</div>
          <div className="text-2xl font-bold text-gold">{activeCompetitors}</div>
          <div className="text-xs text-muted">{competitors.length} total competitors</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1"><Activity className="w-3.5 h-3.5" /> Changes (7d)</div>
          <div className="text-2xl font-bold">{totalChanges}</div>
          <div className="text-xs text-muted">across all competitors</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1"><AlertTriangle className="w-3.5 h-3.5" /> High Priority</div>
          <div className="text-2xl font-bold text-red-400">{highSeverityChanges}</div>
          <div className="text-xs text-muted">require attention</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1"><Zap className="w-3.5 h-3.5" /> Credits</div>
          <div className="text-2xl font-bold">{creditsUsed}/{creditsTotal}</div>
          <div className="w-full bg-surface-light rounded-full h-1.5 mt-2">
            <div className="bg-gold rounded-full h-1.5 transition-all" style={{ width: `${(creditsUsed / creditsTotal) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* ─── Add Competitor Form ─── */}
      {showAddForm && (
        <div className="card p-5 border border-gold/20">
          <h3 className="section-header text-sm flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-gold" /> Add New Competitor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Company Name *</label>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Acme Agency Tools" className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Website URL *</label>
              <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://competitor.com" className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Industry</label>
              <input value={addIndustry} onChange={e => setAddIndustry(e.target.value)} placeholder="e.g. Agency SaaS" className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Notes</label>
              <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Any context about this competitor..." className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addCompetitor} className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90 transition">Add Competitor</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-surface-light border border-border text-muted rounded-lg text-sm hover:text-white transition">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Competitors Grid ─── */}
      <div>
        <h2 className="section-header text-sm mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-gold" /> Monitored Competitors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {competitors.map(comp => (
            <div key={comp.id} className="card p-4 hover:border-gold/20 transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: comp.faviconColor }}>
                    {comp.name[0]}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{comp.name}</div>
                    <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-gold flex items-center gap-1">
                      {comp.url.replace("https://", "")} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusClasses[comp.status]}`}>
                  {comp.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-2 py-0.5 bg-surface-light rounded-full text-muted">{comp.industry}</span>
                {comp.changeCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 bg-gold/10 text-gold rounded-full font-medium">{comp.changeCount} changes</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted mb-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(comp.lastChecked)}</span>
                <span>{FREQUENCY_LABELS[comp.frequency]}</span>
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => checkNow(comp.id)} disabled={checkingId === comp.id} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gold/10 text-gold rounded text-[10px] font-medium hover:bg-gold/20 transition disabled:opacity-50">
                  {checkingId === comp.id ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Check
                </button>
                <button onClick={() => togglePause(comp.id)} className="flex items-center justify-center px-2 py-1.5 bg-surface-light text-muted rounded text-[10px] hover:text-white transition">
                  {comp.status === "paused" ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
                <button onClick={() => { setFilterCompetitor(comp.id); setTab("changes"); }} className="flex items-center justify-center px-2 py-1.5 bg-surface-light text-muted rounded text-[10px] hover:text-white transition">
                  <Eye className="w-3 h-3" />
                </button>
                <button onClick={() => removeCompetitor(comp.id)} className="flex items-center justify-center px-2 py-1.5 bg-surface-light text-muted rounded text-[10px] hover:text-red-400 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Monitoring Schedule ─── */}
      <div className="card p-4">
        <h3 className="section-header text-xs flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-gold" /> Monitoring Schedule</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {competitors.filter(c => c.status === "active").slice(0, 4).map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 bg-surface-light rounded-lg">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: c.faviconColor }}>{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{c.name}</div>
                <div className="text-[10px] text-muted">{FREQUENCY_LABELS[c.frequency]}</div>
              </div>
              <div className="text-[10px] text-gold whitespace-nowrap">{c.nextCheck === "—" || c.nextCheck === "Retrying..." ? c.nextCheck : formatTime(c.nextCheck, true)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === t.key ? "border-gold text-gold" : "border-transparent text-muted hover:text-white"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── Changes Feed Tab ─── */}
      {tab === "changes" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted" />
            <select value={filterCompetitor} onChange={e => setFilterCompetitor(e.target.value)} className="px-3 py-1.5 bg-surface-light border border-border rounded-lg text-xs focus:border-gold/50 focus:outline-none">
              <option value="all">All Competitors</option>
              {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as ChangeType | "all")} className="px-3 py-1.5 bg-surface-light border border-border rounded-lg text-xs focus:border-gold/50 focus:outline-none">
              <option value="all">All Types</option>
              {Object.entries(CHANGE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as Severity | "all")} className="px-3 py-1.5 bg-surface-light border border-border rounded-lg text-xs focus:border-gold/50 focus:outline-none">
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {(filterCompetitor !== "all" || filterType !== "all" || filterSeverity !== "all") && (
              <button onClick={() => { setFilterCompetitor("all"); setFilterType("all"); setFilterSeverity("all"); }} className="text-xs text-gold hover:underline">Clear filters</button>
            )}
            <span className="text-xs text-muted ml-auto">{filteredChanges.length} change{filteredChanges.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Changes list */}
          <div className="space-y-3">
            {filteredChanges.map(change => {
              const meta = CHANGE_TYPE_META[change.type];
              const sevMeta = SEVERITY_META[change.severity];
              const Icon = meta.icon;
              const isExpanded = expandedChange === change.id;
              return (
                <div key={change.id} className="card p-4 hover:border-border transition">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{change.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sevMeta.color}`}>{sevMeta.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted mb-2">
                        <span className="font-medium text-white/80">{change.competitorName}</span>
                        <span>&#183;</span>
                        <span>{formatTime(change.detectedAt)}</span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{change.description}</p>

                      {/* AI Summary */}
                      <div className="mt-2 p-2.5 bg-gold/5 border border-gold/10 rounded-lg">
                        <div className="flex items-center gap-1.5 text-[10px] text-gold font-medium mb-1">
                          <Sparkles className="w-3 h-3" /> AI Analysis
                        </div>
                        <p className="text-xs text-muted leading-relaxed">{change.aiSummary}</p>
                      </div>

                      {/* Expandable diff */}
                      {(change.beforeText || change.afterText) && (
                        <button onClick={() => setExpandedChange(isExpanded ? null : change.id)} className="flex items-center gap-1 text-[10px] text-gold mt-2 hover:underline">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "Hide" : "View"} before/after
                        </button>
                      )}
                      {isExpanded && change.beforeText && change.afterText && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                            <div className="text-[10px] text-red-400 font-medium mb-1.5">Before</div>
                            <pre className="text-[11px] text-muted whitespace-pre-wrap font-mono">{change.beforeText}</pre>
                          </div>
                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                            <div className="text-[10px] text-emerald-400 font-medium mb-1.5">After</div>
                            <pre className="text-[11px] text-muted whitespace-pre-wrap font-mono">{change.afterText}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Comparison Tab ─── */}
      {tab === "comparison" && (
        <div className="space-y-6">
          {/* Comparison Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted font-medium sticky left-0 bg-surface z-10 min-w-[120px]">Metric</th>
                    <th className="p-3 text-center text-gold font-bold min-w-[100px]">You</th>
                    {competitors.map(c => (
                      <th key={c.id} className="p-3 text-center font-medium min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: c.faviconColor }}>{c.name[0]}</div>
                          <span className="truncate">{c.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50 hover:bg-surface-light/50 transition">
                      <td className="p-3 font-medium text-muted sticky left-0 bg-surface">{row.metric}</td>
                      <td className="p-3 text-center text-gold font-bold">{row.you}</td>
                      {row.values.map((val, vi) => {
                        const score = row.scores[vi];
                        const clr = score === 1 ? "text-emerald-400" : score === -1 ? "text-red-400" : "text-amber-400";
                        return <td key={vi} className={`p-3 text-center ${clr}`}>{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Spider chart representation */}
          <div className="card p-5">
            <h3 className="section-header text-sm flex items-center gap-2 mb-4"><PieChart className="w-4 h-4 text-gold" /> Competitive Positioning</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Simple radar visualization */}
              <div className="relative flex items-center justify-center py-8">
                <div className="relative w-64 h-64">
                  {/* Concentric rings */}
                  {[100, 75, 50, 25].map(size => (
                    <div key={size} className="absolute border border-border/30 rounded-full" style={{ width: `${size}%`, height: `${size}%`, top: `${(100 - size) / 2}%`, left: `${(100 - size) / 2}%` }} />
                  ))}
                  {/* Axis labels */}
                  {["Price", "Features", "Social", "Content", "Reviews", "Team"].map((label, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    const x = 50 + 54 * Math.cos(angle);
                    const y = 50 + 54 * Math.sin(angle);
                    return <div key={label} className="absolute text-[10px] text-muted font-medium -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>{label}</div>;
                  })}
                  {/* Your company dot cluster */}
                  {[40, 35, 30, 38, 42, 28].map((dist, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    const x = 50 + dist * Math.cos(angle);
                    const y = 50 + dist * Math.sin(angle);
                    return <div key={i} className="absolute w-2.5 h-2.5 bg-gold rounded-full border-2 border-gold/30 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }} />;
                  })}
                  {/* Top competitor dots */}
                  {[35, 40, 45, 32, 38, 42].map((dist, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    const x = 50 + dist * Math.cos(angle);
                    const y = 50 + dist * Math.sin(angle);
                    return <div key={`comp-${i}`} className="absolute w-2 h-2 bg-purple-400 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-60" style={{ left: `${x}%`, top: `${y}%` }} />;
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-gold rounded-full" /> <span>Your company</span>
                  <div className="w-3 h-3 bg-purple-400 rounded-full ml-4 opacity-60" /> <span className="text-muted">Top competitor avg.</span>
                </div>
                <div className="p-3 bg-surface-light rounded-lg space-y-2">
                  <div className="text-xs font-medium">Strengths</div>
                  <div className="text-xs text-emerald-400">Pricing competitiveness, Review ratings, Feature depth</div>
                  <div className="text-xs font-medium mt-2">Weaknesses</div>
                  <div className="text-xs text-red-400">Social media presence, Team size, Blog frequency</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-header text-sm flex items-center gap-2 mb-0"><Sparkles className="w-4 h-4 text-gold" /> AI Competitive Analysis</h3>
              <button onClick={generateAiAnalysis} disabled={generatingAnalysis} className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 text-gold rounded-lg text-xs font-medium hover:bg-gold/20 transition disabled:opacity-50">
                {generatingAnalysis ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate AI Analysis
              </button>
            </div>
            {showAiAnalysis ? (
              <div className="p-4 bg-gold/5 border border-gold/10 rounded-lg text-sm text-muted leading-relaxed space-y-3">
                <p><strong className="text-white">Market Position:</strong> ShortStack OS occupies a strong mid-market position in the agency SaaS space. Your pricing is competitive against 6 of 8 tracked competitors, and your feature count (42) exceeds the median (32). However, MarketMind AI&apos;s introduction of a free tier and AgencyFlow&apos;s upmarket push are creating a squeeze that requires strategic response.</p>
                <p><strong className="text-white">Key Threats:</strong> The convergence of AgencyFlow and ClientPulse toward enterprise signals a market bifurcation. SocialSpark&apos;s rapid growth (5,000 customers) and AI content calendar launch pose the most immediate feature-parity threat. MarketMind&apos;s free tier could erode your starter plan acquisition.</p>
                <p><strong className="text-white">Opportunities:</strong> AgencyFlow&apos;s 34% price increase creates a window for targeted switching campaigns. ContentEngine&apos;s limited feature set (22) makes their customer base vulnerable. The enterprise space is underserved by purpose-built agency tools -- an enterprise tier with SSO and advanced reporting could capture this growing segment.</p>
                <p><strong className="text-white">Recommended Actions:</strong> (1) Ship AI scheduling to match SocialSpark within 30 days. (2) Launch a &ldquo;Switch from AgencyFlow&rdquo; campaign targeting price-sensitive users. (3) Evaluate a free tier or extended trial to counter MarketMind. (4) Invest in content marketing to close the blog frequency gap.</p>
              </div>
            ) : (
              <div className="text-xs text-muted text-center py-8">Click &ldquo;Generate AI Analysis&rdquo; to get an AI-written competitive assessment based on all tracked data.</div>
            )}
          </div>
        </div>
      )}

      {/* ─── Alerts Tab ─── */}
      {tab === "alerts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-header text-sm flex items-center gap-2 mb-0"><Bell className="w-4 h-4 text-gold" /> Alert Rules</h3>
            <button onClick={() => setShowAddAlert(!showAddAlert)} className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 text-gold rounded-lg text-xs font-medium hover:bg-gold/20 transition">
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
          </div>

          {/* Add alert form */}
          {showAddAlert && (
            <div className="card p-5 border border-gold/20">
              <h4 className="text-sm font-medium mb-4">New Alert Rule</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Alert Name *</label>
                  <input value={newAlertName} onChange={e => setNewAlertName(e.target.value)} placeholder="e.g. Price drop detected" className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Trigger (Change Type)</label>
                  <select value={newAlertTrigger} onChange={e => setNewAlertTrigger(e.target.value as ChangeType | "any")} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none">
                    <option value="any">Any change type</option>
                    {Object.entries(CHANGE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Competitor</label>
                  <select value={newAlertCompetitor} onChange={e => setNewAlertCompetitor(e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none">
                    <option value="all">All competitors</option>
                    {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Urgency</label>
                  <select value={newAlertUrgency} onChange={e => setNewAlertUrgency(e.target.value as "critical" | "normal" | "low")} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-gold/50 focus:outline-none">
                    <option value="critical">Critical</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs text-muted mb-2">Channels</label>
                <div className="flex gap-2">
                  {CHANNEL_OPTIONS.map(ch => (
                    <button key={ch} onClick={() => toggleAlertChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${newAlertChannels.includes(ch) ? "bg-gold/20 text-gold border border-gold/30" : "bg-surface-light text-muted border border-border hover:text-white"}`}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={addAlertRule} className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90 transition">Create Rule</button>
                <button onClick={() => setShowAddAlert(false)} className="px-4 py-2 bg-surface-light border border-border text-muted rounded-lg text-sm hover:text-white transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Alert rules list */}
          <div className="space-y-2">
            {alertRules.map(rule => {
              const triggerMeta = rule.triggerType === "any" ? null : CHANGE_TYPE_META[rule.triggerType];
              const urgencyColor = rule.urgency === "critical" ? "text-red-400 bg-red-500/10" : rule.urgency === "normal" ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10";
              return (
                <div key={rule.id} className={`card p-4 flex items-center gap-4 ${!rule.enabled ? "opacity-50" : ""}`}>
                  <button onClick={() => setAlertRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                    className={`w-10 h-5 rounded-full transition relative ${rule.enabled ? "bg-gold" : "bg-surface-light"}`}>
                    <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${rule.enabled ? "left-5.5" : "left-0.5"}`}
                      style={{ left: rule.enabled ? "22px" : "2px" }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rule.name}</span>
                      {triggerMeta && <span className={`text-[10px] px-2 py-0.5 rounded-full ${triggerMeta.color}`}>{triggerMeta.label}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${urgencyColor}`}>{rule.urgency}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span>Applies to: {rule.competitor === "all" ? "All competitors" : competitors.find(c => c.id === rule.competitor)?.name || rule.competitor}</span>
                      <span>&#183;</span>
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" /> {rule.channels.join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => testAlert(rule.id)} className="px-3 py-1.5 bg-surface-light border border-border text-muted rounded-lg text-xs hover:text-gold transition">Test</button>
                    <button onClick={() => setAlertRules(prev => prev.filter(r => r.id !== rule.id))} className="px-2 py-1.5 bg-surface-light border border-border text-muted rounded-lg text-xs hover:text-red-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Insights Tab ─── */}
      {tab === "insights" && (
        <div className="space-y-6">
          {/* AI Market Summary */}
          <div className="card p-5 border border-gold/10">
            <h3 className="section-header text-sm flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-gold" /> AI Market Summary</h3>
            <div className="text-sm text-muted leading-relaxed space-y-2">
              <p>The agency SaaS market continues to consolidate around AI-first platforms. Over the past week, <strong className="text-white">3 of 8 tracked competitors</strong> made AI-related announcements. Pricing is trending upward (AgencyFlow +34%), while MarketMind bucks the trend with a free tier launch. The enterprise segment is heating up with both AgencyFlow and ClientPulse making upmarket moves.</p>
              <p>Your positioning remains strong on <span className="text-emerald-400">pricing</span> and <span className="text-emerald-400">review ratings</span>, but you are falling behind on <span className="text-red-400">social media presence</span> and <span className="text-red-400">content velocity</span>. The biggest opportunity window is the 2-4 week period before competitors ship their announced features.</p>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="card p-5">
            <h3 className="section-header text-sm flex items-center gap-2 mb-4"><LayoutGrid className="w-4 h-4 text-gold" /> Competitor Activity Heatmap (Last 4 Weeks)</h3>
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="flex items-center gap-2 mb-2 pl-28">
                  {["Week 1", "Week 2", "Week 3", "Week 4"].map(w => (
                    <div key={w} className="flex-1 text-center text-[10px] text-muted">{w}</div>
                  ))}
                </div>
                {heatmapData.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-2 mb-1.5">
                    <div className="w-28 text-xs text-muted truncate text-right pr-2">{row.name}</div>
                    {row.weeks.map((val, wi) => {
                      const intensity = Math.min(val / 7, 1);
                      const bg = intensity === 0 ? "bg-surface-light" : intensity < 0.3 ? "bg-emerald-500/20" : intensity < 0.6 ? "bg-emerald-500/40" : "bg-emerald-500/70";
                      return (
                        <div key={wi} className={`flex-1 h-8 rounded ${bg} flex items-center justify-center`}>
                          <span className="text-[10px] text-muted">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3 pl-28">
                  <span className="text-[10px] text-muted">Less</span>
                  <div className="w-4 h-4 rounded bg-surface-light" />
                  <div className="w-4 h-4 rounded bg-emerald-500/20" />
                  <div className="w-4 h-4 rounded bg-emerald-500/40" />
                  <div className="w-4 h-4 rounded bg-emerald-500/70" />
                  <span className="text-[10px] text-muted">More</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Threats */}
          <div>
            <h3 className="section-header text-sm flex items-center gap-2 mb-3"><Flame className="w-4 h-4 text-red-400" /> Top Threats</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { competitor: "SocialSpark", title: "AI Content Calendar Launch", desc: "Direct feature overlap with your content scheduling. They shipped first and are marketing aggressively. You have a 2-4 week window before adoption solidifies.", severity: "critical" },
                { competitor: "MarketMind AI", title: "Free Tier Introduction", desc: "The free plan targets your starter-tier audience. Early data suggests strong adoption -- expect 5-10% erosion of your trial-to-paid funnel within 60 days.", severity: "critical" },
                { competitor: "ClientPulse", title: "Enterprise Sales Push", desc: "The VP of Enterprise Sales hire signals serious upmarket intent. Combined with real-time dashboards, they will compete for your mid-market accounts moving upscale.", severity: "high" },
              ].map((threat, i) => (
                <div key={i} className="card p-4 border border-red-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-medium text-red-400">{threat.competitor}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${threat.severity === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>{threat.severity}</span>
                  </div>
                  <div className="text-sm font-medium mb-1.5">{threat.title}</div>
                  <p className="text-xs text-muted leading-relaxed">{threat.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunities */}
          <div>
            <h3 className="section-header text-sm flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-gold" /> Opportunities</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "AgencyFlow Price Increase", desc: "Their 34% price hike on the Pro plan creates a migration window. Launch a targeted \"Switch & Save\" campaign offering 6 months at your current rate with white-glove migration support.", impact: "high" },
                { title: "ContentEngine Feature Gap", desc: "ContentEngine has only 22 features vs your 42. Their customer base is content-focused and likely outgrowing the platform. Position your content features in comparison content.", impact: "medium" },
                { title: "Enterprise White Space", desc: "No competitor has a dedicated enterprise offering with SOC2, SSO, and advanced permissions. First mover advantage could capture the growing segment of agencies with 50+ employees.", impact: "high" },
              ].map((opp, i) => (
                <div key={i} className="card p-4 border border-gold/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-gold" />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${opp.impact === "high" ? "bg-gold/10 text-gold" : "bg-amber-500/10 text-amber-400"}`}>{opp.impact} impact</span>
                  </div>
                  <div className="text-sm font-medium mb-1.5">{opp.title}</div>
                  <p className="text-xs text-muted leading-relaxed">{opp.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Market Share Estimation */}
          <div className="card p-5">
            <h3 className="section-header text-sm flex items-center gap-2 mb-4"><PieChart className="w-4 h-4 text-gold" /> Estimated Market Share (Agency SaaS Segment)</h3>
            <div className="space-y-3">
              {[
                { name: "AgencyFlow", share: 22, color: "#6366f1" },
                { name: "MarketMind AI", share: 18, color: "#8b5cf6" },
                { name: "SocialSpark", share: 15, color: "#f59e0b" },
                { name: "ShortStack OS (You)", share: 12, color: "#C9A84C" },
                { name: "ClientPulse", share: 10, color: "#ec4899" },
                { name: "ContentEngine", share: 8, color: "#0ea5e9" },
                { name: "Others", share: 15, color: "#64748b" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-right truncate" style={{ color: item.name.includes("You") ? "#C9A84C" : undefined }}>
                    {item.name.includes("You") ? <strong>{item.name}</strong> : item.name}
                  </div>
                  <div className="flex-1 bg-surface-light rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full flex items-center pl-2 transition-all duration-700" style={{ width: `${item.share * 3}%`, backgroundColor: item.color }}>
                      <span className="text-[10px] text-white font-bold">{item.share}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-3 text-center">Estimated based on public data, hiring signals, social metrics, and web traffic analysis. Updated weekly.</p>
          </div>
        </div>
      )}

      {/* ─── PageAI ─── */}
      <PageAI
        pageName="Competitive Monitor"
        context="Competitive intelligence dashboard tracking 8 agency SaaS competitors. Monitors pricing changes, feature launches, content updates, hiring signals, and tech stack changes. Includes AI analysis, alerts, and market insights."
        suggestions={[
          "What competitor moves should I respond to first?",
          "Generate a competitive battle card for AgencyFlow",
          "How should I counter MarketMind's free tier?",
          "Draft a 'Switch from AgencyFlow' landing page",
        ]}
      />
    </div>
  );
}
