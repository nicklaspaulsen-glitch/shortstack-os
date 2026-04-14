"use client";

import { useState } from "react";
import {
  GitMerge, Search, Trash2, AlertTriangle, CheckCircle,
  Settings, Clock, BarChart3, Shield, RefreshCw,
  Eye, Zap
} from "lucide-react";

type DedupTab = "scan" | "rules" | "history" | "settings";

interface DuplicateGroup {
  id: string;
  field: string;
  matchValue: string;
  confidence: number;
  leads: { id: string; name: string; email: string | null; phone: string | null; status: string; created: string; source: string }[];
}

interface ScanHistory {
  id: string;
  date: string;
  found: number;
  merged: number;
  auto: boolean;
}

interface PreventionRule {
  id: string;
  field: string;
  action: "block" | "warn" | "merge";
  active: boolean;
}

const MOCK_DUPLICATES: DuplicateGroup[] = [
  {
    id: "d1", field: "email", matchValue: "smith@dental.com", confidence: 98,
    leads: [
      { id: "l1", name: "Dr. Smith Dental", email: "smith@dental.com", phone: "(555) 111-2222", status: "warm-lead", created: "2026-04-10", source: "Cold Call" },
      { id: "l2", name: "Smith Dental Practice", email: "smith@dental.com", phone: null, status: "new", created: "2026-04-12", source: "Website" },
    ],
  },
  {
    id: "d2", field: "phone", matchValue: "(555) 333-4444", confidence: 92,
    leads: [
      { id: "l3", name: "FitPro Gym Portland", email: "info@fitpro.com", phone: "(555) 333-4444", status: "booked-call", created: "2026-04-08", source: "Referral" },
      { id: "l4", name: "FitPro Gym", email: "mark@fitpro.com", phone: "(555) 333-4444", status: "warm-lead", created: "2026-04-11", source: "Facebook Ad" },
      { id: "l5", name: "Fit Pro Gym LLC", email: null, phone: "5553334444", status: "new", created: "2026-04-13", source: "Google Ad" },
    ],
  },
  {
    id: "d3", field: "name", matchValue: "luxe salon", confidence: 85,
    leads: [
      { id: "l6", name: "Luxe Salon", email: "info@luxesalon.com", phone: "(555) 555-6666", status: "closed-won", created: "2026-03-15", source: "Cold Call" },
      { id: "l7", name: "LUXE SALON", email: "luxe@gmail.com", phone: null, status: "new", created: "2026-04-14", source: "Instagram" },
    ],
  },
  {
    id: "d4", field: "email", matchValue: "anna@greeneats.com", confidence: 100,
    leads: [
      { id: "l8", name: "Green Eats Restaurant", email: "anna@greeneats.com", phone: "(555) 777-8888", status: "closed-won", created: "2026-02-20", source: "Referral" },
      { id: "l9", name: "Anna - Green Eats", email: "anna@greeneats.com", phone: "(555) 777-8888", status: "warm-lead", created: "2026-04-05", source: "Website" },
    ],
  },
  {
    id: "d5", field: "name", matchValue: "metro realty", confidence: 78,
    leads: [
      { id: "l10", name: "Metro Realty Group", email: "tom@metrorealty.com", phone: "(555) 999-0000", status: "sent-proposal", created: "2026-03-28", source: "LinkedIn" },
      { id: "l11", name: "MetroRealty", email: "info@metrorealty.com", phone: null, status: "new", created: "2026-04-13", source: "Cold Email" },
    ],
  },
];

const MOCK_HISTORY: ScanHistory[] = [
  { id: "h1", date: "2026-04-14", found: 5, merged: 3, auto: false },
  { id: "h2", date: "2026-04-07", found: 8, merged: 6, auto: true },
  { id: "h3", date: "2026-03-31", found: 3, merged: 3, auto: true },
  { id: "h4", date: "2026-03-24", found: 12, merged: 10, auto: true },
  { id: "h5", date: "2026-03-17", found: 6, merged: 4, auto: false },
];

const MOCK_RULES: PreventionRule[] = [
  { id: "pr1", field: "email", action: "block", active: true },
  { id: "pr2", field: "phone", action: "warn", active: true },
  { id: "pr3", field: "name", action: "warn", active: false },
];

export default function DedupPage() {
  const [tab, setTab] = useState<DedupTab>("scan");
  const [duplicates, setDuplicates] = useState(MOCK_DUPLICATES);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [merging, setMerging] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [fieldToKeep, setFieldToKeep] = useState<Record<string, Record<string, string>>>({});
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [autoScanFreq, setAutoScanFreq] = useState("weekly");
  const [autoMergeThreshold, setAutoMergeThreshold] = useState(95);
  const [rules, setRules] = useState(MOCK_RULES);
  const [whitelistPairs, setWhitelistPairs] = useState<string[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const totalDupes = duplicates.reduce((s, g) => s + g.leads.length - 1, 0);
  const highConfidence = duplicates.filter(g => g.confidence >= 90).length;

  const startScan = () => {
    setScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setScanning(false); return 100; }
        return prev + 5;
      });
    }, 100);
  };

  const mergeDuplicate = (groupId: string) => {
    setMerging(groupId);
    setTimeout(() => {
      setDuplicates(prev => prev.filter(g => g.id !== groupId));
      setMerging(null);
    }, 500);
  };

  const mergeAll = () => {
    setDuplicates([]);
  };

  const whitelistGroup = (groupId: string) => {
    setWhitelistPairs(prev => [...prev, groupId]);
    setDuplicates(prev => prev.filter(g => g.id !== groupId));
  };

  const filteredDuplicates = duplicates.filter(g => g.confidence >= confidenceFilter);

  const TABS: { id: DedupTab; label: string; icon: React.ReactNode }[] = [
    { id: "scan", label: "Scan & Merge", icon: <GitMerge size={13} /> },
    { id: "rules", label: "Prevention", icon: <Shield size={13} /> },
    { id: "history", label: "History", icon: <Clock size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><GitMerge size={18} className="text-gold" /> Dedup & Merge</h1>
          <p className="text-xs text-muted mt-0.5">{duplicates.length} groups - {totalDupes} removable leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={startScan} disabled={scanning} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={12} className={scanning ? "animate-spin" : ""} /> {scanning ? "Scanning..." : "Rescan"}
          </button>
          {totalDupes > 0 && (
            <button onClick={mergeAll} className="btn-primary text-xs flex items-center gap-1.5">
              <Trash2 size={12} /> Clean All ({totalDupes})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{duplicates.length}</p>
          <p className="text-[10px] text-muted">Duplicate Groups</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-red-400">{totalDupes}</p>
          <p className="text-[10px] text-muted">Removable Leads</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{highConfidence}</p>
          <p className="text-[10px] text-muted">High Confidence</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{MOCK_HISTORY.reduce((s, h) => s + h.merged, 0)}</p>
          <p className="text-[10px] text-muted">Total Merged</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{whitelistPairs.length}</p>
          <p className="text-[10px] text-muted">Whitelisted</p>
        </div>
      </div>

      {/* Scan Progress */}
      {scanning && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Search size={12} className="text-gold" /> Scanning for duplicates...</p>
            <span className="text-xs text-muted">{scanProgress}%</span>
          </div>
          <div className="h-3 rounded-full bg-surface-light overflow-hidden">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${scanProgress}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-muted">
            <span>Checking emails...</span>
            <span>Checking phones...</span>
            <span>Checking names...</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Scan & Merge Tab */}
      {tab === "scan" && (
        <div className="space-y-3">
          {/* Confidence Filter */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted">Min Confidence:</span>
            <input type="range" min={0} max={100} value={confidenceFilter}
              onChange={e => setConfidenceFilter(parseInt(e.target.value))}
              className="flex-1 accent-gold" />
            <span className="text-xs font-bold w-10">{confidenceFilter}%</span>
          </div>

          {filteredDuplicates.length === 0 ? (
            <div className="card text-center py-16">
              <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400/30" />
              <p className="text-sm text-foreground font-semibold mb-1">No duplicates found</p>
              <p className="text-xs text-muted">Your lead database is clean!</p>
            </div>
          ) : (
            filteredDuplicates.map(group => (
              <div key={group.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-400" />
                    <span className="text-xs font-semibold">{group.leads.length} matches by {group.field}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">{group.matchValue}</span>
                    {/* Confidence Score */}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      group.confidence >= 90 ? "bg-emerald-400/10 text-emerald-400" : group.confidence >= 70 ? "bg-yellow-400/10 text-yellow-400" : "bg-red-400/10 text-red-400"
                    }`}>
                      {group.confidence}% match
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => whitelistGroup(group.id)} className="btn-ghost text-[9px] py-1 px-2 flex items-center gap-1">
                      <Shield size={10} /> Whitelist
                    </button>
                    <button onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)} className="btn-ghost text-[9px] py-1 px-2 flex items-center gap-1">
                      <Eye size={10} /> Compare
                    </button>
                    <button onClick={() => mergeDuplicate(group.id)} disabled={merging === group.id}
                      className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                      {merging === group.id ? <RefreshCw size={10} className="animate-spin" /> : <GitMerge size={10} />}
                      Merge
                    </button>
                  </div>
                </div>

                {/* Side-by-side Comparison */}
                {expandedGroup === group.id ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5 pr-3 text-muted">Field</th>
                          {group.leads.map((lead, idx) => (
                            <th key={lead.id} className="text-left py-1.5 px-2">
                              <span className={idx === group.leads.length - 1 ? "text-emerald-400" : "text-muted"}>
                                {idx === group.leads.length - 1 ? "KEEP" : `Lead ${idx + 1}`}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {["name", "email", "phone", "status", "source", "created"].map(field => (
                          <tr key={field} className="border-b border-border/50">
                            <td className="py-1.5 pr-3 text-muted capitalize">{field}</td>
                            {group.leads.map(lead => (
                              <td key={lead.id} className="py-1.5 px-2">
                                {field === "name" ? lead.name : field === "email" ? (lead.email || "-") : field === "phone" ? (lead.phone || "-") : field === "status" ? lead.status : field === "source" ? lead.source : lead.created}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {group.leads.map((lead, i) => (
                      <div key={lead.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] ${
                        i === group.leads.length - 1 ? "bg-emerald-400/[0.03] border border-emerald-400/10" : "bg-surface-light"
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium">{lead.name}</span>
                          <span className="text-muted/50">{lead.email || "-"}</span>
                          <span className="text-muted/50">{lead.phone || "-"}</span>
                          <span className="text-muted/50">{lead.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted/40">{lead.status}</span>
                          {i === group.leads.length - 1 && <span className="text-[8px] text-emerald-400 font-bold">KEEP</span>}
                          {i < group.leads.length - 1 && <span className="text-[8px] text-red-400">REMOVE</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Prevention Tab */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Shield size={13} className="text-gold" /> Duplicate Prevention Rules</h2>
            <p className="text-[10px] text-muted mb-3">Prevent duplicates from being created in the first place</p>
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <Shield size={14} className={rule.active ? "text-gold" : "text-muted/30"} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Block duplicate by {rule.field}</p>
                    <p className="text-[10px] text-muted">
                      Action: <span className={rule.action === "block" ? "text-red-400" : rule.action === "warn" ? "text-yellow-400" : "text-blue-400"}>{rule.action}</span>
                    </p>
                  </div>
                  <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
                    className={`w-10 h-5 rounded-full transition-all relative ${rule.active ? "bg-gold" : "bg-surface"}`}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: rule.active ? 22 : 2 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {/* Auto-merge Rules */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-emerald-400" /> Auto-Merge Rules</h2>
            <div className="p-3 rounded-lg bg-surface-light border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Auto-merge high confidence duplicates</p>
                <span className="text-[10px] text-gold">{autoMergeThreshold}% threshold</span>
              </div>
              <input type="range" min={70} max={100} value={autoMergeThreshold}
                onChange={e => setAutoMergeThreshold(parseInt(e.target.value))}
                className="w-full accent-gold" />
              <div className="flex justify-between text-[9px] text-muted mt-1">
                <span>70% (Aggressive)</span>
                <span>85% (Balanced)</span>
                <span>100% (Conservative)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-gold" /> Scan History</h2>
          <div className="space-y-2">
            {MOCK_HISTORY.map(h => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                <div className="text-center w-14 shrink-0">
                  <p className="text-[9px] text-muted">{new Date(h.date).toLocaleDateString("en-US", { month: "short" })}</p>
                  <p className="text-lg font-bold leading-none">{new Date(h.date).getDate()}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{h.found} duplicates found</p>
                  <p className="text-[10px] text-muted">{h.merged} merged - {h.auto ? "Auto scan" : "Manual scan"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {h.auto && <Zap size={12} className="text-gold" />}
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${h.merged === h.found ? "bg-emerald-400/10 text-emerald-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                    {h.merged === h.found ? "All resolved" : `${h.found - h.merged} remaining`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-gold" /> Scheduled Auto-Scans</h2>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light mb-3">
              <div>
                <p className="text-xs font-semibold">Enable Auto-Scanning</p>
                <p className="text-[10px] text-muted">Automatically scan for duplicates on a schedule</p>
              </div>
              <button onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                className={`w-10 h-5 rounded-full transition-all relative ${autoScanEnabled ? "bg-gold" : "bg-surface"}`}>
                <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: autoScanEnabled ? 22 : 2 }} />
              </button>
            </div>
            {autoScanEnabled && (
              <div>
                <label className="block text-[10px] text-muted mb-1">Scan Frequency</label>
                <select value={autoScanFreq} onChange={e => setAutoScanFreq(e.target.value)} className="input w-full text-xs">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-blue-400" /> Duplicate Stats Dashboard</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                <p className="text-xl font-bold text-gold">{MOCK_HISTORY.reduce((s, h) => s + h.found, 0)}</p>
                <p className="text-[9px] text-muted">Total Found</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                <p className="text-xl font-bold text-emerald-400">{MOCK_HISTORY.reduce((s, h) => s + h.merged, 0)}</p>
                <p className="text-[9px] text-muted">Total Merged</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-light text-center border border-border">
                <p className="text-xl font-bold text-blue-400">{Math.round((MOCK_HISTORY.reduce((s, h) => s + h.merged, 0) / Math.max(MOCK_HISTORY.reduce((s, h) => s + h.found, 0), 1)) * 100)}%</p>
                <p className="text-[9px] text-muted">Resolution Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
