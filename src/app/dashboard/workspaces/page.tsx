"use client";

import { useState } from "react";
import {
  Building2, Plus, Users, Clock, HardDrive, Zap, Settings,
  ArrowRightLeft, Search, X, MoreHorizontal, CheckCircle,
  Globe, Shield, CreditCard, BarChart3, Crown,
  ChevronRight, Activity, Trash2, Edit3, ExternalLink
} from "lucide-react";

type WorkspaceTab = "overview" | "settings" | "usage" | "transfer";

interface Workspace {
  id: string;
  name: string;
  logo: string;
  color: string;
  status: "active" | "paused" | "archived";
  members: number;
  clients: number;
  lastActive: string;
  storage: number;
  storageLimit: number;
  apiCalls: number;
  apiLimit: number;
  teamLimit: number;
  plan: string;
  monthlyRevenue: number;
  created: string;
}

const MOCK_WORKSPACES: Workspace[] = [];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  paused: "bg-amber-500/10 text-amber-400",
  archived: "bg-gray-500/10 text-gray-400",
};

export default function WorkspacesPage() {
  const [workspaces] = useState<Workspace[]>(MOCK_WORKSPACES);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [createForm, setCreateForm] = useState({ name: "", color: "#C9A84C", logo: "" });
  const [transferClient, setTransferClient] = useState({ client: "", from: "", to: "" });

  const current = workspaces.find(w => w.id === activeWorkspace);
  const filtered = workspaces.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMembers = workspaces.reduce((s, w) => s + w.members, 0);
  const totalClients = workspaces.reduce((s, w) => s + w.clients, 0);
  const totalRevenue = workspaces.reduce((s, w) => s + w.monthlyRevenue, 0);
  const activeCount = workspaces.filter(w => w.status === "active").length;

  const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Building2 size={13} /> },
    { id: "usage", label: "Usage", icon: <BarChart3 size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> },
    { id: "transfer", label: "Transfer", icon: <ArrowRightLeft size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Building2 size={18} className="text-gold" /> Workspaces
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 uppercase tracking-wider">Enterprise</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">Manage multiple workspaces for clients and sub-agencies</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> Create Workspace
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Building2 size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Workspaces</p></div>
          <p className="text-lg font-bold">{workspaces.length}</p>
          <p className="text-[10px] text-emerald-400">{activeCount} active</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Users size={12} className="text-blue-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Total Members</p></div>
          <p className="text-lg font-bold text-blue-400">{totalMembers}</p>
          <p className="text-[10px] text-muted">across all workspaces</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Globe size={12} className="text-purple-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Total Clients</p></div>
          <p className="text-lg font-bold text-purple-400">{totalClients}</p>
          <p className="text-[10px] text-muted">managed</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><CreditCard size={12} className="text-emerald-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Combined MRR</p></div>
          <p className="text-lg font-bold text-emerald-400">${totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-muted">monthly revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workspace List */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="input w-full text-xs pl-8" placeholder="Search workspaces..." />
          </div>
          <div className="space-y-2">
            {filtered.map(ws => (
              <button key={ws.id} onClick={() => setActiveWorkspace(ws.id)}
                className={`w-full card p-3 text-left transition-all ${
                  activeWorkspace === ws.id
                    ? "border-gold/30 bg-gold/[0.03]"
                    : "hover:border-gold/10"
                }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: ws.color }}>
                    {ws.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold truncate">{ws.name}</p>
                      {activeWorkspace === ws.id && <CheckCircle size={10} className="text-gold shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[ws.status]}`}>{ws.status}</span>
                      <span className="text-[9px] text-muted">{ws.members} members</span>
                      <span className="text-[9px] text-muted">{ws.clients} clients</span>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-muted shrink-0" />
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-1 text-[9px] text-muted">
                    <Clock size={8} /> {ws.lastActive}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted">
                    <Crown size={8} className="text-gold" /> {ws.plan}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Workspace Detail */}
        <div className="lg:col-span-2 space-y-4">
          {current ? (
            <>
              {/* Workspace Header */}
              <div className="card p-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: current.color }}>
                    {current.logo}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold">{current.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[current.status]}`}>{current.status}</span>
                      <span className="text-[10px] text-muted">Created {current.created}</span>
                      <span className="text-[10px] text-muted flex items-center gap-1"><Crown size={9} className="text-gold" /> {current.plan}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="p-2 rounded-lg bg-surface-light text-muted hover:text-foreground transition-colors"><Edit3 size={13} /></button>
                    <button className="p-2 rounded-lg bg-surface-light text-muted hover:text-foreground transition-colors"><ExternalLink size={13} /></button>
                    <button className="p-2 rounded-lg bg-surface-light text-muted hover:text-foreground transition-colors"><MoreHorizontal size={13} /></button>
                  </div>
                </div>
              </div>

              {/* Detail Tabs */}
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

              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div className="card p-3 text-center">
                      <Users size={14} className="text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold">{current.members}</p>
                      <p className="text-[9px] text-muted">Team Members</p>
                    </div>
                    <div className="card p-3 text-center">
                      <Globe size={14} className="text-purple-400 mx-auto mb-1" />
                      <p className="text-lg font-bold">{current.clients}</p>
                      <p className="text-[9px] text-muted">Clients</p>
                    </div>
                    <div className="card p-3 text-center">
                      <CreditCard size={14} className="text-emerald-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-400">${current.monthlyRevenue.toLocaleString()}</p>
                      <p className="text-[9px] text-muted">Monthly Revenue</p>
                    </div>
                    <div className="card p-3 text-center">
                      <Zap size={14} className="text-gold mx-auto mb-1" />
                      <p className="text-lg font-bold text-gold">{current.apiLimit > 0 ? ((current.apiCalls / current.apiLimit) * 100).toFixed(0) : 0}%</p>
                      <p className="text-[9px] text-muted">API Usage</p>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><Activity size={13} className="text-gold" /> Recent Activity</h3>
                    <div className="space-y-2">
                      {([] as { action: string; time: string; icon: React.ReactNode }[]).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-light transition-colors">
                          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold shrink-0">{item.icon}</div>
                          <p className="text-[11px] flex-1">{item.action}</p>
                          <span className="text-[9px] text-muted shrink-0">{item.time}</span>
                        </div>
                      ))}
                      {true && <p className="text-xs text-muted text-center py-4">No recent activity</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Tab */}
              {tab === "usage" && (
                <div className="space-y-3">
                  {/* Storage */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold flex items-center gap-2"><HardDrive size={13} className="text-gold" /> Storage</h3>
                      <span className="text-[10px] text-muted">{current.storage} GB / {current.storageLimit} GB</span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(current.storage / current.storageLimit) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-muted mt-1">{((current.storage / current.storageLimit) * 100).toFixed(1)}% used</p>
                  </div>

                  {/* API Calls */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold flex items-center gap-2"><Zap size={13} className="text-blue-400" /> API Calls (this month)</h3>
                      <span className="text-[10px] text-muted">{current.apiCalls.toLocaleString()} / {current.apiLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${(current.apiCalls / current.apiLimit) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-muted mt-1">{((current.apiCalls / current.apiLimit) * 100).toFixed(1)}% of limit</p>
                  </div>

                  {/* Team Members */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold flex items-center gap-2"><Users size={13} className="text-purple-400" /> Team Members</h3>
                      <span className="text-[10px] text-muted">{current.members} / {current.teamLimit}</span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${(current.members / current.teamLimit) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-muted mt-1">{current.teamLimit - current.members} seats remaining</p>
                  </div>

                  {/* Usage Breakdown */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Usage Breakdown</h3>
                    <div className="space-y-2">
                      {([] as { label: string; used: number; limit: number; color: string }[]).map((item, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-surface-light border border-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium">{item.label}</span>
                            <span className="text-[9px] text-muted">{item.used.toLocaleString()} / {item.limit.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.limit > 0 ? (item.used / item.limit) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted text-center py-4">No usage data available</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {tab === "settings" && (
                <div className="space-y-3">
                  {/* Limits */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><Shield size={13} className="text-gold" /> Workspace Limits</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Max Team Members", value: current.teamLimit, unit: "seats" },
                        { label: "Storage Limit", value: current.storageLimit, unit: "GB" },
                        { label: "API Call Limit", value: current.apiLimit, unit: "/month" },
                        { label: "Client Limit", value: 50, unit: "clients" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                          <span className="text-[10px] font-medium">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gold">{item.value.toLocaleString()}</span>
                            <span className="text-[9px] text-muted">{item.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><Shield size={13} className="text-purple-400" /> Permissions</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Allow members to invite others", enabled: true },
                        { label: "Allow members to export data", enabled: false },
                        { label: "Allow members to manage billing", enabled: false },
                        { label: "Allow members to delete clients", enabled: false },
                        { label: "Allow members to access API keys", enabled: true },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                          <div className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${item.enabled ? "bg-emerald-400" : "bg-surface"}`}>
                            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-all mt-[1px] ${item.enabled ? "ml-4" : "ml-0.5"}`} />
                          </div>
                          <span className="text-[10px] flex-1">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billing */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><CreditCard size={13} className="text-emerald-400" /> Billing</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-surface-light border border-border">
                        <p className="text-[9px] text-muted uppercase">Current Plan</p>
                        <p className="text-sm font-bold text-gold mt-0.5">{current.plan}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light border border-border">
                        <p className="text-[9px] text-muted uppercase">Monthly Cost</p>
                        <p className="text-sm font-bold text-emerald-400 mt-0.5">$299/mo</p>
                      </div>
                    </div>
                    <button className="btn-secondary text-xs w-full mt-3 flex items-center justify-center gap-1.5">
                      <Crown size={12} /> Upgrade Plan
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="card border-red-500/20">
                    <h3 className="text-xs font-bold text-red-400 flex items-center gap-2 mb-3"><Trash2 size={13} /> Danger Zone</h3>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div>
                        <p className="text-[10px] font-semibold">Archive Workspace</p>
                        <p className="text-[9px] text-muted">Disable all activity and hide from active list</p>
                      </div>
                      <button className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">Archive</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Tab */}
              {tab === "transfer" && (
                <div className="space-y-3">
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><ArrowRightLeft size={13} className="text-gold" /> Transfer Clients Between Workspaces</h3>
                    <p className="text-[10px] text-muted mb-4">Move clients and their associated data to a different workspace. All history will be preserved.</p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client to Transfer</label>
                        <select value={transferClient.client} onChange={e => setTransferClient({ ...transferClient, client: e.target.value })} className="input w-full text-xs">
                          <option value="">Select client...</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">From Workspace</label>
                          <select value={transferClient.from} onChange={e => setTransferClient({ ...transferClient, from: e.target.value })} className="input w-full text-xs">
                            <option value="">Select source...</option>
                            {workspaces.filter(w => w.status === "active").map(w => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">To Workspace</label>
                          <select value={transferClient.to} onChange={e => setTransferClient({ ...transferClient, to: e.target.value })} className="input w-full text-xs">
                            <option value="">Select destination...</option>
                            {workspaces.filter(w => w.status === "active").map(w => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                          <Shield size={10} /> Transfer includes: client profile, content, invoices, conversations, and analytics data.
                        </p>
                      </div>
                      <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowTransfer(true)}>
                        <ArrowRightLeft size={12} /> Start Transfer
                      </button>
                    </div>
                  </div>

                  {/* Transfer History */}
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><Clock size={13} className="text-muted" /> Transfer History</h3>
                    <div className="space-y-2">
                      {([] as { client: string; from: string; to: string; date: string; status: string }[]).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                          <ArrowRightLeft size={11} className="text-gold shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold">{item.client}</p>
                            <p className="text-[9px] text-muted">{item.from} → {item.to}</p>
                          </div>
                          <span className="text-[9px] text-muted">{item.date}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{item.status}</span>
                        </div>
                      ))}
                      <p className="text-xs text-muted text-center py-4">No transfer history</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-16">
              <Building2 size={32} className="mx-auto mb-3 text-muted/30" />
              <p className="text-sm text-muted">Select a workspace to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} className="text-gold" /> Create Workspace</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Workspace Name</label>
              <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                className="input w-full text-xs" placeholder="e.g. White Label - ClientName" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Logo Initials</label>
              <input value={createForm.logo} onChange={e => setCreateForm({ ...createForm, logo: e.target.value.toUpperCase().slice(0, 2) })}
                className="input w-full text-xs" placeholder="e.g. MA" maxLength={2} />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Theme Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={createForm.color} onChange={e => setCreateForm({ ...createForm, color: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <div className="flex gap-1.5">
                  {["#C9A84C", "#3b82f6", "#10b981", "#8b5cf6", "#f43f5e", "#f59e0b"].map(c => (
                    <button key={c} onClick={() => setCreateForm({ ...createForm, color: c })}
                      className={`w-6 h-6 rounded-lg border-2 transition-all ${createForm.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            {/* Preview */}
            {createForm.name && (
              <div className="p-3 rounded-lg bg-surface-light border border-border">
                <p className="text-[9px] text-muted uppercase mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: createForm.color }}>
                    {createForm.logo || createForm.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{createForm.name}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">active</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowCreate(false)}>
                <Building2 size={12} /> Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTransfer(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
                <ArrowRightLeft size={20} className="text-gold" />
              </div>
              <h3 className="text-sm font-bold">Confirm Transfer</h3>
              <p className="text-[10px] text-muted mt-1">This will move the client and all associated data to the destination workspace.</p>
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary text-xs">Cancel</button>
              <button className="btn-primary text-xs" onClick={() => setShowTransfer(false)}>Confirm Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
