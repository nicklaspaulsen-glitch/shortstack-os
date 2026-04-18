"use client";

import { useState } from "react";
import {
  Monitor, Zap, Plus, RefreshCw, CheckCircle, Clock, Trash2,
  Cpu, MemoryStick, HardDrive,
  Play, Calendar, Eye, ShieldAlert, Store, Settings,
  BarChart3, History, Search, Terminal, Download,
  Copy, Check, Shield,
  FolderOpen, Layers, FileText, Users, Star, MessageSquare,
  Globe, Layout, Sparkles, ArrowRight,
  ChevronDown, ChevronUp, Info
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

/* ── Download Section Feature Data ──────────────────────────── */

const DESKTOP_FEATURES = [
  { icon: <Terminal size={15} />, title: "Shell Commands", desc: "Run any command on the client machine" },
  { icon: <FolderOpen size={15} />, title: "File Management", desc: "Full read, write, copy, move, delete" },
  { icon: <Search size={15} />, title: "Smart Search", desc: "Glob-pattern file search" },
  { icon: <Layers size={15} />, title: "Project Scaffolding", desc: "Scaffold websites, campaigns & more" },
  { icon: <Zap size={15} />, title: "Auto-Organize", desc: "Sort files into categorized folders" },
  { icon: <FileText size={15} />, title: "Batch Rename", desc: "Smart template-based renaming" },
  { icon: <BarChart3 size={15} />, title: "Workspace Stats", desc: "Full audit & file breakdown" },
  { icon: <Download size={15} />, title: "URL Downloads", desc: "Grab assets from any URL" },
  { icon: <HardDrive size={15} />, title: "System Info", desc: "OS, CPU, RAM, disk at a glance" },
];

const EXTENSION_FEATURES = [
  { icon: <Users size={15} />, title: "Competitor Analysis", desc: "Pricing, tech stack & positioning" },
  { icon: <Star size={15} />, title: "Review Responder", desc: "AI responses to reviews" },
  { icon: <MessageSquare size={15} />, title: "Content Creator", desc: "Social, blogs, emails from context" },
  { icon: <Globe size={15} />, title: "SEO Audit", desc: "Meta tags, schema, H1s, speed" },
  { icon: <Search size={15} />, title: "Data Extraction", desc: "Contacts, emails, social links" },
  { icon: <Layout size={15} />, title: "Tech Stack Detect", desc: "30+ technologies identified" },
  { icon: <Sparkles size={15} />, title: "AI Chat Panel", desc: "Side panel with page context" },
  { icon: <FileText size={15} />, title: "Page Summarizer", desc: "Instant key takeaway summaries" },
];

const INSTALL_STEPS_EXTENSION = [
  "Download the extension .zip below",
  "Unzip to a folder on your computer",
  "Go to chrome://extensions in Chrome",
  'Enable "Developer mode" (top-right toggle)',
  'Click "Load unpacked" → select folder',
  "Pin ShortStack to your toolbar",
];

/* ── Monitoring mock data ──────────────────────────────────── */

const MOCK_ACTIVITY: Array<{ id: string; agent: string; action: string; status: string; time: string; cpu: number }> = [];

const MOCK_QUEUE: Array<{ id: string; title: string; priority: "high" | "medium" | "low"; status: "pending" | "running" | "done"; agent: string; eta: string }> = [];

const MOCK_LOGS: Array<{ ts: string; level: string; agent: string; msg: string }> = [];

const MOCK_ERRORS: Array<{ id: string; agent: string; error: string; time: string; retries: number; resolved: boolean }> = [];

const MOCK_MARKETPLACE: Array<{ id: string; name: string; desc: string; author: string; installs: number; rating: number }> = [];

const MOCK_SCHEDULES: Array<{ id: string; agent: string; schedule: string; next: string; enabled: boolean }> = [];

const MOCK_VERSIONS: Array<{ ver: string; date: string; changes: string }> = [];

const MOCK_METRICS: Array<{ label: string; value: string; change: string; positive: boolean }> = [];

const MAIN_TABS = ["Downloads", "Activity", "Queue", "Logs", "Errors", "Schedule", "Marketplace", "Metrics", "Config", "Versions"] as const;
type Tab = typeof MAIN_TABS[number];

const QUICK_TASKS = [
  { title: "Create social media campaign", description: "Scaffold a complete multi-platform social campaign", type: "social-campaign", priority: "medium" as const },
  { title: "Build a landing page", description: "Generate a responsive landing page", type: "website", priority: "medium" as const },
  { title: "Generate content calendar", description: "Create a weekly content calendar", type: "content-calendar", priority: "medium" as const },
  { title: "Create brand kit", description: "Scaffold brand guidelines", type: "brand-kit", priority: "low" as const },
  { title: "Write email sequence", description: "Generate a 5-email drip campaign", type: "email-sequence", priority: "medium" as const },
  { title: "Organize workspace files", description: "Scan and auto-organize workspace files", type: "organize", priority: "low" as const },
];

export default function AgentDesktopPage() {
  const [tab, setTab] = useState<Tab>("Downloads");
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "error" | "success">("all");
  const [logSearch, setLogSearch] = useState("");
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [errors, setErrors] = useState(MOCK_ERRORS);
  const [configJson, setConfigJson] = useState(JSON.stringify({ max_concurrent_tasks: 3, retry_attempts: 3, timeout_seconds: 30, log_level: "info", rate_limit_buffer: 0.8 }, null, 2));
  const [outputPreview, setOutputPreview] = useState<string | null>(null);
  const [triggerAgent, setTriggerAgent] = useState("");
  const [triggerTask, setTriggerTask] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showExtSteps, setShowExtSteps] = useState(false);

  /* resource usage mock */
  const cpuUsage = 42;
  const memUsage = 61;
  const diskUsage = 28;

  const DESKTOP_DOWNLOAD_URL = "/downloads/ShortStack-Agent-Setup.exe";
  const EXTENSION_DOWNLOAD_URL = "/downloads/shortstack-extension.zip";

  function handleCopyCmd() {
    navigator.clipboard.writeText("npx shortstack-agent@latest");
    setCopiedCmd(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCmd(false), 2000);
  }

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
      <PageHero
        icon={<Monitor size={28} />}
        title="Apps & Downloads"
        subtitle="Automate repetitive work on your computer. Safe, watched, auditable."
        gradient="blue"
        actions={
          <button onClick={() => setTab("Activity")} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5">
            <RefreshCw size={12} /> Agent Status
          </button>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MAIN_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>
            {t === "Downloads" && <span className="mr-1">⬇️</span>}
            {t}
          </button>
        ))}
      </div>

      {/* ═══ DOWNLOADS TAB ═══ */}
      {tab === "Downloads" && (
        <div className="space-y-6">
          {/* Two-column download cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ─── Desktop Agent Card ─────────────────────────── */}
            <div className="card overflow-hidden p-0">
              {/* Hero */}
              <div className="bg-gradient-to-br from-gold/10 via-surface to-surface p-5 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-xl flex items-center justify-center">
                    <Monitor size={24} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Desktop Agent</h2>
                    <p className="text-[10px] text-muted">Windows &bull; Electron &bull; v1.0.0</p>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  A local AI agent that runs directly on your computer with full file system access.
                  Create projects, organize assets, run scripts — all via natural language.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-0.5 bg-gold/10 border border-gold/15 rounded-full text-gold text-[9px] font-medium">
                    17 Tools
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/15 rounded-full text-emerald-400 text-[9px] font-medium flex items-center gap-1">
                    <Shield size={9} /> Sandboxed
                  </span>
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/15 rounded-full text-blue-400 text-[9px] font-medium flex items-center gap-1">
                    <Cpu size={9} /> Electron
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="p-5">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DESKTOP_FEATURES.map((f) => (
                    <div key={f.title} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-light hover:bg-surface-light/80 transition-colors">
                      <div className="text-gold mt-0.5 shrink-0">{f.icon}</div>
                      <div>
                        <p className="text-[11px] font-medium">{f.title}</p>
                        <p className="text-[9px] text-muted leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Actions */}
              <div className="p-5 border-t border-border bg-surface/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={DESKTOP_DOWNLOAD_URL}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gold hover:bg-gold/90 text-black font-semibold rounded-xl transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download for Windows
                  </a>
                  <button
                    onClick={handleCopyCmd}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-light hover:bg-surface border border-border text-muted rounded-xl transition-colors text-xs font-mono"
                  >
                    {copiedCmd ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    npx shortstack-agent
                  </button>
                </div>
                <div className="flex items-start gap-2 mt-3 p-2.5 bg-surface-light rounded-lg">
                  <Info size={11} className="text-muted mt-0.5 shrink-0" />
                  <p className="text-[9px] text-muted leading-relaxed">
                    Requires Windows 10+ and Node.js 18+. Creates a <span className="text-foreground/70 font-mono">~/ShortStack-Agent</span> workspace. macOS &amp; Linux coming soon.
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Chrome Extension Card ─────────────────────── */}
            <div className="card overflow-hidden p-0">
              {/* Hero */}
              <div className="bg-gradient-to-br from-blue-500/10 via-surface to-surface p-5 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                    <Globe size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Chrome Extension</h2>
                    <p className="text-[10px] text-muted">Chrome &bull; Manifest V3</p>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  AI-powered browser companion. Analyze competitors, respond to reviews, generate content, audit SEO — all with one click from any page.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/15 rounded-full text-blue-400 text-[9px] font-medium">
                    16 Features
                  </span>
                  <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/15 rounded-full text-purple-400 text-[9px] font-medium flex items-center gap-1">
                    <Layout size={9} /> Side Panel
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/15 rounded-full text-emerald-400 text-[9px] font-medium flex items-center gap-1">
                    <Sparkles size={9} /> AI-Powered
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="p-5">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXTENSION_FEATURES.map((f) => (
                    <div key={f.title} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-light hover:bg-surface-light/80 transition-colors">
                      <div className="text-blue-400 mt-0.5 shrink-0">{f.icon}</div>
                      <div>
                        <p className="text-[11px] font-medium">{f.title}</p>
                        <p className="text-[9px] text-muted leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Install Actions */}
              <div className="p-5 border-t border-border bg-surface/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={EXTENSION_DOWNLOAD_URL}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download Extension
                  </a>
                  <button
                    onClick={() => setShowExtSteps(!showExtSteps)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-light hover:bg-surface border border-border text-muted rounded-xl transition-colors text-xs"
                  >
                    Install Guide
                    {showExtSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Install steps accordion */}
                {showExtSteps && (
                  <div className="mt-3 p-3 bg-surface-light rounded-xl border border-border space-y-2">
                    <h4 className="text-[10px] font-semibold mb-2">Manual Install (Developer Mode)</h4>
                    {INSTALL_STEPS_EXTENSION.map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-400 text-[9px] font-bold">{i + 1}</span>
                        </div>
                        <p className="text-[10px] text-muted leading-relaxed">{step}</p>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 mt-2 p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                      <Info size={10} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-[9px] text-muted leading-relaxed">
                        Chrome Web Store listing coming soon. The extension auto-connects to your ShortStack account.
                      </p>
                    </div>
                  </div>
                )}

                {!showExtSteps && (
                  <div className="flex items-start gap-2 mt-3 p-2.5 bg-surface-light rounded-lg">
                    <Info size={11} className="text-muted mt-0.5 shrink-0" />
                    <p className="text-[9px] text-muted leading-relaxed">
                      Works on Chrome, Edge, Brave, and any Chromium browser. Requires ShortStack OS account.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Better Together CTA */}
          <div className="card bg-gradient-to-r from-gold/5 via-surface to-blue-500/5 border-border p-6">
            <h3 className="text-sm font-bold text-center mb-1">Better Together</h3>
            <p className="text-[10px] text-muted text-center mb-5 max-w-lg mx-auto">
              The Desktop Agent and Chrome Extension create a seamless research-to-execution workflow.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/15 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Globe size={18} className="text-blue-400" />
                </div>
                <h4 className="text-xs font-semibold mb-0.5">Research</h4>
                <p className="text-[9px] text-muted">Analyze competitors, extract data, audit SEO</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-surface-light border border-border rounded-xl flex items-center justify-center mx-auto mb-2">
                  <ArrowRight size={18} className="text-muted" />
                </div>
                <h4 className="text-xs font-semibold mb-0.5">Plan</h4>
                <p className="text-[9px] text-muted">AI generates strategies from your findings</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-gold/10 border border-gold/15 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Monitor size={18} className="text-gold" />
                </div>
                <h4 className="text-xs font-semibold mb-0.5">Execute</h4>
                <p className="text-[9px] text-muted">Desktop Agent builds, scaffolds, organizes</p>
              </div>
            </div>
          </div>

          {/* System Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Desktop Agent Requirements</h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted">OS</span><span>Windows 10 / 11</span></div>
                <div className="flex justify-between"><span className="text-muted">Runtime</span><span>Node.js 18+</span></div>
                <div className="flex justify-between"><span className="text-muted">RAM</span><span>4 GB minimum</span></div>
                <div className="flex justify-between"><span className="text-muted">Disk</span><span>~200 MB + workspace</span></div>
                <div className="flex justify-between"><span className="text-muted">Network</span><span>Internet required for AI</span></div>
              </div>
            </div>
            <div className="card">
              <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">Chrome Extension Requirements</h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted">Browser</span><span>Chrome / Edge / Brave</span></div>
                <div className="flex justify-between"><span className="text-muted">Version</span><span>Chrome 114+</span></div>
                <div className="flex justify-between"><span className="text-muted">Manifest</span><span>V3</span></div>
                <div className="flex justify-between"><span className="text-muted">Permissions</span><span>Active tab, Side panel</span></div>
                <div className="flex justify-between"><span className="text-muted">Account</span><span>ShortStack OS login</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACTIVITY TAB ═══ */}
      {tab === "Activity" && (
        <div className="space-y-4">
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
