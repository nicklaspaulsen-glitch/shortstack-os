"use client";

import { useState } from "react";
import {
  Monitor, Zap, Plus, RefreshCw, CheckCircle, Clock, Trash2,
  Cpu, MemoryStick, HardDrive,
  Play, Calendar, Eye, ShieldAlert, Store, Settings,
  BarChart3, History, Search, Terminal, Download
} from "lucide-react";

/* ── mock data ── */
const MOCK_ACTIVITY = [
  { id: "a1", agent: "Content Engine", action: "Generated 5 Instagram captions", status: "success", time: "2 min ago", cpu: 12 },
  { id: "a2", agent: "Lead Finder", action: "Scraped 48 leads from Google Maps", status: "success", time: "8 min ago", cpu: 34 },
  { id: "a3", agent: "Outreach Bot", action: "Sent 12 cold DMs on Instagram", status: "success", time: "15 min ago", cpu: 8 },
  { id: "a4", agent: "SEO Agent", action: "Analyzed 3 competitor keywords", status: "warning", time: "22 min ago", cpu: 18 },
  { id: "a5", agent: "Invoice Agent", action: "Chased 2 overdue invoices", status: "success", time: "1h ago", cpu: 5 },
  { id: "a6", agent: "Retention Agent", action: "Flagged 1 at-risk client", status: "error", time: "2h ago", cpu: 9 },
];

const MOCK_QUEUE: Array<{ id: string; title: string; priority: "high" | "medium" | "low"; status: "pending" | "running" | "done"; agent: string; eta: string }> = [
  { id: "q1", title: "Generate weekly content calendar", priority: "high", status: "running", agent: "Content Engine", eta: "~2 min" },
  { id: "q2", title: "Scrape dentists in Miami", priority: "high", status: "pending", agent: "Lead Finder", eta: "~5 min" },
  { id: "q3", title: "Send follow-up emails batch", priority: "medium", status: "pending", agent: "Outreach Bot", eta: "~8 min" },
  { id: "q4", title: "Update client health scores", priority: "medium", status: "pending", agent: "Retention Agent", eta: "~3 min" },
  { id: "q5", title: "Create brand kit for Acme", priority: "low", status: "done", agent: "Design Agent", eta: "Done" },
];

const MOCK_LOGS = [
  { ts: "14:32:01", level: "info", agent: "Content Engine", msg: "Starting content generation for client #42" },
  { ts: "14:32:03", level: "info", agent: "Content Engine", msg: "Fetched brand voice profile successfully" },
  { ts: "14:32:08", level: "info", agent: "Content Engine", msg: "Generated 5/5 captions, writing to DB" },
  { ts: "14:32:09", level: "success", agent: "Content Engine", msg: "Task completed in 8.2s" },
  { ts: "14:31:45", level: "info", agent: "Lead Finder", msg: "Initiating Google Maps scrape: dentist, Miami FL" },
  { ts: "14:31:50", level: "warn", agent: "Lead Finder", msg: "Rate limit warning — slowing requests" },
  { ts: "14:31:58", level: "info", agent: "Lead Finder", msg: "Scraped 48 results, filtering duplicates" },
  { ts: "14:32:00", level: "error", agent: "Retention Agent", msg: "Failed to fetch health data: timeout after 30s" },
  { ts: "14:30:12", level: "info", agent: "Outreach Bot", msg: "Queued 12 DMs for delivery via Instagram API" },
  { ts: "14:30:15", level: "success", agent: "Outreach Bot", msg: "All 12 DMs sent successfully" },
];

const MOCK_ERRORS = [
  { id: "e1", agent: "Retention Agent", error: "Timeout fetching client health data", time: "2h ago", retries: 2, resolved: false },
  { id: "e2", agent: "SEO Agent", error: "Google API rate limit exceeded", time: "4h ago", retries: 3, resolved: true },
  { id: "e3", agent: "Invoice Agent", error: "Stripe webhook signature mismatch", time: "1d ago", retries: 1, resolved: true },
];

const MOCK_MARKETPLACE = [
  { id: "m1", name: "Reddit Scraper", desc: "Scrape leads from Reddit threads", author: "ShortStack", installs: 234, rating: 4.8 },
  { id: "m2", name: "Podcast Outreach", desc: "Find & pitch podcast hosts", author: "Community", installs: 89, rating: 4.5 },
  { id: "m3", name: "Review Responder", desc: "Auto-reply to Google reviews", author: "ShortStack", installs: 512, rating: 4.9 },
  { id: "m4", name: "Email Warmup", desc: "Warm up cold email domains", author: "Community", installs: 178, rating: 4.3 },
  { id: "m5", name: "LinkedIn Scraper", desc: "Extract LinkedIn profile data", author: "ShortStack", installs: 345, rating: 4.7 },
  { id: "m6", name: "Slack Notifier", desc: "Push agent events to Slack", author: "Community", installs: 156, rating: 4.6 },
];

const MOCK_SCHEDULES = [
  { id: "s1", agent: "Lead Finder", schedule: "Every day at 09:00", next: "Tomorrow 09:00", enabled: true },
  { id: "s2", agent: "Outreach Bot", schedule: "Mon-Fri at 10:00", next: "Tomorrow 10:00", enabled: true },
  { id: "s3", agent: "Content Engine", schedule: "Every Monday at 08:00", next: "Mon 08:00", enabled: true },
  { id: "s4", agent: "Invoice Agent", schedule: "1st of month at 09:00", next: "May 1 09:00", enabled: false },
  { id: "s5", agent: "Retention Agent", schedule: "Every day at 17:00", next: "Today 17:00", enabled: true },
];

const MOCK_VERSIONS = [
  { ver: "v2.4.0", date: "Apr 14, 2026", changes: "Added Reddit scraper agent, improved lead scoring" },
  { ver: "v2.3.2", date: "Apr 10, 2026", changes: "Fixed outreach rate limiter, added DM templates" },
  { ver: "v2.3.0", date: "Apr 5, 2026", changes: "New content calendar generation, bulk actions" },
  { ver: "v2.2.1", date: "Mar 28, 2026", changes: "Hotfix: Invoice agent Stripe webhook" },
  { ver: "v2.2.0", date: "Mar 20, 2026", changes: "Agent marketplace launch, custom agent builder" },
];

const MOCK_METRICS = [
  { label: "Tasks Completed", value: "1,247", change: "+12%", positive: true },
  { label: "Avg Response Time", value: "3.2s", change: "-0.8s", positive: true },
  { label: "Error Rate", value: "1.8%", change: "-0.3%", positive: true },
  { label: "Uptime", value: "99.97%", change: "+0.02%", positive: true },
  { label: "API Calls Today", value: "8,432", change: "+340", positive: true },
  { label: "Cost Today", value: "$4.82", change: "-$0.41", positive: true },
];

const TABS = ["Activity", "Queue", "Logs", "Errors", "Schedule", "Marketplace", "Metrics", "Config", "Versions"] as const;
type Tab = typeof TABS[number];

const QUICK_TASKS = [
  { title: "Create social media campaign", description: "Scaffold a complete multi-platform social campaign", type: "social-campaign", priority: "medium" as const },
  { title: "Build a landing page", description: "Generate a responsive landing page", type: "website", priority: "medium" as const },
  { title: "Generate content calendar", description: "Create a weekly content calendar", type: "content-calendar", priority: "medium" as const },
  { title: "Create brand kit", description: "Scaffold brand guidelines", type: "brand-kit", priority: "low" as const },
  { title: "Write email sequence", description: "Generate a 5-email drip campaign", type: "email-sequence", priority: "medium" as const },
  { title: "Organize workspace files", description: "Scan and auto-organize workspace files", type: "organize", priority: "low" as const },
];

export default function AgentDesktopPage() {
  const [tab, setTab] = useState<Tab>("Activity");
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "error" | "success">("all");
  const [logSearch, setLogSearch] = useState("");
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [errors, setErrors] = useState(MOCK_ERRORS);
  const [configJson, setConfigJson] = useState(JSON.stringify({ max_concurrent_tasks: 3, retry_attempts: 3, timeout_seconds: 30, log_level: "info", rate_limit_buffer: 0.8 }, null, 2));
  const [outputPreview, setOutputPreview] = useState<string | null>(null);
  const [triggerAgent, setTriggerAgent] = useState("");
  const [triggerTask, setTriggerTask] = useState("");

  /* resource usage mock */
  const cpuUsage = 42;
  const memUsage = 61;
  const diskUsage = 28;

  const filteredLogs = MOCK_LOGS.filter(l => {
    if (logFilter !== "all" && l.level !== logFilter) return false;
    if (logSearch && !l.msg.toLowerCase().includes(logSearch.toLowerCase()) && !l.agent.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(q => q.id !== id));
  }

  function toggleSchedule(id: string) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function resolveError(id: string) {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Monitor size={18} className="text-gold" /> Desktop Agent
          </h1>
          <p className="text-xs text-muted mt-0.5">Full agent workspace with live monitoring, scheduling, and marketplace</p>
        </div>
        <button className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Resource Usage Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1"><Cpu size={10} /> CPU</span>
            <span className="text-xs font-mono font-bold text-gold">{cpuUsage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-light">
            <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${cpuUsage}%` }} />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1"><MemoryStick size={10} /> Memory</span>
            <span className="text-xs font-mono font-bold text-blue-400">{memUsage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-light">
            <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${memUsage}%` }} />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1"><HardDrive size={10} /> Disk</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{diskUsage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-light">
            <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${diskUsage}%` }} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ ACTIVITY TAB ═══ */}
      {tab === "Activity" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Zap size={14} className="text-gold" /> Live Agent Activity
            </h2>
            <div className="space-y-2">
              {MOCK_ACTIVITY.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${a.status === "success" ? "bg-emerald-400" : a.status === "warning" ? "bg-amber-400" : "bg-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gold">{a.agent}</span>
                      <span className="text-[9px] text-muted">{a.time}</span>
                    </div>
                    <p className="text-xs text-muted truncate">{a.action}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-mono text-muted">{a.cpu}% CPU</p>
                  </div>
                  <button onClick={() => setOutputPreview(a.action)} className="text-muted hover:text-gold p-1">
                    <Eye size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Output Preview Modal */}
          {outputPreview && (
            <div className="card border-gold/15">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold flex items-center gap-1.5"><Eye size={12} className="text-gold" /> Output Preview</h3>
                <button onClick={() => setOutputPreview(null)} className="text-muted hover:text-foreground text-xs">Close</button>
              </div>
              <div className="bg-surface-light rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted mb-1">Task: {outputPreview}</p>
                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
{`{
  "status": "completed",
  "output": "5 Instagram captions generated",
  "duration_ms": 8200,
  "tokens_used": 1847,
  "cost": "$0.003"
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Manual Agent Trigger */}
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Play size={14} className="text-gold" /> Manual Agent Trigger
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select value={triggerAgent} onChange={e => setTriggerAgent(e.target.value)}
                className="bg-surface-light border border-border rounded-lg px-3 py-2 text-xs outline-none">
                <option value="">Select Agent...</option>
                <option value="lead-finder">Lead Finder</option>
                <option value="outreach">Outreach Bot</option>
                <option value="content">Content Engine</option>
                <option value="seo">SEO Agent</option>
                <option value="retention">Retention Agent</option>
              </select>
              <input value={triggerTask} onChange={e => setTriggerTask(e.target.value)}
                placeholder="Task description..."
                className="bg-surface-light border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-gold/30" />
            </div>
            <button disabled={!triggerAgent}
              className="bg-gold text-black text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <Play size={11} /> Run Now
            </button>
          </div>

          {/* Quick Tasks */}
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Zap size={14} className="text-gold" /> Quick Tasks
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_TASKS.map((qt, i) => (
                <button key={i}
                  className="bg-surface-light border border-border rounded-xl p-3 text-left hover:border-gold/30 transition-all group">
                  <p className="text-xs font-semibold group-hover:text-gold transition-colors">{qt.title}</p>
                  <p className="text-[9px] text-muted mt-1 line-clamp-2">{qt.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ QUEUE TAB ═══ */}
      {tab === "Queue" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gold" /> Task Queue ({queue.length})
          </h2>
          <div className="space-y-2">
            {queue.map(q => (
              <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                q.status === "running" ? "bg-gold/5 border-gold/15" : q.status === "done" ? "bg-emerald-500/5 border-emerald-500/10" : "bg-surface-light border-border"
              }`}>
                {q.status === "running" ? <RefreshCw size={12} className="text-gold animate-spin shrink-0" /> :
                 q.status === "done" ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> :
                 <Clock size={12} className="text-muted shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{q.title}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      q.priority === "high" ? "bg-red-500/10 text-red-400" : q.priority === "medium" ? "bg-gold/10 text-gold" : "bg-muted/10 text-muted"
                    }`}>{q.priority}</span>
                  </div>
                  <p className="text-[10px] text-muted">{q.agent} &middot; ETA: {q.eta}</p>
                </div>
                {q.status !== "done" && (
                  <button onClick={() => removeFromQueue(q.id)} className="text-muted hover:text-red-400 p-1">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LOGS TAB ═══ */}
      {tab === "Logs" && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Terminal size={14} className="text-gold" /> Agent Logs
            </h2>
            <button className="btn-secondary text-[10px] flex items-center gap-1"><Download size={10} /> Export</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1">
              {(["all", "info", "warn", "error", "success"] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`text-[9px] px-2 py-1 rounded capitalize ${
                    logFilter === f ? "bg-gold/15 text-gold" : "text-muted hover:text-foreground"
                  }`}>{f}</button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
                placeholder="Filter logs..." className="w-full bg-surface-light border border-border rounded-lg pl-7 pr-3 py-1.5 text-[10px] outline-none" />
            </div>
          </div>
          <div className="bg-black/40 rounded-lg p-3 max-h-[400px] overflow-y-auto font-mono text-[10px] space-y-0.5">
            {filteredLogs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted/60 shrink-0">{l.ts}</span>
                <span className={`shrink-0 w-12 ${
                  l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : l.level === "success" ? "text-emerald-400" : "text-blue-400"
                }`}>[{l.level.toUpperCase()}]</span>
                <span className="text-gold/70 shrink-0">{l.agent}</span>
                <span className="text-foreground/80">{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ERRORS TAB ═══ */}
      {tab === "Errors" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <ShieldAlert size={14} className="text-red-400" /> Error Recovery ({errors.filter(e => !e.resolved).length} unresolved)
          </h2>
          <div className="space-y-2">
            {errors.map(e => (
              <div key={e.id} className={`p-3 rounded-xl border ${e.resolved ? "border-emerald-500/10 bg-emerald-500/5" : "border-red-500/15 bg-red-500/5"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{e.agent}</span>
                      <span className="text-[9px] text-muted">{e.time}</span>
                      {e.resolved && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">Resolved</span>}
                    </div>
                    <p className="text-[10px] text-red-400">{e.error}</p>
                    <p className="text-[9px] text-muted mt-1">Retries: {e.retries}</p>
                  </div>
                  {!e.resolved && (
                    <div className="flex gap-1.5">
                      <button onClick={() => resolveError(e.id)} className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Resolve
                      </button>
                      <button className="text-[10px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20">
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SCHEDULE TAB ═══ */}
      {tab === "Schedule" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-gold" /> Agent Schedules
          </h2>
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <button onClick={() => toggleSchedule(s.id)}
                  className={`w-10 h-5 rounded-full transition-colors shrink-0 ${s.enabled ? "bg-emerald-400" : "bg-surface"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${s.enabled ? "ml-5" : "ml-0.5"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{s.agent}</p>
                  <p className="text-[10px] text-muted">{s.schedule}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gold font-mono">Next: {s.next}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-3 text-xs text-gold flex items-center gap-1 hover:underline">
            <Plus size={12} /> Add Schedule
          </button>
        </div>
      )}

      {/* ═══ MARKETPLACE TAB ═══ */}
      {tab === "Marketplace" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Store size={14} className="text-gold" /> Agent Marketplace
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MOCK_MARKETPLACE.map(m => (
                <div key={m.id} className="p-3 rounded-xl bg-surface-light border border-border hover:border-gold/20 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">{m.name}</p>
                    <span className="text-[9px] text-gold font-medium">{m.rating} ★</span>
                  </div>
                  <p className="text-[10px] text-muted mb-2">{m.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted">{m.installs} installs &middot; {m.author}</span>
                    <button className="text-[10px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20">
                      Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ METRICS TAB ═══ */}
      {tab === "Metrics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MOCK_METRICS.map((m, i) => (
              <div key={i} className="card p-3">
                <p className="text-[10px] text-muted uppercase tracking-wider">{m.label}</p>
                <p className="text-xl font-bold text-foreground mt-1">{m.value}</p>
                <p className={`text-[10px] mt-0.5 ${m.positive ? "text-emerald-400" : "text-red-400"}`}>{m.change}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 size={14} className="text-gold" /> Task Throughput (7 days)</h3>
            <div className="flex items-end gap-1 h-32">
              {[64, 82, 71, 95, 88, 102, 78].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gold/20 rounded-t" style={{ height: `${(v / 110) * 100}%` }}>
                    <div className="w-full h-full bg-gold/60 rounded-t" />
                  </div>
                  <span className="text-[8px] text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONFIG TAB ═══ */}
      {tab === "Config" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Settings size={14} className="text-gold" /> Configuration Editor
          </h2>
          <p className="text-[10px] text-muted mb-3">Edit agent runtime configuration (JSON). Changes apply on next run.</p>
          <textarea value={configJson} onChange={e => setConfigJson(e.target.value)}
            className="w-full bg-black/40 text-emerald-400 font-mono text-[11px] rounded-lg p-4 border border-border outline-none h-48 resize-y" />
          <div className="flex justify-end mt-3">
            <button className="bg-gold text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1.5">
              <CheckCircle size={11} /> Save Config
            </button>
          </div>
        </div>
      )}

      {/* ═══ VERSIONS TAB ═══ */}
      {tab === "Versions" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <History size={14} className="text-gold" /> Version History
          </h2>
          <div className="space-y-2">
            {MOCK_VERSIONS.map((v, i) => (
              <div key={i} className={`p-3 rounded-xl border ${i === 0 ? "border-gold/15 bg-gold/5" : "border-border bg-surface-light"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold font-mono">{v.ver}</span>
                  {i === 0 && <span className="text-[8px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-semibold">CURRENT</span>}
                  <span className="text-[9px] text-muted ml-auto">{v.date}</span>
                </div>
                <p className="text-[10px] text-muted">{v.changes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
