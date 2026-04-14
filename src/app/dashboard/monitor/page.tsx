"use client";

import { useState } from "react";
import {
  Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw, Wifi,
  Activity, Database, HardDrive, Users,
  Zap, Bell, BarChart3, TrendingUp, TrendingDown,
  FileText
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INTEGRATIONS = [
  "GoHighLevel", "PandaDoc", "Google Drive", "Google Places", "Canva",
  "Slack", "Telegram", "TikTok", "Meta/Facebook", "Instagram",
  "LinkedIn", "YouTube", "Google Ads", "TikTok Ads", "Meta Ads",
  "Retell AI", "GoDaddy", "Stripe", "Supabase", "OpenAI",
];

interface HealthEntry {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  uptime: number;
  responseTime: number;
  lastCheck: string;
  error?: string;
}

const MOCK_HEALTH: HealthEntry[] = [
  { name: "GoHighLevel", status: "healthy", uptime: 99.99, responseTime: 124, lastCheck: "2 min ago" },
  { name: "PandaDoc", status: "healthy", uptime: 99.95, responseTime: 203, lastCheck: "2 min ago" },
  { name: "Google Drive", status: "healthy", uptime: 99.99, responseTime: 89, lastCheck: "2 min ago" },
  { name: "Google Places", status: "healthy", uptime: 99.98, responseTime: 156, lastCheck: "2 min ago" },
  { name: "Canva", status: "healthy", uptime: 99.92, responseTime: 312, lastCheck: "2 min ago" },
  { name: "Slack", status: "healthy", uptime: 99.99, responseTime: 67, lastCheck: "2 min ago" },
  { name: "Telegram", status: "healthy", uptime: 99.97, responseTime: 98, lastCheck: "2 min ago" },
  { name: "TikTok", status: "degraded", uptime: 98.5, responseTime: 1240, lastCheck: "2 min ago", error: "High latency" },
  { name: "Meta/Facebook", status: "healthy", uptime: 99.94, responseTime: 178, lastCheck: "2 min ago" },
  { name: "Instagram", status: "healthy", uptime: 99.93, responseTime: 198, lastCheck: "2 min ago" },
  { name: "LinkedIn", status: "healthy", uptime: 99.91, responseTime: 234, lastCheck: "2 min ago" },
  { name: "YouTube", status: "healthy", uptime: 99.96, responseTime: 145, lastCheck: "2 min ago" },
  { name: "Google Ads", status: "healthy", uptime: 99.98, responseTime: 112, lastCheck: "2 min ago" },
  { name: "TikTok Ads", status: "degraded", uptime: 97.8, responseTime: 890, lastCheck: "2 min ago", error: "API rate limited" },
  { name: "Meta Ads", status: "healthy", uptime: 99.95, responseTime: 167, lastCheck: "2 min ago" },
  { name: "Retell AI", status: "healthy", uptime: 99.88, responseTime: 234, lastCheck: "2 min ago" },
  { name: "GoDaddy", status: "down", uptime: 95.2, responseTime: 0, lastCheck: "5 min ago", error: "Connection refused" },
  { name: "Stripe", status: "healthy", uptime: 99.99, responseTime: 78, lastCheck: "2 min ago" },
  { name: "Supabase", status: "healthy", uptime: 99.99, responseTime: 45, lastCheck: "2 min ago" },
  { name: "OpenAI", status: "healthy", uptime: 99.97, responseTime: 342, lastCheck: "2 min ago" },
];

const MOCK_ALERTS: Array<{ id: string; type: "error" | "warning" | "info"; title: string; message: string; time: string; resolved: boolean }> = [
  { id: "al1", type: "error", title: "GoDaddy DNS API Down", message: "Connection refused for 10 min. Domain operations paused.", time: "5 min ago", resolved: false },
  { id: "al2", type: "warning", title: "TikTok API High Latency", message: "Response times over 1200ms. Rate limiting in effect.", time: "15 min ago", resolved: false },
  { id: "al3", type: "warning", title: "TikTok Ads Rate Limited", message: "API returning 429 errors intermittently.", time: "20 min ago", resolved: false },
  { id: "al4", type: "info", title: "Daily backup completed", message: "Database backup successful. Size: 2.4GB.", time: "2h ago", resolved: true },
  { id: "al5", type: "error", title: "OpenAI spike resolved", message: "GPT-4 latency returned to normal levels.", time: "4h ago", resolved: true },
];

const MOCK_JOBS = [
  { name: "Lead scraping cron", status: "idle", lastRun: "09:00 AM", next: "09:00 AM tomorrow", duration: "4m 32s" },
  { name: "Outreach email cron", status: "running", lastRun: "Running now", next: "--", duration: "~8m" },
  { name: "Content generation", status: "idle", lastRun: "Mon 08:00", next: "Mon 08:00", duration: "12m 15s" },
  { name: "Health check", status: "idle", lastRun: "2 min ago", next: "In 28 min", duration: "45s" },
  { name: "Invoice chase", status: "idle", lastRun: "Apr 1 09:00", next: "May 1 09:00", duration: "2m 10s" },
  { name: "Database backup", status: "idle", lastRun: "03:00 AM", next: "03:00 AM tomorrow", duration: "5m 48s" },
];

const TABS = ["Health", "API Usage", "Alerts", "Jobs", "Cost", "Daily Digest"] as const;
type Tab = typeof TABS[number];

const LATENCY_HOURS = [45, 52, 48, 67, 55, 78, 62, 89, 124, 98, 76, 58, 52, 48, 56, 62, 71, 85, 92, 78, 65, 54, 48, 42];

export default function MonitorPage() {
  const [tab, setTab] = useState<Tab>("Health");
  const [health] = useState<HealthEntry[]>(MOCK_HEALTH);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "degraded" | "down">("all");

  const healthy = health.filter(h => h.status === "healthy").length;
  const degraded = health.filter(h => h.status === "degraded").length;
  const down = health.filter(h => h.status === "down").length;
  const avgResponseTime = Math.round(health.filter(h => h.responseTime > 0).reduce((s, h) => s + h.responseTime, 0) / health.filter(h => h.responseTime > 0).length);

  const filteredHealth = statusFilter === "all" ? health : health.filter(h => h.status === statusFilter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle size={14} className="text-emerald-400" />;
      case "degraded": return <AlertTriangle size={14} className="text-amber-400" />;
      case "down": return <XCircle size={14} className="text-red-400" />;
      default: return <Wifi size={14} className="text-muted" />;
    }
  };

  function resolveAlert(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Shield size={18} className="text-gold" /> System Monitor
          </h1>
          <p className="text-muted text-xs mt-0.5">Real-time system health, API usage, costs & performance</p>
        </div>
        <button className="btn-secondary flex items-center gap-2 text-xs">
          <RefreshCw size={14} /> Run Check
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted uppercase">Healthy</p>
          <p className="text-xl font-bold text-emerald-400">{healthy}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted uppercase">Degraded</p>
          <p className={`text-xl font-bold ${degraded > 0 ? "text-amber-400" : "text-emerald-400"}`}>{degraded}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted uppercase">Down</p>
          <p className={`text-xl font-bold ${down > 0 ? "text-red-400" : "text-emerald-400"}`}>{down}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted uppercase">Avg Latency</p>
          <p className="text-xl font-bold text-foreground">{avgResponseTime}ms</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[10px] text-muted uppercase">Active Users</p>
          <p className="text-xl font-bold text-gold">24</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ HEALTH TAB ═══ */}
      {tab === "Health" && (
        <div className="space-y-4">
          <div className="flex gap-1">
            {(["all", "healthy", "degraded", "down"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`text-[9px] px-2 py-1 rounded capitalize ${statusFilter === f ? "bg-gold/15 text-gold" : "text-muted"}`}>
                {f} ({f === "all" ? health.length : health.filter(h => h.status === f).length})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredHealth.map(entry => (
              <div key={entry.name} className={`card p-3 flex items-center gap-2.5 ${
                entry.status === "down" ? "border-red-500/20" : entry.status === "degraded" ? "border-amber-500/20" : ""
              }`}>
                {getStatusIcon(entry.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">{entry.name}</p>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className={`capitalize ${entry.status === "healthy" ? "text-emerald-400" : entry.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                      {entry.status}
                    </span>
                    {entry.responseTime > 0 && <span className="text-muted font-mono">{entry.responseTime}ms</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-mono font-medium ${entry.uptime >= 99 ? "text-emerald-400" : entry.uptime >= 95 ? "text-amber-400" : "text-red-400"}`}>
                    {entry.uptime}%
                  </p>
                  <p className="text-[8px] text-muted">{entry.lastCheck}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Latency Heatmap */}
          <div className="card">
            <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><BarChart3 size={12} className="text-gold" /> Latency Heatmap (24h)</h3>
            <div className="flex items-end gap-0.5 h-20">
              {LATENCY_HOURS.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className={`w-full rounded-sm ${v < 60 ? "bg-emerald-400/60" : v < 100 ? "bg-gold/60" : v < 200 ? "bg-amber-400/60" : "bg-red-400/60"}`}
                    style={{ height: `${Math.min((v / 130) * 100, 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[8px] text-muted mt-1">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ API USAGE TAB ═══ */}
      {tab === "API Usage" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Requests Today</p>
              <p className="text-xl font-bold text-gold">8,432</p>
              <p className="text-[9px] text-emerald-400 flex items-center justify-center gap-0.5"><TrendingUp size={9} /> +12%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Errors Today</p>
              <p className="text-xl font-bold text-red-400">23</p>
              <p className="text-[9px] text-emerald-400 flex items-center justify-center gap-0.5"><TrendingDown size={9} /> -8%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Error Rate</p>
              <p className="text-xl font-bold text-foreground">0.27%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Avg Response</p>
              <p className="text-xl font-bold text-foreground">186ms</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold mb-3">API Calls by Service</h3>
            <div className="space-y-2">
              {[
                { name: "OpenAI (GPT-4)", calls: 3240, pct: 38 },
                { name: "Supabase", calls: 2180, pct: 26 },
                { name: "ElevenLabs", calls: 890, pct: 11 },
                { name: "GoHighLevel", calls: 720, pct: 9 },
                { name: "Meta API", calls: 560, pct: 7 },
                { name: "Google APIs", calls: 440, pct: 5 },
                { name: "Stripe", calls: 210, pct: 2 },
                { name: "Other", calls: 192, pct: 2 },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-[10px] w-32 shrink-0">{s.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-light">
                    <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted w-14 text-right">{s.calls.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Database & Storage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Database size={12} className="text-gold" />
                <span className="text-xs font-bold">Database</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Size</span>
                  <span className="font-mono">2.4 GB / 8 GB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-light">
                  <div className="h-2 rounded-full bg-gold" style={{ width: "30%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Rows</span>
                  <span className="font-mono">847,231</span>
                </div>
              </div>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={12} className="text-gold" />
                <span className="text-xs font-bold">Storage</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Used</span>
                  <span className="font-mono">12.8 GB / 50 GB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-light">
                  <div className="h-2 rounded-full bg-blue-400" style={{ width: "25.6%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Files</span>
                  <span className="font-mono">3,412</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {tab === "Alerts" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Bell size={14} className="text-gold" /> Performance Alerts ({alerts.filter(a => !a.resolved).length} active)
          </h2>
          {alerts.map(a => (
            <div key={a.id} className={`p-3 rounded-xl border ${
              a.resolved ? "border-border bg-surface-light opacity-60" :
              a.type === "error" ? "border-red-500/15 bg-red-500/5" :
              a.type === "warning" ? "border-amber-500/15 bg-amber-500/5" :
              "border-blue-500/15 bg-blue-500/5"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {a.type === "error" ? <XCircle size={14} className="text-red-400 mt-0.5" /> :
                   a.type === "warning" ? <AlertTriangle size={14} className="text-amber-400 mt-0.5" /> :
                   <CheckCircle size={14} className="text-blue-400 mt-0.5" />}
                  <div>
                    <p className="text-xs font-semibold">{a.title}</p>
                    <p className="text-[10px] text-muted mt-0.5">{a.message}</p>
                    <p className="text-[9px] text-muted/60 mt-1">{a.time}</p>
                  </div>
                </div>
                {!a.resolved && (
                  <button onClick={() => resolveAlert(a.id)} className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ JOBS TAB ═══ */}
      {tab === "Jobs" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Zap size={14} className="text-gold" /> Background Jobs
          </h2>
          <div className="space-y-2">
            {MOCK_JOBS.map((j, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <div className={`w-2 h-2 rounded-full shrink-0 ${j.status === "running" ? "bg-blue-400 animate-pulse" : "bg-muted"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{j.name}</p>
                  <p className="text-[9px] text-muted">Last: {j.lastRun} &middot; Duration: {j.duration}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-medium text-gold">{j.next}</p>
                  <p className={`text-[9px] capitalize ${j.status === "running" ? "text-blue-400" : "text-muted"}`}>{j.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COST TAB ═══ */}
      {tab === "Cost" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Today</p>
              <p className="text-xl font-bold text-gold">$4.82</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">This Week</p>
              <p className="text-xl font-bold text-foreground">$28.45</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">This Month</p>
              <p className="text-xl font-bold text-foreground">$142.80</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Projected</p>
              <p className="text-xl font-bold text-foreground">$178.50</p>
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Cost Breakdown by Service</h3>
            <div className="space-y-2">
              {[
                { name: "OpenAI API", cost: 82.40, pct: 58 },
                { name: "ElevenLabs", cost: 24.50, pct: 17 },
                { name: "Supabase", cost: 25.00, pct: 18 },
                { name: "Vercel", cost: 6.20, pct: 4 },
                { name: "Twilio", cost: 4.70, pct: 3 },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-[10px] w-24 shrink-0">{s.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-light">
                    <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-gold w-16 text-right">${s.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DAILY DIGEST TAB ═══ */}
      {tab === "Daily Digest" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <FileText size={14} className="text-gold" /> Daily Digest &middot; {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/5 rounded-xl p-3 text-center border border-emerald-500/10">
                <p className="text-xl font-bold text-emerald-400">48</p>
                <p className="text-[9px] text-muted">Leads Scraped</p>
              </div>
              <div className="bg-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                <p className="text-xl font-bold text-blue-400">12</p>
                <p className="text-[9px] text-muted">DMs Sent</p>
              </div>
              <div className="bg-gold/5 rounded-xl p-3 text-center border border-gold/10">
                <p className="text-xl font-bold text-gold">3</p>
                <p className="text-[9px] text-muted">Replies Received</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                <CheckCircle size={10} className="text-emerald-400" />
                <span>All 20 integrations checked &mdash; 18 healthy, 2 degraded, 1 down</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                <CheckCircle size={10} className="text-emerald-400" />
                <span>Database backup completed at 03:00 AM (2.4 GB)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                <AlertTriangle size={10} className="text-amber-400" />
                <span>GoDaddy DNS API has been down since 2:45 AM &mdash; no domain operations</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                <Activity size={10} className="text-blue-400" />
                <span>8,432 API calls processed &mdash; $4.82 cost, 0.27% error rate</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                <Users size={10} className="text-gold" />
                <span>24 active users today, 3 new signups</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
