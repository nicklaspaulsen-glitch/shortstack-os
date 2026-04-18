"use client";

import { useState } from "react";
import {
  Activity, Search, Zap, Users, Mail, Globe, Bot,
  CreditCard, BarChart3, Shield, Download,
  AlertTriangle, Eye, Key,
  Settings, ChevronRight,
  ClipboardList,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

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
  outreach: { icon: <Mail size={12} />, color: "text-blue-400", label: "Outreach" },
  content: { icon: <Globe size={12} />, color: "text-purple-400", label: "Content" },
  automation: { icon: <Bot size={12} />, color: "text-gold", label: "Automation" },
  billing: { icon: <CreditCard size={12} />, color: "text-green-400", label: "Billing" },
  user: { icon: <Users size={12} />, color: "text-cyan-400", label: "User" },
  system: { icon: <Settings size={12} />, color: "text-gray-400", label: "System" },
  login: { icon: <Key size={12} />, color: "text-yellow-400", label: "Login" },
  api: { icon: <Globe size={12} />, color: "text-indigo-400", label: "API" },
};

const MOCK_LOGS: LogEntry[] = [];

const USERS = ["All"];

export default function ActivityLogPage() {
  const [tab, setTab] = useState<ActivityTab>("feed");
  const [logs] = useState(MOCK_LOGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

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

  // Suspicious activity
  const suspicious = logs.filter(l => l.action === "failed_login" || (l.type === "login" && l.ip === "195.22.44.88"));

  const TABS: { id: ActivityTab; label: string; icon: React.ReactNode }[] = [
    { id: "feed", label: "Activity Feed", icon: <Activity size={13} /> },
    { id: "heatmap", label: "Heatmap", icon: <BarChart3 size={13} /> },
    { id: "users", label: "By User", icon: <Users size={13} /> },
    { id: "audit", label: "Audit Trail", icon: <Eye size={13} /> },
    { id: "security", label: "Security", icon: <Shield size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<ClipboardList size={28} />}
        title="Activity Log"
        subtitle={`${logs.length} events across your agency.`}
        gradient="purple"
        actions={
          <>
            <button onClick={() => setIsLive(!isLive)} className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border ${isLive ? "border-white/30 bg-white/15 text-white" : "border-white/20 bg-white/10 text-white/70"}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-300 animate-pulse" : "bg-white/40"}`} />
              {isLive ? "Live" : "Paused"}
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5"><Download size={12} /> Export Log</button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{logs.length}</p>
          <p className="text-[10px] text-muted">Total Events</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{logs.filter(l => l.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length}</p>
          <p className="text-[10px] text-muted">Today</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{Object.keys(userActivity).filter(u => u !== "System" && u !== "API").length}</p>
          <p className="text-[10px] text-muted">Active Users</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-purple-400">{logs.filter(l => l.type === "automation").length}</p>
          <p className="text-[10px] text-muted">Automations</p>
        </div>
        <div className="card p-3 text-center">
          <p className={`text-lg font-bold ${suspicious.length > 0 ? "text-red-400" : "text-emerald-400"}`}>{suspicious.length}</p>
          <p className="text-[10px] text-muted">Suspicious</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Feed Tab */}
      {tab === "feed" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
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
            {filtered.length === 0 ? (
              <div className="card text-center py-12"><Activity size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No activity found</p></div>
            ) : (
              filtered.map(log => {
                const config = TYPE_CONFIG[log.type] || { icon: <Activity size={12} />, color: "text-muted", label: log.type };
                return (
                  <div key={log.id} className="group">
                    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.01] transition-colors border-b border-border cursor-pointer"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                      <div className={`mt-0.5 shrink-0 ${config.color}`}>{config.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] leading-relaxed">
                          <span className="font-semibold">{log.user}</span> {log.details}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded-full ${config.color.replace("text-", "bg-")}/10 ${config.color}`}>{config.label}</span>
                          <span className="text-[7px] text-muted/40">{log.action}</span>
                        </div>
                      </div>
                      <ChevronRight size={10} className={`text-muted/30 transition-transform ${expandedLog === log.id ? "rotate-90" : ""}`} />
                    </div>
                    {/* Audit Detail */}
                    {expandedLog === log.id && (
                      <div className="ml-8 p-3 rounded-lg bg-surface-light border border-border mb-1 text-[10px] space-y-1">
                        <div className="flex gap-4">
                          <span className="text-muted">Entity:</span>
                          <span>{log.entity} ({log.entityId})</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-muted">User:</span>
                          <span>{log.user}</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-muted">IP:</span>
                          <span className="font-mono">{log.ip}</span>
                        </div>
                        {log.beforeValue !== undefined && (
                          <div className="flex gap-4">
                            <span className="text-muted">Before:</span>
                            <span className="text-red-400">{log.beforeValue || "(empty)"}</span>
                          </div>
                        )}
                        {log.afterValue !== undefined && (
                          <div className="flex gap-4">
                            <span className="text-muted">After:</span>
                            <span className="text-emerald-400">{log.afterValue}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Heatmap Tab */}
      {tab === "heatmap" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Activity Heatmap</h2>
          <div className="overflow-x-auto">
            <div className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(24, 1fr)` }}>
              <div />
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="text-center text-[8px] text-muted py-1">{i}:00</div>
              ))}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dayIdx) => (
                <div key={day} className="contents">
                  <div className="text-[9px] text-muted flex items-center">{day}</div>
                  {heatmapData[dayIdx].map((count, hour) => {
                    const intensity = count / maxHeat;
                    return (
                      <div key={hour} className="aspect-square rounded-sm" title={`${day} ${hour}:00 - ${count} events`}
                        style={{ background: count > 0 ? `rgba(201, 168, 76, ${intensity * 0.8 + 0.1})` : "rgba(255,255,255,0.02)" }} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-[9px] text-muted">Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ background: `rgba(201, 168, 76, ${i})` }} />
            ))}
            <span className="text-[9px] text-muted">More</span>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Users size={13} className="text-gold" /> User Activity Breakdown</h2>
          {Object.keys(userActivity).length === 0 ? (
            <div className="text-center py-8"><Users size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No user activity yet</p></div>
          ) : (
          <div className="space-y-2">
            {Object.entries(userActivity).sort((a, b) => b[1] - a[1]).map(([user, count]) => {
              const pct = logs.length > 0 ? (count / logs.length) * 100 : 0;
              const types: Record<string, number> = {};
              logs.filter(l => l.user === user).forEach(l => { types[l.type] = (types[l.type] || 0) + 1; });
              return (
                <div key={user} className="p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold">{user[0]}</div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{user}</p>
                      <p className="text-[10px] text-muted">{count} actions ({pct.toFixed(0)}%)</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden mb-1.5">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
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
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Audit Tab */}
      {tab === "audit" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Eye size={13} className="text-gold" /> Audit Trail (Before/After)</h2>
          {logs.filter(l => l.beforeValue !== undefined || l.afterValue !== undefined).length === 0 ? (
            <div className="text-center py-8"><Eye size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No audit trail entries yet</p></div>
          ) : (
          <div className="space-y-2">
            {logs.filter(l => l.beforeValue !== undefined || l.afterValue !== undefined).map(log => (
              <div key={log.id} className="p-3 rounded-lg bg-surface-light border border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">{log.details}</p>
                  <span className="text-[9px] text-muted">{new Date(log.timestamp).toLocaleString()}</span>
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
                <p className="text-[9px] text-muted mt-1">By {log.user} from {log.ip}</p>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Shield size={13} className="text-red-400" /> Suspicious Activity Alerts</h2>
            {suspicious.length === 0 ? (
              <div className="text-center py-8"><Shield size={24} className="mx-auto text-emerald-400/30 mb-2" /><p className="text-xs text-muted">No suspicious activity detected</p></div>
            ) : (
              <div className="space-y-2">
                {suspicious.map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-400/5 border border-red-400/10">
                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-400">{log.details}</p>
                      <p className="text-[10px] text-muted">IP: {log.ip} - {new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Key size={13} className="text-gold" /> Login History</h2>
            {logs.filter(l => l.type === "login").length === 0 ? (
              <div className="text-center py-8"><Key size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No login history yet</p></div>
            ) : (
              <div className="space-y-2">
                {logs.filter(l => l.type === "login").map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                    <Key size={12} className={log.action === "failed_login" ? "text-red-400" : "text-emerald-400"} />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{log.user} - {log.details}</p>
                      <p className="text-[9px] text-muted">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <span className="text-[9px] font-mono text-muted">{log.ip}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${log.action === "failed_login" ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400"}`}>
                      {log.action === "failed_login" ? "Failed" : "Success"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
