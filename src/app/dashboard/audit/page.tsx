"use client";

import { CheckCircle, Clock, Copy, Database, DownloadSimple, Envelope, Eye, Gear, Lock, MagnifyingGlass, Pencil, Pulse, Shield, SignIn, Trash, UserPlus, Warning, WarningCircle, X } from "@phosphor-icons/react";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PrismPanel } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

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
  alert_type: "suspicious_login" | "exfil_attempt" | "auth_failure" | "permission_escalation";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<ActionType, { icon: React.ReactNode; label: string; color: string }> = {
  login: { icon: <SignIn size={11} />, label: "Login", color: "text-brand-accent" },
  create: { icon: <UserPlus size={11} />, label: "Create", color: "text-emerald-400" },
  update: { icon: <Pencil size={11} />, label: "Update", color: "text-brand-accent" },
  delete: { icon: <Trash size={11} />, label: "Delete", color: "text-red-400" },
  export: { icon: <DownloadSimple size={11} />, label: "Export", color: "text-brand-accent" },
  send: { icon: <Envelope size={11} />, label: "Send", color: "text-pink-400" },
  config: { icon: <Gear size={11} />, label: "Config Change", color: "text-brand-accent" },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.20)]",
  low: "bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.20)]",
};

const ACTION_FILTERS: ActionType[] = ["login", "create", "update", "delete", "export", "send", "config"];

// Map server action_type / metadata.label to the UI ActionType enum.
function mapActionLabel(raw: string): ActionType {
  const lower = raw.toLowerCase();
  if (lower === "login") return "login";
  if (lower === "delete") return "delete";
  if (lower === "update" || lower === "permission_change") return "update";
  if (lower === "export") return "export";
  if (lower === "send" || lower === "email_campaign" || lower === "sms_campaign") return "send";
  if (lower === "config" || lower === "admin_action") return "config";
  if (lower === "create") return "create";
  return "update";
}

function avatarFor(name: string): string {
  return name.split(/\s|[_.@]/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function AuditPage() {
  const [tab, setTab] = useState<AuditTab>("trail");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"today" | "7d" | "30d" | "all">("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showSensitiveOnly, setShowSensitiveOnly] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportFormat, setExportFormat] = useState<"CSV" | "JSON" | "PDF Report">("CSV");
  const [exportActionFilter, setExportActionFilter] = useState<ActionType | "all">("all");
  const [exportUserFilter, setExportUserFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [logRes, alertsRes] = await Promise.all([
          fetch("/api/audit-log?page_size=200").then(r => r.ok ? r.json() : { entries: [] }),
          fetch("/api/security-alerts").then(r => r.ok ? r.json() : { alerts: [] }),
        ]);
        if (cancelled) return;

        const mapped: AuditEntry[] = (logRes.entries ?? []).map((e: {
          id: string;
          timestamp: string;
          action: string;
          description: string;
          resource: string;
          status: string;
          ip: string | null;
          sensitive: boolean;
          user_email: string | null;
        }) => {
          const userName = e.user_email || "system";
          const statusNorm: "success" | "failed" | "warning" =
            e.status === "failed" || e.status === "error" ? "failed"
            : e.status === "warning" || e.status === "queued" ? "warning"
            : "success";
          return {
            id: e.id,
            timestamp: e.timestamp,
            user: userName,
            userAvatar: avatarFor(userName),
            action: mapActionLabel(e.action),
            resource: e.resource || "trinity",
            details: e.description,
            ip: e.ip || "",
            status: statusNorm,
            sensitive: Boolean(e.sensitive),
          };
        });
        setEntries(mapped);
        setAlerts(alertsRes.alerts ?? []);
      } catch (err) {
        console.error("Audit load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (dateFilter === "7d") return Date.now() - new Date(e.timestamp).getTime() < 7 * 86400000;
    if (dateFilter === "30d") return Date.now() - new Date(e.timestamp).getTime() < 30 * 86400000;
    return true;
  });

  const stats = {
    total: entries.length,
    success: entries.filter(e => e.status === "success").length,
    failed: entries.filter(e => e.status === "failed").length,
    sensitive: entries.filter(e => e.sensitive).length,
    unresolvedAlerts: alerts.filter(a => !a.resolved).length,
  };

  async function resolveAlert(id: string) {
    try {
      const res = await fetch("/api/security-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
      }
    } catch (err) {
      console.error("Resolve failed:", err);
    }
  }

  const exportFiltered = entries.filter(e => {
    if (exportActionFilter !== "all" && e.action !== exportActionFilter) return false;
    if (exportUserFilter !== "all" && e.user !== exportUserFilter) return false;
    if (exportStartDate && e.timestamp < exportStartDate) return false;
    if (exportEndDate && e.timestamp > exportEndDate + "T23:59:59") return false;
    return true;
  });

  function exportCSV() {
    const rows = exportFiltered.length > 0 ? exportFiltered : filtered;
    const csv = "Timestamp,User,Action,Resource,Details,IP,Status\n" +
      rows.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.resource}","${e.details}","${e.ip}","${e.status}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const TABS: { id: AuditTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "trail", label: "Audit Trail", icon: <Pulse size={13} /> },
    { id: "security", label: "Security Alerts", icon: <Shield size={13} />, badge: stats.unresolvedAlerts },
    { id: "retention", label: "Retention", icon: <Clock size={13} /> },
    { id: "export", label: "Export", icon: <DownloadSimple size={13} /> },
  ];

  return (
    <MotionPage className="space-y-5">{/* -- Audit Log command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Pulse &amp; Audit</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Audit Log</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5">
                  <DownloadSimple size={12} /> Export CSV
                </button>
      </div>
    </div>{/* Stats */}<div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
              {/* Focal tile */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.36 }}
                className="flex items-start gap-3 glass rounded-2xl p-5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Actions</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{stats.total}</p>
                  <p className="text-[10px] text-text-muted mt-1">{stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}% success</p>
                </div>
              </motion.div>
              {/* Support tile: Failures */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.36 }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Failures</p>
                <p className={`font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${stats.failed > 0 ? "text-red-400" : "text-emerald-400"}`}>{stats.failed}</p>
              </motion.div>
              {/* Support tile: Sensitive */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.36 }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Sensitive</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-brand-accent tabular-nums">{stats.sensitive}</p>
              </motion.div>
              {/* Support tile: Alerts */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.36 }}
                className="glass rounded-2xl p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Alerts</p>
                <p className={`font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${stats.unresolvedAlerts > 0 ? "text-red-400" : "text-emerald-400"}`}>{stats.unresolvedAlerts}</p>
              </motion.div>
            </div>{/* Tabs */}<div className="flex gap-1 bg-surface rounded-lg p-1 w-fit flex-wrap">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
                    tab === t.id ? "bg-[rgba(212,255,0,0.08)] text-brand-accent font-medium" : "text-text-muted hover:text-text-primary"
                  }`}>
                  {t.icon} {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{t.badge}</span>
                  )}
                </button>
              ))}
            </div>{/* ═══ AUDIT TRAIL TAB ═══ */}{tab === "trail" && (
              <div className="space-y-3">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <MagnifyingGlass size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search actions, users, resources..." className="input w-full pl-7 text-xs py-1.5" />
                  </div>

                  {/* Action type filter */}
                  <div className="flex gap-1 bg-surface rounded-lg p-0.5">
                    <button onClick={() => setActionFilter("all")} className={`px-2 py-1 rounded-md text-[9px] font-medium ${actionFilter === "all" ? "bg-[rgba(212,255,0,0.12)] text-brand-accent" : "text-text-muted"}`}>All</button>
                    {ACTION_FILTERS.map(af => (
                      <button key={af} onClick={() => setActionFilter(af)}
                        className={`px-2 py-1 rounded-md text-[9px] font-medium capitalize ${actionFilter === af ? "bg-[rgba(212,255,0,0.12)] text-brand-accent" : "text-text-muted"}`}>
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
                        className={`px-2 py-1 rounded text-[9px] ${dateFilter === val ? "bg-[rgba(212,255,0,0.12)] text-brand-accent" : "text-text-muted"}`}>{label}</button>
                    ))}
                  </div>

                  {/* Sensitive toggle */}
                  <button onClick={() => setShowSensitiveOnly(!showSensitiveOnly)}
                    className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${showSensitiveOnly ? "bg-[rgba(212,255,0,0.10)] text-brand-accent" : "text-text-muted"}`}>
                    <Lock size={9} /> Sensitive Only
                  </button>

                  <span className="text-[9px] text-text-muted ml-auto">{filtered.length} entries</span>
                </div>

                {/* Audit Table */}
                <PrismPanel padding="p-0" className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px]">Timestamp</th>
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px]">User</th>
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px]">Action</th>
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px]">Resource</th>
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px] hidden lg:table-cell">Details</th>
                        <th className="text-left py-2.5 px-3 text-text-muted font-semibold text-[10px] hidden md:table-cell">IP</th>
                        <th className="text-center py-2.5 px-3 text-text-muted font-semibold text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-12">
                          <Pulse size={28} className="mx-auto mb-2 text-text-muted/30" />
                          <p className="text-sm text-text-muted">{loading ? "Loading audit entries..." : "No audit entries yet."}</p>
                        </td></tr>
                      )}
                      {filtered.map((entry, idx) => {
                        const style = ACTION_STYLES[entry.action];
                        return (
                          <motion.tr key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                            className="border-b border-border-subtle/30 hover:bg-surface-light/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-mono text-text-muted">{entry.timestamp}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-[rgba(212,255,0,0.08)] flex items-center justify-center text-[8px] font-bold text-brand-accent shrink-0">{entry.userAvatar}</div>
                                <span className="text-[10px] font-medium truncate">{entry.user}</span>
                                {entry.sensitive && <Lock size={8} className="text-brand-accent shrink-0" />}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`flex items-center gap-1 text-[10px] font-medium ${style.color}`}>
                                {style.icon} {style.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[10px] font-medium">{entry.resource}</td>
                            <td className="py-2.5 px-3 text-[10px] text-text-muted truncate max-w-[200px] hidden lg:table-cell">{entry.details}</td>
                            <td className="py-2.5 px-3 text-[10px] font-mono text-text-muted hidden md:table-cell">{entry.ip}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                                entry.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                                entry.status === "failed" ? "bg-red-500/10 text-red-400" :
                                "bg-[rgba(212,255,0,0.08)] text-brand-accent"
                              }`}>
                                {entry.status === "success" ? <CheckCircle size={8} /> : entry.status === "failed" ? <Warning size={8} /> : <Clock size={8} />}
                                {entry.status}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </PrismPanel>

                {/* Expanded Detail */}
                {expandedEntry && (() => {
                  const e = entries.find(en => en.id === expandedEntry);
                  if (!e) return null;
                  const style = ACTION_STYLES[e.action];
                  return (
                    <PrismPanel padding="p-4" className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold flex items-center gap-2">
                          <span className={style.color}>{style.icon}</span> Action Details
                        </h3>
                        <button
                          onClick={() => setExpandedEntry(null)}
                          aria-label="Close detail"
                          className="text-text-muted hover:text-text-primary"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                          <p className="text-[8px] text-text-muted uppercase">Timestamp</p>
                          <p className="text-[10px] font-mono mt-0.5">{e.timestamp}</p>
                        </div>
                        <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                          <p className="text-[8px] text-text-muted uppercase">User</p>
                          <p className="text-[10px] font-medium mt-0.5">{e.user}</p>
                        </div>
                        <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                          <p className="text-[8px] text-text-muted uppercase">Action</p>
                          <p className={`text-[10px] font-medium mt-0.5 ${style.color}`}>{style.label}</p>
                        </div>
                        <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                          <p className="text-[8px] text-text-muted uppercase">IP Address</p>
                          <p className="text-[10px] font-mono mt-0.5">{e.ip}</p>
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <p className="text-[8px] text-text-muted uppercase mb-1">Full Details</p>
                        <p className="text-[10px]">{e.details}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <p className="text-[8px] text-text-muted uppercase mb-1">Resource</p>
                        <p className="text-[10px] font-medium">{e.resource}</p>
                      </div>
                      {e.sensitive && (
                        <div className="p-2.5 rounded-lg bg-[rgba(212,255,0,0.06)] border border-[rgba(212,255,0,0.15)] flex items-center gap-2">
                          <Lock size={11} className="text-brand-accent shrink-0" />
                          <p className="text-[10px] text-brand-accent">This action involved sensitive data or configuration changes.</p>
                        </div>
                      )}
                    </PrismPanel>
                  );
                })()}
              </div>
            )}{/* ═══ SECURITY ALERTS TAB ═══ */}{tab === "security" && (
              <div className="space-y-4">
                {/* Unresolved alerts */}
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Shield size={13} className="text-red-400" /> Unresolved Alerts</h2>
                  <div className="space-y-2">
                    {alerts.filter(a => !a.resolved).length === 0 && (
                      <div className="text-center py-8">
                        <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                        <p className="text-xs text-text-muted">{loading ? "Loading alerts..." : "All alerts resolved. System secure."}</p>
                      </div>
                    )}
                    {alerts.filter(a => !a.resolved).map(alert => (
                      <div key={alert.id} className={`p-3 rounded-lg border ${SEVERITY_STYLES[alert.severity]}`}>
                        <div className="flex items-start gap-3">
                          <WarningCircle size={14} className="shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] uppercase font-bold">{alert.severity}</span>
                              <span className="text-[9px] opacity-60">{new Date(alert.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] font-medium">{alert.title}</p>
                            {alert.description && (
                              <p className="text-[10px] opacity-80 mt-0.5">{alert.description}</p>
                            )}
                            {alert.ip_address && (
                              <p className="text-[9px] opacity-60 mt-0.5">IP: {alert.ip_address}</p>
                            )}
                          </div>
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="text-[9px] px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/12 transition-colors font-medium shrink-0">
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </PrismPanel>

                {/* Resolved alerts */}
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><CheckCircle size={13} className="text-emerald-400" /> Resolved Alerts</h2>
                  <div className="space-y-2">
                    {alerts.filter(a => a.resolved).length === 0 && (
                      <p className="text-xs text-text-muted text-center py-6">No resolved alerts yet.</p>
                    )}
                    {alerts.filter(a => a.resolved).map(alert => (
                      <div key={alert.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <div className="flex items-center gap-3">
                          <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium">{alert.title}</p>
                            <p className="text-[9px] text-text-muted">{new Date(alert.created_at).toLocaleString()}</p>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[alert.severity]}`}>{alert.severity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </PrismPanel>

                {/* Security Overview — computed from real entries */}
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Eye size={13} className="text-brand-accent" /> Security Overview</h2>
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
                        <div className="py-8 text-center text-xs text-text-muted">
                          <Shield size={20} className="mx-auto mb-2 text-text-muted/40" />
                          No security events recorded yet. Stats will populate as your team uses the platform.
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {[
                          { label: "Failed Logins (7d)", value: failedLogins, color: "text-red-400" },
                          { label: "Config Changes (7d)", value: configChanges, color: "text-brand-accent" },
                          { label: "Data Exports (7d)", value: dataExports, color: "text-brand-accent" },
                          { label: "Unique IPs (7d)", value: uniqueIps, color: "text-brand-accent" },
                        ].map((s, i) => (
                          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                            <p className="text-[9px] text-text-muted uppercase">{s.label}</p>
                            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })()}
                </PrismPanel>
              </div>
            )}{/* ═══ RETENTION TAB ═══ */}{tab === "retention" && (
              <div className="space-y-4">
                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Clock size={13} className="text-brand-accent" /> Retention Policy</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">Retention Period (days)</label>
                      <div className="flex items-center gap-3">
                        <input type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                          className="input w-32 text-xs" min={30} max={365} />
                        <div className="flex gap-1">
                          {[30, 60, 90, 180, 365].map(d => (
                            <button key={d} onClick={() => setRetentionDays(d)}
                              className={`px-2 py-1 rounded text-[9px] ${retentionDays === d ? "bg-[rgba(212,255,0,0.12)] text-brand-accent" : "text-text-muted hover:text-text-primary"}`}>{d}d</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted">Audit logs older than {retentionDays} days will be automatically archived and removed from the active view.</p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <p className="text-[9px] text-text-muted uppercase">Active Entries</p>
                        <p className="text-lg font-bold text-brand-accent mt-0.5">{entries.length}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <p className="text-[9px] text-text-muted uppercase">Storage Used</p>
                        {/* Rough estimate: ~200 bytes/entry; exact size comes from backend once wired. */}
                        <p className="text-lg font-bold text-brand-accent mt-0.5">
                          {entries.length > 0 ? `${(entries.length * 0.2).toFixed(1)} KB` : "0 KB"}
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <p className="text-[9px] text-text-muted uppercase">Archived</p>
                        <p className="text-lg font-bold text-text-muted mt-0.5">0</p>
                      </div>
                    </div>
                  </div>
                </PrismPanel>

                <PrismPanel padding="p-4">
                  <h2 className="flex items-center gap-2"><Database size={13} className="text-brand-accent" /> Data Lifecycle</h2>
                  <div className="space-y-2">
                    {[
                      { stage: "Active", desc: `0 - ${retentionDays} days`, status: "Current data, fully searchable", color: "text-emerald-400" },
                      { stage: "Archived", desc: `${retentionDays} - ${retentionDays * 2} days`, status: "Compressed storage, on-demand access", color: "text-brand-accent" },
                      { stage: "Deleted", desc: `After ${retentionDays * 2} days`, status: "Permanently removed", color: "text-red-400" },
                    ].map((item, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                        <div className={`w-2 h-2 rounded-full ${item.color === "text-emerald-400" ? "bg-emerald-400" : item.color === "text-brand-accent" ? "bg-brand-accent" : "bg-red-400"}`} />
                        <div className="flex-1">
                          <p className={`text-[10px] font-semibold ${item.color}`}>{item.stage}</p>
                          <p className="text-[9px] text-text-muted">{item.desc}</p>
                        </div>
                        <span className="text-[9px] text-text-muted">{item.status}</span>
                      </motion.div>
                    ))}
                  </div>
                </PrismPanel>
              </div>
            )}{/* ═══ EXPORT TAB ═══ */}{tab === "export" && (
              <PrismPanel padding="p-4">
                <h2 className="flex items-center gap-2"><DownloadSimple size={13} className="text-brand-accent" /> Export Audit Report</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">Start Date</label>
                      <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)}
                        className="input w-full text-xs" />
                    </div>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">End Date</label>
                      <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)}
                        className="input w-full text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">Format</label>
                      <select value={exportFormat} onChange={e => setExportFormat(e.target.value as typeof exportFormat)}
                        className="input w-full text-xs">
                        <option>CSV</option>
                        <option>JSON</option>
                        <option>PDF Report</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">Filter by Action</label>
                      <select value={exportActionFilter} onChange={e => setExportActionFilter(e.target.value as ActionType | "all")}
                        className="input w-full text-xs">
                        <option value="all">All Actions</option>
                        {ACTION_FILTERS.map(af => <option key={af} value={af}>{ACTION_STYLES[af].label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted uppercase mb-1 block font-semibold">Filter by User</label>
                    <select value={exportUserFilter} onChange={e => setExportUserFilter(e.target.value)}
                      className="input w-full text-xs">
                      <option value="all">All Users</option>
                      {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="rounded-xl p-3 text-[10px] text-text-muted" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,255,0,0.08)" }}>
                    Estimated export size: <span className="font-bold text-brand-accent">{exportFiltered.length} entries</span> ({(exportFiltered.length * 0.2).toFixed(1)} KB)
                  </div>
                  <div className="flex gap-2">
                    <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5"><DownloadSimple size={12} /> Export</button>
                    <button
                      onClick={async () => {
                        const rows = exportFiltered.length > 0 ? exportFiltered : filtered;
                        const csv = "Timestamp,User,Action,Resource,Details,IP,Status\n" +
                          rows.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.resource}","${e.details}","${e.ip}","${e.status}"`).join("\n");
                        try {
                          await navigator.clipboard.writeText(csv);
                        } catch (err) {
                          console.error("[audit/export] Copy to clipboard failed:", err);
                        }
                      }}
                      className="btn-secondary text-xs flex items-center gap-1.5"><Copy size={12} /> Copy to Clipboard</button>
                  </div>
                </div>
              </PrismPanel>
            )}</MotionPage>
  );
}

