"use client";

import { useState } from "react";
import {
  Activity, Search, Download, CheckCircle, AlertTriangle,
  Clock, Settings,
  Shield, Lock, Eye, Database,
  LogIn, Pencil, Trash2,
  Mail, UserPlus, AlertCircle, X, Copy
} from "lucide-react";

type AuditTab = "trail" | "security" | "retention" | "export";
type ActionType = "login" | "create" | "update" | "delete" | "export" | "send" | "config";

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  userAvatar: string;
  action: ActionType;
  resource: string;
  details: string;
  ip: string;
  status: "success" | "failed" | "warning";
  sensitive: boolean;
}

interface SecurityAlert {
  id: string;
  type: "failed_login" | "permission_change" | "data_export" | "suspicious_ip" | "api_key_used";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  user: string;
  timestamp: string;
  resolved: boolean;
}

const ACTION_STYLES: Record<ActionType, { icon: React.ReactNode; label: string; color: string }> = {
  login: { icon: <LogIn size={11} />, label: "Login", color: "text-blue-400" },
  create: { icon: <UserPlus size={11} />, label: "Create", color: "text-emerald-400" },
  update: { icon: <Pencil size={11} />, label: "Update", color: "text-gold" },
  delete: { icon: <Trash2 size={11} />, label: "Delete", color: "text-red-400" },
  export: { icon: <Download size={11} />, label: "Export", color: "text-purple-400" },
  send: { icon: <Mail size={11} />, label: "Send", color: "text-pink-400" },
  config: { icon: <Settings size={11} />, label: "Config Change", color: "text-amber-400" },
};

// TODO: Load from /api/audit-log once backend is wired.
// These start empty; the UI renders an empty state until real entries exist.
const INITIAL_ENTRIES: AuditEntry[] = [];

// TODO: Load from /api/security-alerts once backend is wired.
const INITIAL_ALERTS: SecurityAlert[] = [];

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const ACTION_FILTERS: ActionType[] = ["login", "create", "update", "delete", "export", "send", "config"];

export default function AuditPage() {
  const [tab, setTab] = useState<AuditTab>("trail");
  const [entries] = useState(INITIAL_ENTRIES);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"today" | "7d" | "30d" | "all">("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showSensitiveOnly, setShowSensitiveOnly] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);

  const uniqueUsers = Array.from(new Set(entries.map(e => e.user)));

  const filtered = entries.filter(e => {
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (userFilter !== "all" && e.user !== userFilter) return false;
    if (showSensitiveOnly && !e.sensitive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.user.toLowerCase().includes(q) || e.details.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q);
    }
    if (dateFilter === "today") return e.timestamp.startsWith(new Date().toISOString().slice(0, 10));
    if (dateFilter === "7d") return true;
    return true;
  });

  const stats = {
    total: entries.length,
    success: entries.filter(e => e.status === "success").length,
    failed: entries.filter(e => e.status === "failed").length,
    sensitive: entries.filter(e => e.sensitive).length,
    unresolvedAlerts: alerts.filter(a => !a.resolved).length,
  };

  function exportCSV() {
    const csv = "Timestamp,User,Action,Resource,Details,IP,Status\n" +
      filtered.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.resource}","${e.details}","${e.ip}","${e.status}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const TABS: { id: AuditTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "trail", label: "Audit Trail", icon: <Activity size={13} /> },
    { id: "security", label: "Security Alerts", icon: <Shield size={13} />, badge: stats.unresolvedAlerts },
    { id: "retention", label: "Retention", icon: <Clock size={13} /> },
    { id: "export", label: "Export", icon: <Download size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Activity size={18} className="text-gold" /> Audit Log
          </h1>
          <p className="text-xs text-muted mt-0.5">Comprehensive log of all user actions in the system</p>
        </div>
        <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Total Actions</p>
          <p className="text-xl font-bold text-gold">{stats.total}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Success Rate</p>
          <p className="text-xl font-bold text-emerald-400">{stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Failures</p>
          <p className={`text-xl font-bold ${stats.failed > 0 ? "text-red-400" : "text-emerald-400"}`}>{stats.failed}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Sensitive</p>
          <p className="text-xl font-bold text-amber-400">{stats.sensitive}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Alerts</p>
          <p className={`text-xl font-bold ${stats.unresolvedAlerts > 0 ? "text-red-400" : "text-emerald-400"}`}>{stats.unresolvedAlerts}</p>
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
            {t.badge !== undefined && t.badge > 0 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ AUDIT TRAIL TAB ═══ */}
      {tab === "trail" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search actions, users, resources..." className="input w-full pl-7 text-xs py-1.5" />
            </div>

            {/* Action type filter */}
            <div className="flex gap-1 bg-surface rounded-lg p-0.5">
              <button onClick={() => setActionFilter("all")} className={`px-2 py-1 rounded-md text-[9px] font-medium ${actionFilter === "all" ? "bg-gold/20 text-gold" : "text-muted"}`}>All</button>
              {ACTION_FILTERS.map(af => (
                <button key={af} onClick={() => setActionFilter(af)}
                  className={`px-2 py-1 rounded-md text-[9px] font-medium capitalize ${actionFilter === af ? "bg-gold/20 text-gold" : "text-muted"}`}>
                  {ACTION_STYLES[af].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* User filter */}
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="input text-xs py-1.5">
              <option value="all">All Users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            {/* Date filter */}
            <div className="flex gap-1">
              {([["today", "Today"], ["7d", "7 Days"], ["30d", "30 Days"], ["all", "All"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setDateFilter(val)}
                  className={`px-2 py-1 rounded text-[9px] ${dateFilter === val ? "bg-gold/20 text-gold" : "text-muted"}`}>{label}</button>
              ))}
            </div>

            {/* Sensitive toggle */}
            <button onClick={() => setShowSensitiveOnly(!showSensitiveOnly)}
              className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${showSensitiveOnly ? "bg-amber-400/15 text-amber-400" : "text-muted"}`}>
              <Lock size={9} /> Sensitive Only
            </button>

            <span className="text-[9px] text-muted ml-auto">{filtered.length} entries</span>
          </div>

          {/* Audit Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">Timestamp</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">User</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">Action</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">Resource</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px] hidden lg:table-cell">Details</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px] hidden md:table-cell">IP</th>
                  <th className="text-center py-2.5 px-3 text-muted font-semibold text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12">
                    <Activity size={28} className="mx-auto mb-2 text-muted/30" />
                    <p className="text-sm text-muted">No audit entries match your filters.</p>
                  </td></tr>
                )}
                {filtered.map(entry => {
                  const style = ACTION_STYLES[entry.action];
                  return (
                    <tr key={entry.id}
                      className="border-b border-border/30 hover:bg-surface-light/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-mono text-muted">{entry.timestamp}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-gold/10 flex items-center justify-center text-[8px] font-bold text-gold shrink-0">{entry.userAvatar}</div>
                          <span className="text-[10px] font-medium truncate">{entry.user}</span>
                          {entry.sensitive && <Lock size={8} className="text-amber-400 shrink-0" />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${style.color}`}>
                          {style.icon} {style.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[10px] font-medium">{entry.resource}</td>
                      <td className="py-2.5 px-3 text-[10px] text-muted truncate max-w-[200px] hidden lg:table-cell">{entry.details}</td>
                      <td className="py-2.5 px-3 text-[10px] font-mono text-muted hidden md:table-cell">{entry.ip}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                          entry.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                          entry.status === "failed" ? "bg-red-500/10 text-red-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>
                          {entry.status === "success" ? <CheckCircle size={8} /> : entry.status === "failed" ? <AlertTriangle size={8} /> : <Clock size={8} />}
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Detail */}
          {expandedEntry && (() => {
            const e = entries.find(en => en.id === expandedEntry);
            if (!e) return null;
            const style = ACTION_STYLES[e.action];
            return (
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold flex items-center gap-2">
                    <span className={style.color}>{style.icon}</span> Action Details
                  </h3>
                  <button
                    onClick={() => setExpandedEntry(null)}
                    aria-label="Close detail"
                    className="text-muted hover:text-foreground"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <p className="text-[8px] text-muted uppercase">Timestamp</p>
                    <p className="text-[10px] font-mono mt-0.5">{e.timestamp}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <p className="text-[8px] text-muted uppercase">User</p>
                    <p className="text-[10px] font-medium mt-0.5">{e.user}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <p className="text-[8px] text-muted uppercase">Action</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${style.color}`}>{style.label}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <p className="text-[8px] text-muted uppercase">IP Address</p>
                    <p className="text-[10px] font-mono mt-0.5">{e.ip}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-[8px] text-muted uppercase mb-1">Full Details</p>
                  <p className="text-[10px]">{e.details}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-[8px] text-muted uppercase mb-1">Resource</p>
                  <p className="text-[10px] font-medium">{e.resource}</p>
                </div>
                {e.sensitive && (
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-center gap-2">
                    <Lock size={11} className="text-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-400">This action involved sensitive data or configuration changes.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ SECURITY ALERTS TAB ═══ */}
      {tab === "security" && (
        <div className="space-y-4">
          {/* Unresolved alerts */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Shield size={13} className="text-red-400" /> Unresolved Alerts</h2>
            <div className="space-y-2">
              {alerts.filter(a => !a.resolved).length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-xs text-muted">All alerts resolved. System secure.</p>
                </div>
              )}
              {alerts.filter(a => !a.resolved).map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg border ${SEVERITY_STYLES[alert.severity]}`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] uppercase font-bold">{alert.severity}</span>
                        <span className="text-[9px] opacity-60">{alert.timestamp}</span>
                      </div>
                      <p className="text-[11px] font-medium">{alert.message}</p>
                      <p className="text-[9px] opacity-60 mt-0.5">User: {alert.user}</p>
                    </div>
                    <button
                      onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, resolved: true } : a))}
                      className="text-[9px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium shrink-0">
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resolved alerts */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><CheckCircle size={13} className="text-emerald-400" /> Resolved Alerts</h2>
            <div className="space-y-2">
              {alerts.filter(a => a.resolved).map(alert => (
                <div key={alert.id} className="p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium">{alert.message}</p>
                      <p className="text-[9px] text-muted">{alert.timestamp} &middot; {alert.user}</p>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[alert.severity]}`}>{alert.severity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Overview — computed from real entries */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Eye size={13} className="text-gold" /> Security Overview</h2>
            {(() => {
              const sevenDaysAgo = Date.now() - 7 * 86400000;
              const recent = entries.filter(e => new Date(e.timestamp).getTime() >= sevenDaysAgo);
              const failedLogins = recent.filter(e => e.action === "login" && e.status === "failed").length;
              const configChanges = recent.filter(e => e.action === "config").length;
              const dataExports = recent.filter(e => e.action === "export").length;
              const uniqueIps = new Set(recent.map(e => e.ip).filter(Boolean)).size;
              const isEmpty = recent.length === 0;
              if (isEmpty) {
                return (
                  <div className="py-8 text-center text-xs text-muted">
                    <Shield size={20} className="mx-auto mb-2 text-muted/40" />
                    No security events recorded yet. Stats will populate as your team uses the platform.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg bg-surface-light border border-border text-center">
                    <p className="text-[9px] text-muted uppercase">Failed Logins (7d)</p>
                    <p className="text-lg font-bold text-red-400">{failedLogins}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light border border-border text-center">
                    <p className="text-[9px] text-muted uppercase">Config Changes (7d)</p>
                    <p className="text-lg font-bold text-amber-400">{configChanges}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light border border-border text-center">
                    <p className="text-[9px] text-muted uppercase">Data Exports (7d)</p>
                    <p className="text-lg font-bold text-purple-400">{dataExports}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-light border border-border text-center">
                    <p className="text-[9px] text-muted uppercase">Unique IPs (7d)</p>
                    <p className="text-lg font-bold text-blue-400">{uniqueIps}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ RETENTION TAB ═══ */}
      {tab === "retention" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-gold" /> Retention Policy</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">Retention Period (days)</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                    className="input w-32 text-xs" min={30} max={365} />
                  <div className="flex gap-1">
                    {[30, 60, 90, 180, 365].map(d => (
                      <button key={d} onClick={() => setRetentionDays(d)}
                        className={`px-2 py-1 rounded text-[9px] ${retentionDays === d ? "bg-gold/20 text-gold" : "text-muted hover:text-foreground"}`}>{d}d</button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted">Audit logs older than {retentionDays} days will be automatically archived and removed from the active view.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                <div className="p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-[9px] text-muted uppercase">Active Entries</p>
                  <p className="text-lg font-bold text-gold mt-0.5">{entries.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-[9px] text-muted uppercase">Storage Used</p>
                  {/* Rough estimate: ~200 bytes/entry; exact size comes from backend once wired. */}
                  <p className="text-lg font-bold text-blue-400 mt-0.5">
                    {entries.length > 0 ? `${(entries.length * 0.2).toFixed(1)} KB` : "0 KB"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-[9px] text-muted uppercase">Archived</p>
                  <p className="text-lg font-bold text-muted mt-0.5">0</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Database size={13} className="text-purple-400" /> Data Lifecycle</h2>
            <div className="space-y-2">
              {[
                { stage: "Active", desc: `0 - ${retentionDays} days`, status: "Current data, fully searchable", color: "text-emerald-400" },
                { stage: "Archived", desc: `${retentionDays} - ${retentionDays * 2} days`, status: "Compressed storage, on-demand access", color: "text-amber-400" },
                { stage: "Deleted", desc: `After ${retentionDays * 2} days`, status: "Permanently removed", color: "text-red-400" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <div className={`w-2 h-2 rounded-full ${item.color === "text-emerald-400" ? "bg-emerald-400" : item.color === "text-amber-400" ? "bg-amber-400" : "bg-red-400"}`} />
                  <div className="flex-1">
                    <p className={`text-[10px] font-semibold ${item.color}`}>{item.stage}</p>
                    <p className="text-[9px] text-muted">{item.desc}</p>
                  </div>
                  <span className="text-[9px] text-muted">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXPORT TAB ═══ */}
      {tab === "export" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Download size={13} className="text-gold" /> Export Audit Report</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">Start Date</label>
                <input type="date" className="input w-full text-xs" />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">End Date</label>
                <input type="date" className="input w-full text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">Format</label>
                <select className="input w-full text-xs">
                  <option>CSV</option>
                  <option>JSON</option>
                  <option>PDF Report</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">Filter by Action</label>
                <select className="input w-full text-xs">
                  <option>All Actions</option>
                  {ACTION_FILTERS.map(af => <option key={af} value={af}>{ACTION_STYLES[af].label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block font-semibold">Filter by User</label>
              <select className="input w-full text-xs">
                <option>All Users</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="p-3 rounded-lg bg-surface-light border border-border text-[10px] text-muted">
              Estimated export size: <span className="font-bold text-gold">{filtered.length} entries</span> ({(filtered.length * 0.2).toFixed(1)} KB)
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
              <button
                onClick={async () => {
                  const csv = "Timestamp,User,Action,Resource,Details,IP,Status\n" +
                    filtered.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.resource}","${e.details}","${e.ip}","${e.status}"`).join("\n");
                  try {
                    await navigator.clipboard.writeText(csv);
                  } catch (err) {
                    console.error("Copy to clipboard failed:", err);
                  }
                }}
                className="btn-secondary text-xs flex items-center gap-1.5"><Copy size={12} /> Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
