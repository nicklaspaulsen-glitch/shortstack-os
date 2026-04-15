"use client";

import { useState } from "react";
import {
  Activity, Search, Download, CheckCircle, AlertTriangle,
  Clock, Zap, Users, Mail, FileText, Globe, Settings, Bot,
  Shield, Lock, Eye, Bell, Database, ArrowRight,
  ChevronDown, ChevronRight
} from "lucide-react";

interface AuditEntry {
  id: string;
  agent: string;
  action: string;
  description: string;
  status: "success" | "failed" | "pending";
  timestamp: string;
  clientId: string | null;
  clientName: string | null;
  before?: string;
  after?: string;
  ip?: string;
  sensitiveData?: boolean;
}

const MOCK_ENTRIES: AuditEntry[] = [];

const AGENT_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  "Lead Finder": { icon: <Users size={11} />, color: "text-blue-400" },
  "Outreach Bot": { icon: <Mail size={11} />, color: "text-pink-400" },
  "Content Engine": { icon: <FileText size={11} />, color: "text-purple-400" },
  "Automation": { icon: <Zap size={11} />, color: "text-yellow-400" },
  "Website Agent": { icon: <Globe size={11} />, color: "text-green-400" },
  "System": { icon: <Settings size={11} />, color: "text-muted" },
  "Invoice Agent": { icon: <FileText size={11} />, color: "text-emerald-400" },
  "Retention Agent": { icon: <Zap size={11} />, color: "text-rose-400" },
  "SEO Agent": { icon: <Globe size={11} />, color: "text-lime-400" },
};

const COMPLIANCE_ITEMS = [
  { label: "GDPR data export available", status: true },
  { label: "Client data deletion workflow", status: true },
  { label: "API key rotation (30 days)", status: true },
  { label: "Audit log retention (90 days)", status: true },
  { label: "Two-factor authentication", status: false },
  { label: "Sensitive data encryption at rest", status: true },
  { label: "Access logs enabled", status: true },
  { label: "Webhook signing enabled", status: true },
  { label: "SOC 2 compliance", status: false },
  { label: "Automated backup verification", status: true },
];

const TABS = ["Trail", "Data Changes", "Access Log", "Compliance", "Alerts", "Retention", "Export"] as const;
type Tab = typeof TABS[number];
const AGENT_FILTERS = ["All", "Lead Finder", "Outreach Bot", "Content Engine", "System", "Invoice Agent", "Retention Agent", "SEO Agent"];
const DATE_RANGES = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "All", days: 0 },
];

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>("Trail");
  const [entries] = useState(MOCK_ENTRIES);
  const [activeAgent, setActiveAgent] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState(0);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showSensitiveOnly, setShowSensitiveOnly] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [retentionDays, setRetentionDays] = useState(90);

  const filtered = entries.filter(e => {
    if (activeAgent !== "All" && e.agent !== activeAgent) return false;
    if (searchQuery && !e.description.toLowerCase().includes(searchQuery.toLowerCase()) && !e.agent.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (showSensitiveOnly && !e.sensitiveData) return false;
    return true;
  });

  const stats = {
    total: entries.length,
    success: entries.filter(e => e.status === "success").length,
    failed: entries.filter(e => e.status === "failed").length,
    sensitive: entries.filter(e => e.sensitiveData).length,
  };

  function exportCSV() {
    const csv = "Timestamp,Agent,Action,Description,Status,Client\n" +
      filtered.map(e => `"${e.timestamp}","${e.agent}","${e.action}","${e.description}","${e.status}","${e.clientName || ""}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_trail.csv"; a.click();
  }

  const agentStyle = (agent: string) => AGENT_MAP[agent] || { icon: <Bot size={11} />, color: "text-gold" };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Activity size={18} className="text-gold" /> Audit Trail
          </h1>
          <p className="text-xs text-muted mt-0.5">Complete activity history across all AI agents and system actions</p>
        </div>
        <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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

      {/* ═══ TRAIL TAB ═══ */}
      {tab === "Trail" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-surface rounded-lg p-0.5">
              {AGENT_FILTERS.slice(0, 6).map(a => (
                <button key={a} onClick={() => setActiveAgent(a)}
                  className={`px-2 py-1 rounded-md text-[9px] font-medium transition-colors ${activeAgent === a ? "bg-gold/20 text-gold" : "text-muted hover:text-foreground"}`}>{a}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {DATE_RANGES.map(dr => (
                <button key={dr.label} onClick={() => setDateRange(dr.days)}
                  className={`px-2 py-1 rounded text-[9px] ${dateRange === dr.days ? "bg-gold/20 text-gold" : "text-muted"}`}>{dr.label}</button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..." className="input w-full pl-7 text-xs py-1.5" />
            </div>
            <button onClick={() => setShowSensitiveOnly(!showSensitiveOnly)}
              className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${showSensitiveOnly ? "bg-amber-400/15 text-amber-400" : "text-muted"}`}>
              <Lock size={9} /> Sensitive Only
            </button>
          </div>

          {/* Timeline */}
          <div className="space-y-1.5">
            {filtered.length === 0 && (
              <div className="card text-center py-12">
                <Activity size={28} className="mx-auto mb-2 text-muted/30" />
                <p className="text-sm text-muted">No audit entries yet.</p>
              </div>
            )}
            {filtered.map(entry => {
              const style = agentStyle(entry.agent);
              return (
                <div key={entry.id}>
                  <button onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    className="w-full card p-3 flex items-center gap-3 text-left hover:border-gold/10 transition-all">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-surface-light flex items-center justify-center">
                      <span className={style.color}>{style.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold ${style.color}`}>{entry.agent}</span>
                        <span className="text-[9px] text-muted font-mono">{entry.timestamp}</span>
                        {entry.sensitiveData && <Lock size={9} className="text-amber-400" />}
                      </div>
                      <p className="text-xs truncate mt-0.5">{entry.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.clientName && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{entry.clientName}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                        entry.status === "success" ? "bg-emerald-500/10 text-emerald-400" : entry.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {entry.status === "success" ? <CheckCircle size={9} /> : entry.status === "failed" ? <AlertTriangle size={9} /> : <Clock size={9} />}
                        {entry.status}
                      </span>
                      {expandedEntry === entry.id ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
                    </div>
                  </button>
                  {expandedEntry === entry.id && (
                    <div className="mx-3 mb-2 p-3 rounded-lg bg-surface-light border border-border space-y-2 text-[10px]">
                      <div className="grid grid-cols-3 gap-2">
                        <div><span className="text-muted">Action Type</span><p className="font-mono mt-0.5">{entry.action}</p></div>
                        <div><span className="text-muted">Agent</span><p className="mt-0.5">{entry.agent}</p></div>
                        <div><span className="text-muted">Client</span><p className="mt-0.5">{entry.clientName || "System"}</p></div>
                      </div>
                      {entry.before && entry.after && (
                        <div className="flex items-center gap-2 p-2 rounded bg-surface border border-border">
                          <span className="text-muted">Change:</span>
                          <span className="text-red-400 line-through">{entry.before}</span>
                          <ArrowRight size={10} className="text-muted" />
                          <span className="text-emerald-400">{entry.after}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ DATA CHANGES TAB ═══ */}
      {tab === "Data Changes" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Database size={14} className="text-gold" /> Data Change Viewer</h2>
          <div className="space-y-2">
            {entries.filter(e => e.before && e.after).map(e => (
              <div key={e.id} className="p-3 rounded-lg bg-surface-light border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold">{e.description}</span>
                  <span className="text-[9px] text-muted">{e.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded bg-red-500/5 border border-red-500/10">
                    <p className="text-[9px] text-red-400 uppercase font-semibold mb-1">Before</p>
                    <p className="text-xs font-mono">{e.before}</p>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-[9px] text-emerald-400 uppercase font-semibold mb-1">After</p>
                    <p className="text-xs font-mono">{e.after}</p>
                  </div>
                </div>
              </div>
            ))}
            {entries.filter(e => e.before && e.after).length === 0 && (
              <p className="text-xs text-muted text-center py-8">No data changes recorded in this period.</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ ACCESS LOG TAB ═══ */}
      {tab === "Access Log" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Eye size={14} className="text-gold" /> Access Log</h2>
          <p className="text-xs text-muted text-center py-8">No access log entries yet.</p>
        </div>
      )}

      {/* ═══ COMPLIANCE TAB ═══ */}
      {tab === "Compliance" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Shield size={14} className="text-gold" /> Compliance Checklist</h2>
          <div className="space-y-2">
            {COMPLIANCE_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                {item.status ? (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="text-[10px] flex-1">{item.label}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${item.status ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {item.status ? "Passing" : "Action Needed"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-surface-light border border-border">
            <p className="text-[10px] text-muted">Compliance Score: <span className="text-gold font-bold">{COMPLIANCE_ITEMS.filter(i => i.status).length}/{COMPLIANCE_ITEMS.length}</span> ({Math.round((COMPLIANCE_ITEMS.filter(i => i.status).length / COMPLIANCE_ITEMS.length) * 100)}%)</p>
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {tab === "Alerts" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Bell size={14} className="text-gold" /> Automated Audit Alerts</h2>
          <p className="text-[10px] text-muted mb-3">Get notified when specific audit events occur.</p>
          <div className="space-y-2 mb-4">
            {[
              { trigger: "Permission change detected", enabled: true },
              { trigger: "Sensitive data accessed", enabled: true },
              { trigger: "Failed action rate > 10%", enabled: false },
              { trigger: "API key rotation overdue", enabled: true },
              { trigger: "New IP address login", enabled: false },
            ].map((alert, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                <div className={`w-8 h-4 rounded-full transition-colors ${alert.enabled ? "bg-emerald-400" : "bg-surface"}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-all mt-[1px] ${alert.enabled ? "ml-4" : "ml-0.5"}`} />
                </div>
                <span className="text-[10px] flex-1">{alert.trigger}</span>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[9px] text-muted uppercase mb-1 block">Alert Email</label>
            <input value={alertEmail} onChange={e => setAlertEmail(e.target.value)}
              className="input w-full text-xs" placeholder="admin@shortstack.dev" />
          </div>
        </div>
      )}

      {/* ═══ RETENTION TAB ═══ */}
      {tab === "Retention" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Clock size={14} className="text-gold" /> Audit Retention Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Retention Period (days)</label>
              <input type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                className="input w-32 text-xs" min={30} max={365} />
            </div>
            <p className="text-[10px] text-muted">Audit logs older than {retentionDays} days will be automatically archived and removed from the active view.</p>
            <div className="p-3 rounded-lg bg-surface-light border border-border text-[10px]">
              <p>Current storage: <span className="font-bold text-gold">0 entries</span></p>
              <p className="text-muted mt-0.5">No audit data stored yet.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXPORT TAB ═══ */}
      {tab === "Export" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Download size={14} className="text-gold" /> Export Audit Report</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Start Date</label>
                <input type="date" className="input w-full text-xs" defaultValue="2026-04-01" />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">End Date</label>
                <input type="date" className="input w-full text-xs" defaultValue="2026-04-14" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Format</label>
              <select className="input w-full text-xs">
                <option>CSV</option>
                <option>JSON</option>
                <option>PDF Report</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
