"use client";

import { useState } from "react";
import {
  Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw, Wifi,
  Database, HardDrive,
  Zap, Bell, BarChart3,
  FileText, Activity
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

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

const MOCK_HEALTH: HealthEntry[] = [];

const MOCK_ALERTS: Array<{ id: string; type: "error" | "warning" | "info"; title: string; message: string; time: string; resolved: boolean }> = [];

const MOCK_JOBS: Array<{ name: string; status: string; lastRun: string; next: string; duration: string }> = [];

const TABS = ["Health", "API Usage", "Alerts", "Jobs", "Cost", "Daily Digest"] as const;
type Tab = typeof TABS[number];

const LATENCY_HOURS: number[] = [];

export default function MonitorPage() {
  const [tab, setTab] = useState<Tab>("Health");
  const [health] = useState<HealthEntry[]>(MOCK_HEALTH);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "degraded" | "down">("all");

  const healthy = health.filter(h => h.status === "healthy").length;
  const degraded = health.filter(h => h.status === "degraded").length;
  const down = health.filter(h => h.status === "down").length;
  const healthWithResponse = health.filter(h => h.responseTime > 0);
  const avgResponseTime = healthWithResponse.length > 0 ? Math.round(healthWithResponse.reduce((s, h) => s + h.responseTime, 0) / healthWithResponse.length) : 0;

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
      <PageHero
        icon={<Activity size={28} />}
        title="System Monitor"
        subtitle="Real-time health, API usage & performance."
        gradient="purple"
        actions={
          <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-2">
            <RefreshCw size={14} /> Run Check
          </button>
        }
      />

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
          <p className="text-xl font-bold text-gold">0</p>
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
            {filteredHealth.length === 0 && (
              <div className="col-span-full card text-center py-12">
                <Shield size={28} className="mx-auto mb-2 text-muted/30" />
                <p className="text-sm text-muted">No integrations being monitored yet.</p>
              </div>
            )}
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
            {LATENCY_HOURS.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No latency data yet.</p>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ API USAGE TAB ═══ */}
      {tab === "API Usage" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Requests Today</p>
              <p className="text-xl font-bold text-gold">0</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Errors Today</p>
              <p className="text-xl font-bold text-emerald-400">0</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Error Rate</p>
              <p className="text-xl font-bold text-foreground">0%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Avg Response</p>
              <p className="text-xl font-bold text-foreground">0ms</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold mb-3">API Calls by Service</h3>
            <p className="text-xs text-muted text-center py-6">No API usage data yet.</p>
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
                  <span className="font-mono">0 GB / 8 GB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-light">
                  <div className="h-2 rounded-full bg-gold" style={{ width: "0%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Rows</span>
                  <span className="font-mono">0</span>
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
                  <span className="font-mono">0 GB / 50 GB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-light">
                  <div className="h-2 rounded-full bg-blue-400" style={{ width: "0%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">Files</span>
                  <span className="font-mono">0</span>
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
          {alerts.length === 0 && (
            <p className="text-xs text-muted text-center py-8">No alerts yet.</p>
          )}
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
            {MOCK_JOBS.length === 0 && (
              <p className="text-xs text-muted text-center py-8">No background jobs configured yet.</p>
            )}
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
              <p className="text-xl font-bold text-gold">$0.00</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">This Week</p>
              <p className="text-xl font-bold text-foreground">$0.00</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">This Month</p>
              <p className="text-xl font-bold text-foreground">$0.00</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted uppercase">Projected</p>
              <p className="text-xl font-bold text-foreground">$0.00</p>
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Cost Breakdown by Service</h3>
            <p className="text-xs text-muted text-center py-6">No cost data yet.</p>
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
                <p className="text-xl font-bold text-emerald-400">0</p>
                <p className="text-[9px] text-muted">Leads Scraped</p>
              </div>
              <div className="bg-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                <p className="text-xl font-bold text-blue-400">0</p>
                <p className="text-[9px] text-muted">DMs Sent</p>
              </div>
              <div className="bg-gold/5 rounded-xl p-3 text-center border border-gold/10">
                <p className="text-xl font-bold text-gold">0</p>
                <p className="text-[9px] text-muted">Replies Received</p>
              </div>
            </div>
            <p className="text-xs text-muted text-center py-6">No digest data for today yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
