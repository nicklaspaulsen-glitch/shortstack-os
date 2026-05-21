"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Search, Zap, Users, Mail, Globe, Bot,
  CreditCard, BarChart3, Shield, Download,
  AlertTriangle, Eye, Key,
  Settings, ChevronRight,
  ClipboardList, Loader2,
} from "lucide-react";
import { PrismPanel } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

type ActivityTab = "feed" | "heatmap" | "users" | "audit" | "security";

interface LogEntry {
  id: string;
  user: string;
  type: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  beforeValue?: string;
  afterValue?: string;
  timestamp: string;
  ip: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  lead_gen: { icon: <Zap size={12} />, color: "text-emerald-400", label: "Lead Gen" },
  outreach: { icon: <Mail size={12} />, color: "text-brand-accent", label: "Outreach" },
  content: { icon: <Globe size={12} />, color: "text-brand-accent", label: "Content" },
  automation: { icon: <Bot size={12} />, color: "text-brand-accent", label: "Automation" },
  billing: { icon: <CreditCard size={12} />, color: "text-green-400", label: "Billing" },
  user: { icon: <Users size={12} />, color: "text-cyan-400", label: "User" },
  system: { icon: <Settings size={12} />, color: "text-text-muted", label: "System" },
  login: { icon: <Key size={12} />, color: "text-yellow-400", label: "Login" },
  api: { icon: <Globe size={12} />, color: "text-brand-accent", label: "API" },
};

// Map the action_type enum values coming from /api/audit-log onto the
// frontend's icon/color config keys so the feed renders consistently.
const ACTION_TYPE_TO_CATEGORY: Record<string, keyof typeof TYPE_CONFIG> = {
  lead_gen: "lead_gen",
  email_campaign: "outreach",
  sms_campaign: "outreach",
  social_setup: "content",
  website: "content",
  chatbot: "automation",
  ai_receptionist: "automation",
  automation: "automation",
  discord: "system",
  custom: "system",
};

interface AuditApiEntry {
  id: string;
  timestamp: string;
  action: string;
  action_type: string | null;
  description: string;
  resource: string;
  status: string;
  ip: string | null;
  user_agent: string | null;
  sensitive: boolean;
  user_email: string | null;
}

function mapAuditToLog(entry: AuditApiEntry): LogEntry {
  const category = ACTION_TYPE_TO_CATEGORY[entry.action_type ?? ""] ?? "system";
  return {
    id: entry.id,
    user: entry.user_email || "System",
    type: category,
    action: entry.action || entry.action_type || "custom",
    entity: entry.resource || "trinity",
    entityId: entry.id.slice(0, 8),
    details: entry.description,
    timestamp: entry.timestamp,
    ip: entry.ip || "—",
  };
}

export default function ActivityLogPage() {
  const [tab, setTab] = useState<ActivityTab>("feed");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Pull the live feed from /api/audit-log. Refreshes every 20s while "Live"
  // is on — cheap enough to poll given the PK+profile index on trinity_log
  // and the 200-row page cap.
  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/audit-log?page_size=200", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const entries: AuditApiEntry[] = Array.isArray(json.entries) ? json.entries : [];
        setLogs(entries.map(mapAuditToLog));
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLogs();
    if (!isLive) return () => { cancelled = true; };

    const interval = setInterval(fetchLogs, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLive]);

  // Derived user list — always "All" first, then every user we've seen.
  const USERS = ["All", ...Array.from(new Set(logs.map(l => l.user))).filter(u => u !== "All")];

  const types = ["all", ...Object.keys(TYPE_CONFIG)];

  const filtered = logs
    .filter(l => typeFilter === "all" || l.type === typeFilter)
    .filter(l => userFilter === "All" || l.user === userFilter)
    .filter(l => !searchQuery || l.details.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(l => {
      if (dateFilter === "all") return true;
      const logDate = new Date(l.timestamp);
      const today = new Date();
      if (dateFilter === "today") return logDate.toDateString() === today.toDateString();
      if (dateFilter === "week") return (today.getTime() - logDate.getTime()) < 7 * 86400000;
      return true;
    });

  // Heatmap data (hours of day x days of week)
  const heatmapData: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  logs.forEach(l => {
    const d = new Date(l.timestamp);
    const day = d.getDay();
    const hour = d.getHours();
    heatmapData[day][hour]++;
  });
  const maxHeat = Math.max(...heatmapData.flat(), 1);

  // User activity breakdown
  const userActivity: Record<string, number> = {};
  logs.forEach(l => { userActivity[l.user] = (userActivity[l.user] || 0) + 1; });

  // Suspicious activity: any failed_login action.
  // TODO: Wire a proper IP allowlist/blocklist once backend is ready.
  const suspicious = logs.filter(l => l.action === "failed_login");

  const TABS: { id: ActivityTab; label: string; icon: React.ReactNode }[] = [
    { id: "feed", label: "Activity Feed", icon: <Activity size={13} /> },
    { id: "heatmap", label: "Heatmap", icon: <BarChart3 size={13} /> },
    { id: "users", label: "By User", icon: <Users size={13} /> },
    { id: "audit", label: "Audit Trail", icon: <Eye size={13} /> },
    { id: "security", label: "Security", icon: <Shield size={13} /> },
  ];

  return (
    <MotionPage className="space-y-5">{/* -- Activity Log command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Recent Activity</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Activity Log</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <>
                  <button onClick={() => setIsLive(!isLive)} className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border ${isLive ? "border-border-subtle bg-black/10 text-text-primary" : "border-border-subtle bg-black/5 text-text-muted"}`}>
                    <div className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-300 animate-pulse" : "bg-black/20"}`} />
                    {isLive ? "Live" : "Paused"}
                  </button>
                  <button
                    onClick={() => {
                      const csv = "Timestamp,User,Type,Action,Entity,Details,IP\n" +
                        filtered.map(l => `"${l.timestamp}","${l.user}","${l.type}","${l.action}","${l.entity}","${l.details}","${l.ip}"`).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-black/5 border border-border-subtle text-text-primary text-xs font-medium hover:bg-black/10 transition-all flex items-center gap-1.5"><Download size={12} /> Export Log</button>
                </>
      </div>
    </div>{/* Stats */}<div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3 glass rounded-2xl p-5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Events</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{logs.length.toLocaleString()}</p>
                  <p className="text-[11px] text-text-muted mt-1.5">all time activity</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Today</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{logs.filter(l => l.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Active Users</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{Object.keys(userActivity).filter(u => u !== "System" && u !== "API").length}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Suspicious</p>
                <p className={`font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${suspicious.length > 0 ? "text-red-500" : "text-emerald-500"}`}>{suspicious.length}</p>
              </motion.div>
            </div>{/* Tabs */}<div className="flex gap-1 bg-surface rounded-lg p-1 w-fit flex-wrap">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
                    tab === t.id ? "bg-[rgba(59,130,246,0.08)] text-brand-accent font-medium" : "text-text-muted hover:text-text-primary"
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>{/* Feed Tab */}{tab === "feed" && (
              <div className="space-y-3">
                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="input w-full text-xs pl-8" placeholder="Search activity..." />
                  </div>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input text-xs w-32">
                    {types.map(t => <option key={t} value={t}>{t === "all" ? "All Types" : TYPE_CONFIG[t]?.label || t}</option>)}
                  </select>
                  <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="input text-xs w-28">
                    {USERS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input text-xs w-28">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                  </select>
                </div>

                {/* Activity Feed */}
                <div className="space-y-1">
                  {loading ? (
                    <PrismPanel padding="py-12 px-6" className="text-center">
                      <Loader2 size={24} className="mx-auto mb-2 text-text-muted/50 animate-spin" />
                      <p className="text-xs text-text-muted">Loading activity…</p>
                    </PrismPanel>
                  ) : loadError ? (
                    <PrismPanel padding="py-12 px-6" className="text-center">
                      <AlertTriangle size={24} className="mx-auto mb-2 text-red-400/60" />
                      <p className="text-xs text-red-400">Failed to load activity: {loadError}</p>
                    </PrismPanel>
                  ) : filtered.length === 0 ? (
                    <PrismPanel padding="py-12 px-6" className="text-center"><Activity size={24} className="mx-auto mb-2 text-text-muted/30" /><p className="text-xs text-text-muted">No activity found</p></PrismPanel>
                  ) : (
                    filtered.map((log, idx) => {
                      const config = TYPE_CONFIG[log.type] || { icon: <Activity size={12} />, color: "text-text-muted", label: log.type };
                      return (
                        <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="group">
                          <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] transition-colors border-b border-border-subtle cursor-pointer"
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                            <div className={`mt-0.5 shrink-0 ${config.color}`}>{config.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] leading-relaxed">
                                <span className="font-semibold">{log.user}</span> {log.details}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] text-text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                                <span className={`text-[7px] px-1.5 py-0.5 rounded-full ${config.color.replace("text-", "bg-")}/10 ${config.color}`}>{config.label}</span>
                                <span className="text-[7px] text-text-muted/40">{log.action}</span>
                              </div>
                            </div>
                            <ChevronRight size={10} className={`text-text-muted/30 transition-transform ${expandedLog === log.id ? "rotate-90" : ""}`} />
                          </div>
                          {/* Audit Detail */}
                          {expandedLog === log.id && (
                            <div className="ml-8 p-3 rounded-lg bg-surface-light border border-border-subtle mb-1 text-[10px] space-y-1">
                              <div className="flex gap-4">
                                <span className="text-text-muted">Entity:</span>
                                <span>{log.entity} ({log.entityId})</span>
                              </div>
                              <div className="flex gap-4">
                                <span className="text-text-muted">User:</span>
                                <span>{log.user}</span>
                              </div>
                              <div className="flex gap-4">
                                <span className="text-text-muted">IP:</span>
                                <span className="font-mono">{log.ip}</span>
                              </div>
                              {log.beforeValue !== undefined && (
                                <div className="flex gap-4">
                                  <span className="text-text-muted">Before:</span>
                                  <span className="text-red-400">{log.beforeValue || "(empty)"}</span>
                                </div>
                              )}
                              {log.afterValue !== undefined && (
                                <div className="flex gap-4">
                                  <span className="text-text-muted">After:</span>
                                  <span className="text-emerald-400">{log.afterValue}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            )}{/* Heatmap Tab */}{tab === "heatmap" && (
              <PrismPanel padding="p-4">
                <h2 className="flex items-center gap-2"><BarChart3 size={13} className="text-brand-accent" /> Activity Heatmap</h2>
                <div className="overflow-x-auto">
                  <div className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(24, 1fr)` }}>
                    <div />
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="text-center text-[8px] text-text-muted py-1">{i}:00</div>
                    ))}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dayIdx) => (
                      <div key={day} className="contents">
                        <div className="text-[9px] text-text-muted flex items-center">{day}</div>
                        {heatmapData[dayIdx].map((count, hour) => {
                          const intensity = count / maxHeat;
                          return (
                            <div key={hour} className="aspect-square rounded-sm" title={`${day} ${hour}:00 - ${count} events`}
                              style={{ background: count > 0 ? `rgba(201, 168, 76, ${intensity * 0.8 + 0.1})` : "rgba(0,0,0,0.03)" }} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <span className="text-[9px] text-text-muted">Less</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ background: `rgba(201, 168, 76, ${i})` }} />
                  ))}
                  <span className="text-[9px] text-text-muted">More</span>
                </div>
              </PrismPanel>
            )}{/* Users Tab */}{tab === "users" && (
              <PrismPanel padding="p-4">
                <h2 className="flex items-center gap-2"><Users size={13} className="text-brand-accent" /> User Activity Breakdown</h2>
                {Object.keys(userActivity).length === 0 ? (
                  <div className="text-center py-8"><Users size={24} className="mx-auto mb-2 text-text-muted/30" /><p className="text-xs text-text-muted">No user activity yet</p></div>
                ) : (
                <div className="space-y-2">
                  {Object.entries(userActivity).sort((a, b) => b[1] - a[1]).map(([user, count], idx) => {
                    const pct = logs.length > 0 ? (count / logs.length) * 100 : 0;
                    const types: Record<string, number> = {};
                    logs.filter(l => l.user === user).forEach(l => { types[l.type] = (types[l.type] || 0) + 1; });
                    return (
                      <motion.div key={user} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-[rgba(59,130,246,0.08)] flex items-center justify-center text-xs font-bold text-brand-accent">{user[0]}</div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold">{user}</p>
                            <p className="text-[10px] text-text-muted">{count} actions ({pct.toFixed(0)}%)</p>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-surface overflow-hidden mb-1.5">
                          <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(types).map(([type, cnt]) => {
                            const cfg = TYPE_CONFIG[type];
                            return cfg ? (
                              <span key={type} className={`text-[8px] px-1.5 py-0.5 rounded-full ${cfg.color.replace("text-", "bg-")}/10 ${cfg.color}`}>
                                {cfg.label}: {cnt}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                )}
              </PrismPanel>
            )}{/* Audit Tab */}{tab === "audit" && (
              <PrismPanel padding="p-4">
                <h2 className="flex items-center gap-2"><Eye size={13} className="text-brand-accent" /> Audit Trail (Before/After)</h2>
                {logs.filter(l => l.beforeValue !== undefined || l.afterValue !== undefined).length === 0 ? (
                  <div className="text-center py-8"><Eye size={24} className="mx-auto mb-2 text-text-muted/30" /><p className="text-xs text-text-muted">No audit trail entries yet</p></div>
                ) : (
                <div className="space-y-2">
                  {logs.filter(l => l.beforeValue !== undefined || l.afterValue !== undefined).map((log, idx) => (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">{log.details}</p>
                        <span className="text-[9px] text-text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 rounded-lg bg-red-400/5 border border-red-400/10">
                          <p className="text-[9px] text-red-400 font-semibold mb-0.5">Before</p>
                          <p className="text-xs font-mono">{log.beforeValue || "(empty)"}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
                          <p className="text-[9px] text-emerald-400 font-semibold mb-0.5">After</p>
                          <p className="text-xs font-mono">{log.afterValue}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-text-muted mt-1">By {log.user} from {log.ip}</p>
                    </motion.div>
                  ))}
                </div>
                )}
              </PrismPanel>
            )}{/* Security Tab */}{tab === "security" && (
              <div className="space-y-4">
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Shield size={13} className="text-red-400" /> Suspicious Activity Alerts</h2>
                  {suspicious.length === 0 ? (
                    <div className="text-center py-8"><Shield size={24} className="mx-auto text-emerald-400/30 mb-2" /><p className="text-xs text-text-muted">No suspicious activity detected</p></div>
                  ) : (
                    <div className="space-y-2">
                      {suspicious.map(log => (
                        <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-400/5 border border-red-400/10">
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-red-400">{log.details}</p>
                            <p className="text-[10px] text-text-muted">IP: {log.ip} - {new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PrismPanel>
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Key size={13} className="text-brand-accent" /> Login History</h2>
                  {logs.filter(l => l.type === "login").length === 0 ? (
                    <div className="text-center py-8"><Key size={24} className="mx-auto mb-2 text-text-muted/30" /><p className="text-xs text-text-muted">No login history yet</p></div>
                  ) : (
                    <div className="space-y-2">
                      {logs.filter(l => l.type === "login").map((log, idx) => (
                        <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="rounded-xl flex items-center gap-3 p-2.5" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                          <Key size={12} className={log.action === "failed_login" ? "text-red-400" : "text-emerald-400"} />
                          <div className="flex-1">
                            <p className="text-xs font-medium">{log.user} - {log.details}</p>
                            <p className="text-[9px] text-text-muted">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                          <span className="text-[9px] font-mono text-text-muted">{log.ip}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${log.action === "failed_login" ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400"}`}>
                            {log.action === "failed_login" ? "Failed" : "Success"}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </PrismPanel>
              </div>
            )}</MotionPage>
  );
}

