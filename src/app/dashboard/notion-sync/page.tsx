"use client";

import { useState } from "react";
import {
  Database, FileText, Search, RefreshCw,
  Check, AlertTriangle, Clock, Settings,
  ArrowLeftRight, Filter, ChevronDown, ChevronRight, Copy,
  BarChart3, Calendar,
  Play, Eye, Download, Plus, Zap
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

const tabs = ["Workspaces", "Sync Map", "Status", "Field Map", "Conflicts", "History", "Schedule", "Templates", "Browser", "Selective", "Analytics", "Settings"] as const;
type Tab = (typeof tabs)[number];

const mockWorkspaces: { id: string; name: string; icon: string; pages: number; dbs: number; lastSync: string; status: string }[] = [];

const mockDatabases: { id: string; name: string; notionId: string; fields: number; records: number; synced: boolean; direction: string; lastSync: string }[] = [];

const mockFieldMappings: { id: string; notionField: string; notionType: string; appField: string | null; appType: string | null; status: string }[] = [];

const mockConflicts: { id: string; record: string; field: string; notionValue: string; appValue: string; detectedAt: string; resolved: boolean }[] = [];

const mockHistory: { id: string; action: string; database: string; records: number; direction: string; duration: string; status: string; time: string }[] = [];

const mockTemplates: { id: string; name: string; desc: string; fields: number; category: string }[] = [];

const mockPages: { id: string; title: string; type: string; parent: string; lastEdited: string; icon: string }[] = [];

const syncAnalytics: { day: string; syncs: number; records: number; errors: number }[] = [];

export default function NotionSyncPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Workspaces");
  const [selectedWorkspace, setSelectedWorkspace] = useState("ws1");
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [biDirectional, setBiDirectional] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState("15");
  const [conflicts, setConflicts] = useState(mockConflicts);
  const [conflictStrategy, setConflictStrategy] = useState("ask");
  const [selectiveItems, setSelectiveItems] = useState<Record<string, boolean>>({});
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [searchPages, setSearchPages] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleFreq, setScheduleFreq] = useState("every-15-min");

  function resolveConflict(id: string, _choice: "notion" | "app") {
    setConflicts(prev => prev.map(c => c.id === id ? { ...c, resolved: true } : c));
  }

  function toggleSelectiveItem(id: string) {
    setSelectiveItems(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function copyId(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const maxRecords = Math.max(...syncAnalytics.map(d => d.records), 1);

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      <PageHero
        icon={<FileText size={28} />}
        title="Notion Sync"
        subtitle="Bi-directional sync with Notion workspaces."
        gradient="blue"
        actions={
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-white/80">Auto-sync</span>
              <div onClick={() => setAutoSync(!autoSync)}
                className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${autoSync ? "bg-emerald-400" : "bg-white/20"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${autoSync ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </div>
            </div>
            <button className="text-xs bg-white/15 border border-white/25 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 hover:bg-white/25 transition-all">
              <RefreshCw size={12} /> Sync Now
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center"><Zap size={16} className="text-green-400" /></div>
          <div><p className="text-lg font-bold font-mono">{mockWorkspaces.length}</p><p className="text-[10px] text-muted">Workspaces</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center"><Database size={16} className="text-gold" /></div>
          <div><p className="text-lg font-bold font-mono">{mockDatabases.length}</p><p className="text-[10px] text-muted">Databases</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center"><ArrowLeftRight size={16} className="text-[#5865F2]" /></div>
          <div><p className="text-lg font-bold font-mono">{mockDatabases.reduce((s, d) => s + d.records, 0)}</p><p className="text-[10px] text-muted">Synced Records</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><AlertTriangle size={16} className="text-purple-400" /></div>
          <div><p className="text-lg font-bold font-mono">{conflicts.filter(c => !c.resolved).length}</p><p className="text-[10px] text-muted">Open Conflicts</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t ? "border-gold text-gold" : "border-transparent text-muted hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Workspaces Tab */}
      {activeTab === "Workspaces" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Connected Notion workspaces. Click to manage sync settings.</p>
          <div className="space-y-2">
            {mockWorkspaces.map(ws => (
              <div key={ws.id} onClick={() => setSelectedWorkspace(ws.id)}
                className={`card p-4 cursor-pointer transition-all ${selectedWorkspace === ws.id ? "border-gold/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center font-bold text-sm">{ws.icon}</div>
                    <div>
                      <p className="text-sm font-semibold">{ws.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted">
                        <span className="flex items-center gap-1"><FileText size={10} /> {ws.pages} pages</span>
                        <span className="flex items-center gap-1"><Database size={10} /> {ws.dbs} databases</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> Last sync: {ws.lastSync}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${ws.status === "connected" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>{ws.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4 border-dashed border-2 border-border text-center cursor-pointer hover:border-gold/30 transition-all">
            <Plus size={20} className="mx-auto mb-2 text-muted" />
            <p className="text-xs font-medium">Connect New Workspace</p>
            <p className="text-[10px] text-muted mt-1">Add your Notion integration token to connect</p>
          </div>
        </div>
      )}

      {/* Sync Map Tab */}
      {activeTab === "Sync Map" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Map Notion databases to your application data models.</p>
          <div className="space-y-2">
            {mockDatabases.map(db => (
              <div key={db.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database size={16} className="text-gold" />
                    <div>
                      <p className="text-xs font-semibold">{db.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted">
                        <span>{db.fields} fields</span>
                        <span>{db.records} records</span>
                        <span className="font-mono">{db.notionId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                      db.direction === "bi-directional" ? "bg-purple-400/10 text-purple-400" :
                      db.direction === "notion-to-app" ? "bg-blue-400/10 text-blue-400" :
                      "bg-green-400/10 text-green-400"
                    }`}>
                      {db.direction === "bi-directional" ? "Bi-directional" : db.direction === "notion-to-app" ? "Notion -> App" : "App -> Notion"}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${db.synced ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {db.synced ? "Synced" : "Not Synced"}
                    </span>
                    <span className="text-[10px] text-muted">{db.lastSync}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Add Database Mapping</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Notion Database</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option>Select database...</option>
                  <option>Team Wiki</option>
                  <option>Knowledge Base</option>
                  <option>Bug Tracker</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">App Table</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option>Select table...</option>
                  <option>clients</option>
                  <option>projects</option>
                  <option>tasks</option>
                  <option>invoices</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Sync Direction</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option>Bi-directional</option>
                  <option>Notion to App</option>
                  <option>App to Notion</option>
                </select>
              </div>
            </div>
            <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Create Mapping</button>
          </div>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === "Status" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Last Full Sync", value: "2 min ago", icon: RefreshCw, color: "text-green-400" },
              { label: "Sync Interval", value: `${syncInterval} min`, icon: Clock, color: "text-gold" },
              { label: "Records/Min", value: "45", icon: Zap, color: "text-[#5865F2]" },
              { label: "Error Rate", value: "0.3%", icon: AlertTriangle, color: "text-yellow-400" },
            ].map((stat, i) => (
              <div key={i} className="card p-3 text-center">
                <stat.icon size={16} className={`mx-auto mb-1 ${stat.color}`} />
                <p className="text-lg font-bold font-mono">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Per-database status */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Database Sync Status</h3>
            <div className="space-y-2">
              {mockDatabases.map(db => (
                <div key={db.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${db.synced ? "bg-green-400" : "bg-yellow-400"}`} />
                    <span className="font-medium">{db.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted">
                    <span>{db.records} records</span>
                    <span>{db.lastSync}</span>
                    <button className="text-gold hover:underline">Sync</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Sync health */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Check size={14} className="text-green-400" /> Sync Health Check</h3>
            <div className="space-y-1.5">
              {[
                { check: "API Connection", status: "pass" },
                { check: "Authentication Token", status: "pass" },
                { check: "Rate Limit Status", status: "pass" },
                { check: "Database Permissions", status: "pass" },
                { check: "Field Mapping Integrity", status: "warning" },
                { check: "Conflict Queue", status: conflicts.filter(c => !c.resolved).length > 0 ? "warning" : "pass" },
              ].map(h => (
                <div key={h.check} className="flex items-center justify-between p-2 rounded-lg bg-surface-light text-xs">
                  <span>{h.check}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${h.status === "pass" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                    {h.status === "pass" ? "Passed" : "Warning"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Field Map Tab */}
      {activeTab === "Field Map" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Map Notion fields to application database columns.</p>
            <select value={selectedDb || ""} onChange={e => setSelectedDb(e.target.value)} className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface">
              <option value="">All Databases</option>
              {mockDatabases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
            </select>
          </div>
          <div className="card p-4">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-muted font-semibold uppercase mb-2 px-2">
              <div className="col-span-3">Notion Field</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-1 text-center">
                <ArrowLeftRight size={10} className="inline" />
              </div>
              <div className="col-span-3">App Field</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-1">Status</div>
            </div>
            <div className="space-y-1.5">
              {mockFieldMappings.map(fm => (
                <div key={fm.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-surface-light border border-border text-xs">
                  <div className="col-span-3 font-medium">{fm.notionField}</div>
                  <div className="col-span-2 text-muted">{fm.notionType}</div>
                  <div className="col-span-1 text-center"><ArrowLeftRight size={10} className="text-muted inline" /></div>
                  <div className="col-span-3 font-mono">{fm.appField || <span className="text-yellow-400 italic">unmapped</span>}</div>
                  <div className="col-span-2 text-muted">{fm.appType || "-"}</div>
                  <div className="col-span-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      fm.status === "mapped" ? "bg-green-400/10 text-green-400" :
                      fm.status === "warning" ? "bg-yellow-400/10 text-yellow-400" :
                      "bg-red-400/10 text-red-400"
                    }`}>{fm.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Add Field Mapping</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Notion Field</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Notion field name" />
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">App Column</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="database_column_name" />
              </div>
            </div>
            <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Add Mapping</button>
          </div>
        </div>
      )}

      {/* Conflicts Tab */}
      {activeTab === "Conflicts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{conflicts.filter(c => !c.resolved).length} unresolved conflicts</p>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted">Default Strategy:</label>
              <select value={conflictStrategy} onChange={e => setConflictStrategy(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1 bg-surface">
                <option value="ask">Ask Every Time</option>
                <option value="notion-wins">Notion Wins</option>
                <option value="app-wins">App Wins</option>
                <option value="newest-wins">Newest Wins</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {conflicts.map(c => (
              <div key={c.id} className={`card p-4 ${c.resolved ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{c.record} - {c.field}</p>
                    <p className="text-[10px] text-muted">Detected {c.detectedAt}</p>
                  </div>
                  {c.resolved && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">Resolved</span>}
                </div>
                {!c.resolved && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => resolveConflict(c.id, "notion")}
                      className="p-2.5 rounded-lg bg-surface-light border border-border hover:border-gold/30 text-left transition-all">
                      <p className="text-[10px] text-muted font-semibold uppercase mb-1">Notion Value</p>
                      <p className="text-xs font-mono">{c.notionValue}</p>
                    </button>
                    <button onClick={() => resolveConflict(c.id, "app")}
                      className="p-2.5 rounded-lg bg-surface-light border border-border hover:border-gold/30 text-left transition-all">
                      <p className="text-[10px] text-muted font-semibold uppercase mb-1">App Value</p>
                      <p className="text-xs font-mono">{c.appValue}</p>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "History" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Sync operation history and audit log.</p>
          <div className="card p-4">
            <div className="space-y-1.5">
              {mockHistory.map(h => (
                <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${h.status === "success" ? "bg-green-400" : "bg-red-400"}`} />
                    <div>
                      <span className="font-medium">{h.action}</span>
                      <span className="text-muted ml-2">{h.database}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted">
                    <span>{h.records} records</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                      h.direction === "bi-directional" ? "bg-purple-400/10 text-purple-400" :
                      h.direction === "notion-to-app" ? "bg-blue-400/10 text-blue-400" :
                      "bg-green-400/10 text-green-400"
                    }`}>{h.direction === "bi-directional" ? "Bi" : h.direction === "notion-to-app" ? "N->A" : "A->N"}</span>
                    <span>{h.duration}</span>
                    <span>{h.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === "Schedule" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar size={14} className="text-gold" /> Auto-Sync Schedule</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Frequency</label>
                <select value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value)}
                  className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option value="every-5-min">Every 5 min</option>
                  <option value="every-15-min">Every 15 min</option>
                  <option value="every-30-min">Every 30 min</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Full Sync Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" />
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border w-full">
                  <span className="text-xs">Enabled</span>
                  <div onClick={() => setScheduleEnabled(!scheduleEnabled)}
                    className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${scheduleEnabled ? "bg-green-400" : "bg-gray-600"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${scheduleEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </div>
                </div>
              </div>
              <div className="flex items-end">
                <button className="text-xs bg-gold/10 text-gold px-4 py-2.5 rounded-lg font-medium hover:bg-gold/20 w-full flex items-center justify-center gap-1.5">
                  <Play size={12} /> Run Now
                </button>
              </div>
            </div>
            {/* Per-database schedule */}
            <p className="text-[10px] text-muted font-semibold uppercase mb-2">Per-Database Overrides</p>
            <div className="space-y-1.5">
              {mockDatabases.filter(d => d.synced).map(db => (
                <div key={db.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-light text-xs">
                  <span className="font-medium">{db.name}</span>
                  <div className="flex items-center gap-3">
                    <select className="text-[10px] border border-border rounded px-2 py-1 bg-surface">
                      <option>Use Default</option>
                      <option>Every 5 min</option>
                      <option>Every 15 min</option>
                      <option>Hourly</option>
                      <option>Daily</option>
                    </select>
                    <span className="text-[10px] text-muted">Next: {db.lastSync}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "Templates" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Pre-built Notion database templates to quickly set up sync.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mockTemplates.map(t => (
              <div key={t.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{t.desc}</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light border border-border">{t.category}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-muted">{t.fields} fields pre-configured</span>
                  <button className="text-[10px] bg-gold/10 text-gold px-3 py-1 rounded font-medium hover:bg-gold/20">Use Template</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browser Tab */}
      {activeTab === "Browser" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-muted" />
            <input value={searchPages} onChange={e => setSearchPages(e.target.value)} placeholder="Search pages and databases..."
              className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface flex-1" />
          </div>
          <div className="card p-4">
            <div className="space-y-1.5">
              {mockPages.filter(p => !searchPages || p.title.toLowerCase().includes(searchPages.toLowerCase())).map(page => (
                <div key={page.id}>
                  <div onClick={() => setExpandedPage(expandedPage === page.id ? null : page.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border text-xs cursor-pointer hover:border-gold/20 transition-all">
                    <div className="flex items-center gap-2">
                      {expandedPage === page.id ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
                      {page.type === "database" ? <Database size={12} className="text-gold" /> : <FileText size={12} className="text-muted" />}
                      <span className="font-medium">{page.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span>{page.parent}</span>
                      <span>{page.lastEdited}</span>
                    </div>
                  </div>
                  {expandedPage === page.id && (
                    <div className="ml-7 mt-1 p-3 rounded-lg bg-surface-light/50 border border-border text-[10px] text-muted space-y-1">
                      <p><span className="font-semibold">Type:</span> {page.type}</p>
                      <p><span className="font-semibold">Parent:</span> {page.parent}</p>
                      <p><span className="font-semibold">Last Edited:</span> {page.lastEdited}</p>
                      <p><span className="font-semibold">ID:</span> <span className="font-mono">{page.id}</span>
                        <button onClick={() => copyId(page.id, page.id)} className="ml-1 inline-flex">
                          {copiedId === page.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                        </button>
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button className="text-gold hover:underline flex items-center gap-1"><Eye size={10} /> Preview</button>
                        <button className="text-gold hover:underline flex items-center gap-1"><Download size={10} /> Export</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selective Tab */}
      {activeTab === "Selective" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Choose which databases and pages to include in sync. Uncheck to exclude.</p>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Filter size={14} className="text-gold" /> Selective Sync</h3>
            <div className="space-y-2">
              {mockDatabases.map(db => (
                <div key={db.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center gap-3">
                    <div onClick={() => toggleSelectiveItem(db.id)}
                      className={`w-5 h-5 rounded border-2 cursor-pointer flex items-center justify-center transition-all ${selectiveItems[db.id] ? "border-gold bg-gold" : "border-border"}`}>
                      {selectiveItems[db.id] && <Check size={12} className="text-black" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{db.name}</p>
                      <p className="text-[10px] text-muted">{db.records} records, {db.fields} fields</p>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${selectiveItems[db.id] ? "bg-green-400/10 text-green-400" : "bg-gray-400/10 text-gray-400"}`}>
                    {selectiveItems[db.id] ? "Included" : "Excluded"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-gold/5 border border-gold/20">
              <div>
                <p className="text-xs font-semibold">Sync Summary</p>
                <p className="text-[10px] text-muted">{Object.values(selectiveItems).filter(v => v).length} of {mockDatabases.length} databases selected, {mockDatabases.filter(d => selectiveItems[d.id]).reduce((s, d) => s + d.records, 0)} total records</p>
              </div>
              <button className="text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Apply Selection</button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Syncs (7d)", value: "154", icon: RefreshCw, color: "text-green-400" },
              { label: "Records Synced", value: "2,124", icon: Database, color: "text-gold" },
              { label: "Avg Duration", value: "2.8s", icon: Clock, color: "text-[#5865F2]" },
              { label: "Success Rate", value: "98.7%", icon: Check, color: "text-green-400" },
            ].map((stat, i) => (
              <div key={i} className="card p-3 text-center">
                <stat.icon size={16} className={`mx-auto mb-1 ${stat.color}`} />
                <p className="text-lg font-bold font-mono">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Daily Chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Daily Sync Volume</h3>
            <div className="flex items-end gap-2 h-32">
              {syncAnalytics.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted">{d.records}</span>
                  <div className="w-full rounded-t bg-gold/70" style={{ height: `${(d.records / maxRecords) * 100}%` }} />
                  <span className="text-[9px] text-muted">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Per-database stats */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Per-Database Performance</h3>
            <div className="space-y-2">
              {mockDatabases.filter(d => d.synced).map(db => (
                <div key={db.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Database size={10} className="text-muted" />
                    <span className="font-medium">{db.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-surface-light rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${(db.records / 156) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted w-16 text-right">{db.records} records</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "Settings" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Settings size={14} className="text-gold" /> Sync Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                <div>
                  <p className="text-xs font-semibold">Bi-Directional Sync</p>
                  <p className="text-[10px] text-muted">Changes in both Notion and the app will sync to each other</p>
                </div>
                <div onClick={() => setBiDirectional(!biDirectional)}
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${biDirectional ? "bg-green-400" : "bg-gray-600"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${biDirectional ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                <div>
                  <p className="text-xs font-semibold">Sync Interval</p>
                  <p className="text-[10px] text-muted">How often incremental syncs run automatically</p>
                </div>
                <select value={syncInterval} onChange={e => setSyncInterval(e.target.value)} className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface">
                  <option value="5">Every 5 min</option>
                  <option value="15">Every 15 min</option>
                  <option value="30">Every 30 min</option>
                  <option value="60">Hourly</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                <div>
                  <p className="text-xs font-semibold">Conflict Strategy</p>
                  <p className="text-[10px] text-muted">Default resolution when field values conflict</p>
                </div>
                <select value={conflictStrategy} onChange={e => setConflictStrategy(e.target.value)} className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface">
                  <option value="ask">Ask Every Time</option>
                  <option value="notion-wins">Notion Wins</option>
                  <option value="app-wins">App Wins</option>
                  <option value="newest-wins">Newest Wins</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Notion API Key</label>
                <div className="flex gap-2 mt-1">
                  <input type="password" defaultValue="ntn_xxxxxxxxxxxxxxxxx" className="flex-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface font-mono" />
                  <button className="text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Update</button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-400/5 border border-red-400/20">
                <div>
                  <p className="text-xs font-semibold text-red-400">Danger Zone</p>
                  <p className="text-[10px] text-muted">Reset all sync data and start fresh</p>
                </div>
                <button className="text-xs bg-red-400/10 text-red-400 px-4 py-2 rounded-lg font-medium hover:bg-red-400/20">Reset Sync</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
