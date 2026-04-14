"use client";

import { useState } from "react";
import {
  BookOpen, Database, FileText, Search, RefreshCw,
  Check, AlertTriangle, Clock, Settings,
  ArrowLeftRight, Filter, ChevronDown, ChevronRight, Copy,
  BarChart3, Calendar,
  Play, Eye, Download, Plus, Zap
} from "lucide-react";

const tabs = ["Workspaces", "Sync Map", "Status", "Field Map", "Conflicts", "History", "Schedule", "Templates", "Browser", "Selective", "Analytics", "Settings"] as const;
type Tab = (typeof tabs)[number];

const mockWorkspaces = [
  { id: "ws1", name: "ShortStack Operations", icon: "SS", pages: 124, dbs: 8, lastSync: "2 min ago", status: "connected" },
  { id: "ws2", name: "Client Portal", icon: "CP", pages: 67, dbs: 4, lastSync: "15 min ago", status: "connected" },
  { id: "ws3", name: "Marketing Hub", icon: "MH", pages: 45, dbs: 3, lastSync: "1 hr ago", status: "warning" },
];

const mockDatabases = [
  { id: "db1", name: "Clients", notionId: "abc-123", fields: 12, records: 48, synced: true, direction: "bi-directional", lastSync: "2 min ago" },
  { id: "db2", name: "Projects", notionId: "def-456", fields: 9, records: 32, synced: true, direction: "notion-to-app", lastSync: "5 min ago" },
  { id: "db3", name: "Tasks", notionId: "ghi-789", fields: 14, records: 156, synced: true, direction: "app-to-notion", lastSync: "10 min ago" },
  { id: "db4", name: "Content Calendar", notionId: "jkl-012", fields: 8, records: 87, synced: false, direction: "bi-directional", lastSync: "Never" },
  { id: "db5", name: "Invoices", notionId: "mno-345", fields: 10, records: 23, synced: true, direction: "app-to-notion", lastSync: "30 min ago" },
];

const mockFieldMappings = [
  { id: "f1", notionField: "Name", notionType: "Title", appField: "business_name", appType: "text", status: "mapped" },
  { id: "f2", notionField: "Status", notionType: "Select", appField: "status", appType: "enum", status: "mapped" },
  { id: "f3", notionField: "MRR", notionType: "Number", appField: "mrr", appType: "decimal", status: "mapped" },
  { id: "f4", notionField: "Email", notionType: "Email", appField: "contact_email", appType: "text", status: "mapped" },
  { id: "f5", notionField: "Start Date", notionType: "Date", appField: "created_at", appType: "timestamp", status: "mapped" },
  { id: "f6", notionField: "Tags", notionType: "Multi-Select", appField: "tags", appType: "array", status: "warning" },
  { id: "f7", notionField: "Notes", notionType: "Rich Text", appField: null, appType: null, status: "unmapped" },
  { id: "f8", notionField: "Owner", notionType: "Person", appField: "assigned_to", appType: "text", status: "mapped" },
];

const mockConflicts = [
  { id: "c1", record: "Acme Corp", field: "MRR", notionValue: "$4,500", appValue: "$4,200", detectedAt: "5 min ago", resolved: false },
  { id: "c2", record: "Starter Co", field: "Status", notionValue: "Active", appValue: "Paused", detectedAt: "12 min ago", resolved: false },
  { id: "c3", record: "BigBrand", field: "Email", notionValue: "new@big.com", appValue: "old@big.com", detectedAt: "1 hr ago", resolved: true },
  { id: "c4", record: "TechFlow", field: "Tags", notionValue: "SaaS, Enterprise", appValue: "SaaS", detectedAt: "2 hrs ago", resolved: true },
];

const mockHistory = [
  { id: "h1", action: "Full Sync", database: "Clients", records: 48, direction: "bi-directional", duration: "3.2s", status: "success", time: "2 min ago" },
  { id: "h2", action: "Incremental Sync", database: "Tasks", records: 12, direction: "app-to-notion", duration: "1.1s", status: "success", time: "10 min ago" },
  { id: "h3", action: "Full Sync", database: "Projects", records: 32, direction: "notion-to-app", duration: "2.8s", status: "success", time: "15 min ago" },
  { id: "h4", action: "Incremental Sync", database: "Clients", records: 3, direction: "bi-directional", duration: "0.4s", status: "success", time: "30 min ago" },
  { id: "h5", action: "Full Sync", database: "Content Calendar", records: 87, direction: "bi-directional", duration: "5.1s", status: "failed", time: "1 hr ago" },
  { id: "h6", action: "Field Remap", database: "Invoices", records: 23, direction: "app-to-notion", duration: "1.9s", status: "success", time: "2 hrs ago" },
  { id: "h7", action: "Full Sync", database: "Tasks", records: 156, direction: "app-to-notion", duration: "8.4s", status: "success", time: "3 hrs ago" },
];

const mockTemplates = [
  { id: "t1", name: "Client Tracker", desc: "Full client CRM with status, MRR, health score fields", fields: 15, category: "CRM" },
  { id: "t2", name: "Project Board", desc: "Kanban-style project tracking with sprints and assignees", fields: 12, category: "Project" },
  { id: "t3", name: "Content Calendar", desc: "Social media and content planning with due dates", fields: 10, category: "Marketing" },
  { id: "t4", name: "Invoice Registry", desc: "Track invoices, amounts, due dates, and payment status", fields: 8, category: "Finance" },
  { id: "t5", name: "Meeting Notes", desc: "Structured meeting notes with action items and owners", fields: 7, category: "Operations" },
  { id: "t6", name: "Lead Pipeline", desc: "Sales pipeline with stages, value, and probability", fields: 11, category: "CRM" },
];

const mockPages = [
  { id: "p1", title: "Q2 Strategy Document", type: "page", parent: "Operations", lastEdited: "1 hr ago", icon: "doc" },
  { id: "p2", title: "Client Onboarding Checklist", type: "page", parent: "Templates", lastEdited: "3 hrs ago", icon: "check" },
  { id: "p3", title: "Weekly Standup Notes", type: "page", parent: "Meetings", lastEdited: "Today", icon: "doc" },
  { id: "p4", title: "Product Roadmap", type: "database", parent: "Product", lastEdited: "Yesterday", icon: "db" },
  { id: "p5", title: "Brand Guidelines", type: "page", parent: "Marketing", lastEdited: "2 days ago", icon: "doc" },
  { id: "p6", title: "API Documentation", type: "page", parent: "Engineering", lastEdited: "3 days ago", icon: "doc" },
  { id: "p7", title: "Revenue Dashboard", type: "database", parent: "Finance", lastEdited: "Today", icon: "db" },
];

const syncAnalytics = [
  { day: "Mon", syncs: 24, records: 312, errors: 1 },
  { day: "Tue", syncs: 31, records: 456, errors: 0 },
  { day: "Wed", syncs: 28, records: 389, errors: 2 },
  { day: "Thu", syncs: 35, records: 524, errors: 0 },
  { day: "Fri", syncs: 22, records: 278, errors: 1 },
  { day: "Sat", syncs: 8, records: 98, errors: 0 },
  { day: "Sun", syncs: 6, records: 67, errors: 0 },
];

export default function NotionSyncPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Workspaces");
  const [selectedWorkspace, setSelectedWorkspace] = useState("ws1");
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [biDirectional, setBiDirectional] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState("15");
  const [conflicts, setConflicts] = useState(mockConflicts);
  const [conflictStrategy, setConflictStrategy] = useState("ask");
  const [selectiveItems, setSelectiveItems] = useState<Record<string, boolean>>({ db1: true, db2: true, db3: true, db4: false, db5: true });
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

  const maxRecords = Math.max(...syncAnalytics.map(d => d.records));

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground/10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Notion Sync</h1>
            <p className="text-xs text-muted">Bi-directional sync between Notion workspaces and your app</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">Auto-sync</span>
            <div onClick={() => setAutoSync(!autoSync)}
              className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${autoSync ? "bg-green-400" : "bg-gray-600"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${autoSync ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </div>
          </div>
          <button className="text-xs bg-gold/10 text-gold px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 hover:bg-gold/20">
            <RefreshCw size={12} /> Sync Now
          </button>
        </div>
      </div>

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
