"use client";

import { useState } from "react";
import {
  Search, Send, Sparkles, Shield, Heart, CreditCard, Activity,
  Save, RotateCcw, Zap, AlertTriangle,
  CheckCircle, Play, BarChart3, Lock, Eye, Code,
  Gauge, Layers, DollarSign, TestTube, GitBranch
} from "lucide-react";

/* ── Types ── */
interface AgentConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  schedule: string;
  rateLimit: number;
  ratePeriod: "minute" | "hour" | "day";
  priority: "critical" | "high" | "medium" | "low";
  fallbackAgent: string;
  lastRun: string;
  actionsToday: number;
  costToday: number;
  successRate: number;
}

interface PermissionRule {
  agent: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canSpawn: boolean;
  canChain: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  channel: string;
  active: boolean;
}

interface ChainRule {
  id: string;
  trigger: string;
  source: string;
  target: string;
  condition: string;
  active: boolean;
}

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  agents: string[];
  category: string;
}

/* ── Mock Data ── */
const MOCK_AGENTS: AgentConfig[] = [];

const MOCK_PERMISSIONS: PermissionRule[] = [];

const MOCK_ALERTS: AlertRule[] = [];

const MOCK_CHAINS: ChainRule[] = [];

const MOCK_INPUT_SCHEMA: SchemaField[] = [
  { name: "client_id", type: "string (UUID)", required: true, description: "Target client identifier" },
  { name: "action_type", type: "enum", required: true, description: "scrape | generate | send | analyze" },
  { name: "parameters", type: "object", required: false, description: "Action-specific parameters" },
  { name: "priority", type: "enum", required: false, description: "critical | high | medium | low" },
  { name: "callback_url", type: "string (URL)", required: false, description: "Webhook for completion notification" },
];

const MOCK_OUTPUT_SCHEMA: SchemaField[] = [
  { name: "task_id", type: "string (UUID)", required: true, description: "Unique task identifier" },
  { name: "status", type: "enum", required: true, description: "success | error | pending" },
  { name: "result", type: "object", required: false, description: "Task result data" },
  { name: "error", type: "string", required: false, description: "Error message if status is error" },
  { name: "cost", type: "number", required: true, description: "Cost in USD for this operation" },
  { name: "latency_ms", type: "number", required: true, description: "Processing time in milliseconds" },
];

const MOCK_TEMPLATES: AgentTemplate[] = [
  { id: "t1", name: "Full Sales Pipeline", description: "Lead gen -> Outreach -> Proposal -> Close", agents: ["Lead Engine", "Outreach", "Content", "Invoice"], category: "sales" },
  { id: "t2", name: "Content Machine", description: "Auto-generate and publish content weekly", agents: ["Content", "SEO", "Analytics"], category: "marketing" },
  { id: "t3", name: "Client Health Suite", description: "Monitor, retain, and re-engage clients", agents: ["Analytics", "Retention", "Invoice", "Health Monitor"], category: "retention" },
  { id: "t4", name: "Competitive Intel", description: "Track competitors and adjust strategy", agents: ["Competitor", "Content", "Analytics"], category: "intelligence" },
];

const TABS = ["Grid", "Permissions", "Rate Limits", "Chains", "Fallbacks", "Schemas", "Sandbox", "Templates", "Monitor", "Alerts", "Costs", "Comparison"] as const;
type Tab = typeof TABS[number];

export default function AgentControlsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Grid");
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [permissions, setPermissions] = useState(MOCK_PERMISSIONS);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [chains, setChains] = useState(MOCK_CHAINS);
  const [sandboxAgent, setSandboxAgent] = useState(MOCK_AGENTS[0]?.id ?? "");
  const [sandboxInput, setSandboxInput] = useState('{\n  "client_id": "c_123",\n  "action_type": "scrape",\n  "parameters": { "location": "Miami" }\n}');
  const [sandboxOutput, setSandboxOutput] = useState("");
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalCost = agents.reduce((sum, a) => sum + a.costToday, 0);
  const totalActions = agents.reduce((sum, a) => sum + a.actionsToday, 0);
  const enabledCount = agents.filter(a => a.enabled).length;
  const avgSuccess = Math.round(agents.filter(a => a.enabled).reduce((sum, a) => sum + a.successRate, 0) / Math.max(enabledCount, 1));

  function toggleAgent(id: string) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function updateAgentField(id: string, field: string, value: unknown) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  }

  function togglePermission(idx: number, field: keyof PermissionRule) {
    if (field === "agent") return;
    setPermissions(prev => prev.map((p, i) => i === idx ? { ...p, [field]: !p[field] } : p));
  }

  function toggleAlert(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }

  function toggleChain(id: string) {
    setChains(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  }

  function runSandbox() {
    setSandboxLoading(true);
    setSandboxOutput("");
    setTimeout(() => {
      const agent = agents.find(a => a.id === sandboxAgent);
      setSandboxOutput(JSON.stringify({
        task_id: `task_${Math.random().toString(36).slice(2, 10)}`,
        status: "success",
        result: { agent: agent?.name, action: "scrape", items_processed: 42, quality_score: 94 },
        cost: agent?.costToday ? (agent.costToday / Math.max(agent.actionsToday, 1)).toFixed(4) : "0.0100",
        latency_ms: Math.floor(Math.random() * 2000 + 200),
      }, null, 2));
      setSandboxLoading(false);
    }, 800);
  }

  function saveAll() {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Agent Controls</h1>
            <p className="text-xs text-muted">Customize what each agent does, when it runs, and how it behaves</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAgents(MOCK_AGENTS)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-all">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/10 text-gold text-xs font-medium border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50">
            {saving ? <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" /> : <Save size={12} />}
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Enabled", value: enabledCount, color: "text-green-400" },
          { label: "Actions Today", value: totalActions, color: "text-gold" },
          { label: "Avg Success", value: `${avgSuccess}%`, color: avgSuccess >= 90 ? "text-green-400" : "text-yellow-400" },
          { label: "Cost Today", value: `$${totalCost.toFixed(2)}`, color: "text-cyan-400" },
          { label: "Active Chains", value: chains.filter(c => c.active).length, color: "text-purple-400" },
        ].map((s, i) => (
          <div key={i} className="card p-3 text-center">
            <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
              activeTab === t ? "text-gold border-b-2 border-gold" : "text-muted hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ GRID TAB ═══ */}
      {activeTab === "Grid" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(agent => (
              <div key={agent.id} className={`card p-4 transition-all ${!agent.enabled ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${agent.enabled ? "bg-surface-light" : "bg-surface-light/50"} flex items-center justify-center`}>
                      <span className={agent.enabled ? agent.color : "text-muted"}>{agent.icon}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold">{agent.name}</p>
                      <p className="text-[8px] text-muted">Last: {agent.lastRun}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleAgent(agent.id)}
                    className={`w-10 h-5 rounded-full transition-colors ${agent.enabled ? "bg-green-400" : "bg-surface-light"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${agent.enabled ? "ml-5" : "ml-0.5"}`} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[9px]">
                  <div><span className="text-muted block">Schedule</span><span className="font-mono">{agent.schedule}</span></div>
                  <div><span className="text-muted block">Rate Limit</span><span className="font-mono">{agent.rateLimit}/{agent.ratePeriod[0]}</span></div>
                  <div><span className="text-muted block">Priority</span>
                    <span className={`capitalize ${agent.priority === "critical" ? "text-red-400" : agent.priority === "high" ? "text-orange-400" : agent.priority === "medium" ? "text-yellow-400" : "text-muted"}`}>{agent.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-[9px] text-muted">
                  <span>{agent.actionsToday} actions</span>
                  <span className={agent.successRate >= 90 ? "text-green-400" : "text-yellow-400"}>{agent.successRate}%</span>
                  <span className="text-cyan-400">${agent.costToday.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PERMISSIONS TAB ═══ */}
      {activeTab === "Permissions" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock size={14} className="text-gold" /> Permission Matrix</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
              <div className="col-span-2">Agent</div>
              <div className="text-center">Read</div>
              <div className="text-center">Write</div>
              <div className="text-center">Delete</div>
              <div className="text-center">Spawn</div>
              <div className="text-center">Chain</div>
            </div>
            {permissions.map((p, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center">
                <div className="col-span-2 font-medium">{p.agent}</div>
                {(["canRead", "canWrite", "canDelete", "canSpawn", "canChain"] as const).map(field => (
                  <div key={field} className="flex items-center justify-center">
                    <button onClick={() => togglePermission(idx, field)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        p[field] ? "bg-green-500/10 text-green-400" : "bg-surface-light text-muted"
                      }`}>
                      {p[field] ? <CheckCircle size={12} /> : <span className="w-3 h-3 rounded-full border border-border" />}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ RATE LIMITS TAB ═══ */}
      {activeTab === "Rate Limits" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Gauge size={14} className="text-gold" /> Rate Limit Controls Per Agent</h2>
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <span className={agent.color}>{agent.icon}</span>
                <span className="text-[11px] font-medium w-28">{agent.name}</span>
                <div className="flex items-center gap-2 flex-1">
                  <input type="number" value={agent.rateLimit} onChange={e => updateAgentField(agent.id, "rateLimit", parseInt(e.target.value) || 0)}
                    className="input w-20 text-[10px] py-1 text-center font-mono" min={0} max={1000} />
                  <select value={agent.ratePeriod} onChange={e => updateAgentField(agent.id, "ratePeriod", e.target.value)}
                    className="input text-[10px] py-1 w-24">
                    <option value="minute">/ minute</option>
                    <option value="hour">/ hour</option>
                    <option value="day">/ day</option>
                  </select>
                </div>
                <div className="w-32 bg-surface-light rounded-full h-2">
                  <div className="bg-gold rounded-full h-2 transition-all" style={{ width: `${Math.min((agent.actionsToday / Math.max(agent.rateLimit * (agent.ratePeriod === "day" ? 1 : agent.ratePeriod === "hour" ? 8 : 480), 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-[9px] text-muted w-16 text-right">{agent.actionsToday} used</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CHAINS TAB ═══ */}
      {activeTab === "Chains" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><GitBranch size={14} className="text-gold" /> Agent Chaining Rules</h2>
          <div className="space-y-2">
            {chains.map(chain => (
              <div key={chain.id} className={`p-3 rounded-lg border transition-all ${chain.active ? "border-border" : "border-border/50 opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleChain(chain.id)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${chain.active ? "bg-green-400" : "bg-surface-light"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${chain.active ? "ml-4" : "ml-0.5"}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-medium">{chain.source}</span>
                      <span className="text-gold font-mono text-[9px]">{chain.trigger}</span>
                      <span className="text-muted">&#8594;</span>
                      <span className="font-medium text-gold">{chain.target}</span>
                    </div>
                    <p className="text-[9px] text-muted mt-0.5">Condition: <code className="text-gold/70 bg-gold/5 px-1 rounded">{chain.condition}</code></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ FALLBACKS TAB ═══ */}
      {activeTab === "Fallbacks" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield size={14} className="text-gold" /> Fallback Rules</h2>
          <p className="text-[10px] text-muted mb-4">When an agent fails, it delegates to its fallback agent automatically.</p>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <span className={agent.color}>{agent.icon}</span>
                <span className="text-[11px] font-medium w-28">{agent.name}</span>
                <span className="text-[10px] text-muted">fails &#8594;</span>
                <select value={agent.fallbackAgent} onChange={e => updateAgentField(agent.id, "fallbackAgent", e.target.value)}
                  className="input text-[10px] py-1 w-36">
                  {agents.filter(a => a.id !== agent.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <span className="text-[9px] text-muted ml-auto">Priority: </span>
                <select value={agent.priority} onChange={e => updateAgentField(agent.id, "priority", e.target.value)}
                  className="input text-[10px] py-1 w-24">
                  {["critical", "high", "medium", "low"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SCHEMAS TAB ═══ */}
      {activeTab === "Schemas" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-gold" /> Input Schema</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
                <div>Field</div>
                <div>Type</div>
                <div>Required</div>
                <div className="col-span-2">Description</div>
              </div>
              {MOCK_INPUT_SCHEMA.map((f, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border last:border-0 text-[10px]">
                  <div className="font-mono text-gold">{f.name}</div>
                  <div className="text-muted">{f.type}</div>
                  <div>{f.required ? <CheckCircle size={12} className="text-green-400" /> : <span className="text-muted">-</span>}</div>
                  <div className="col-span-2 text-muted">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-gold" /> Output Schema</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
                <div>Field</div>
                <div>Type</div>
                <div>Required</div>
                <div className="col-span-2">Description</div>
              </div>
              {MOCK_OUTPUT_SCHEMA.map((f, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border last:border-0 text-[10px]">
                  <div className="font-mono text-gold">{f.name}</div>
                  <div className="text-muted">{f.type}</div>
                  <div>{f.required ? <CheckCircle size={12} className="text-green-400" /> : <span className="text-muted">-</span>}</div>
                  <div className="col-span-2 text-muted">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SANDBOX TAB ═══ */}
      {activeTab === "Sandbox" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TestTube size={14} className="text-gold" /> Testing Sandbox</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-1/3">
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Agent</label>
                <select value={sandboxAgent} onChange={e => setSandboxAgent(e.target.value)} className="input w-full text-xs">
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Input (JSON)</label>
                <textarea value={sandboxInput} onChange={e => setSandboxInput(e.target.value)}
                  className="input w-full text-[10px] font-mono h-28 resize-y" />
              </div>
            </div>
            <button onClick={runSandbox} disabled={sandboxLoading}
              className="px-4 py-2 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
              {sandboxLoading ? <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" /> : <Play size={12} />}
              Run Test
            </button>
            {sandboxOutput && (
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Response</p>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400 overflow-x-auto">{sandboxOutput}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TEMPLATES TAB ═══ */}
      {activeTab === "Templates" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-gold" /> Agent Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MOCK_TEMPLATES.map(t => (
              <div key={t.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{t.name}</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-surface-light rounded-full text-muted">{t.category}</span>
                </div>
                <p className="text-[10px] text-muted mb-2">{t.description}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.agents.map((a, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 bg-gold/10 text-gold rounded">{a}</span>
                  ))}
                </div>
                <button className="text-[9px] px-3 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all">Apply Template</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MONITOR TAB ═══ */}
      {activeTab === "Monitor" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity size={14} className="text-gold" /> Real-Time Monitoring Dashboard</h2>
          <div className="space-y-2">
            {agents.filter(a => a.enabled).map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <span className={`w-2.5 h-2.5 rounded-full ${agent.actionsToday > 0 ? "bg-green-400 animate-pulse" : "bg-gray-400"}`} />
                <span className={agent.color}>{agent.icon}</span>
                <span className="text-[11px] font-medium w-28">{agent.name}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-surface-light rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${agent.successRate >= 95 ? "bg-green-400" : agent.successRate >= 80 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${agent.successRate}%` }} />
                    </div>
                    <span className="text-[9px] font-mono w-10 text-right">{agent.successRate}%</span>
                  </div>
                </div>
                <span className="text-[9px] text-muted w-20 text-right">{agent.actionsToday} actions</span>
                <span className="text-[9px] text-cyan-400 w-16 text-right font-mono">${agent.costToday.toFixed(2)}</span>
                <span className="text-[9px] text-muted w-16 text-right">{agent.lastRun}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {activeTab === "Alerts" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-gold" /> Alert Configuration</h2>
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-lg border transition-all ${alert.active ? "border-border" : "border-border/50 opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleAlert(alert.id)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${alert.active ? "bg-green-400" : "bg-surface-light"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${alert.active ? "ml-4" : "ml-0.5"}`} />
                  </button>
                  <div className="flex-1">
                    <p className="text-[11px] font-medium">{alert.name}</p>
                    <p className="text-[9px] text-muted">{alert.condition}</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-surface-light rounded text-muted">{alert.action}</span>
                  <span className="text-[9px] text-muted">{alert.channel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COSTS TAB ═══ */}
      {activeTab === "Costs" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign size={14} className="text-gold" /> Cost Tracking Per Agent</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Today</p>
              <p className="text-lg font-bold text-gold">${totalCost.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Est. Monthly</p>
              <p className="text-lg font-bold">${(totalCost * 22).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Avg/Action</p>
              <p className="text-lg font-bold text-cyan-400">${(totalCost / Math.max(totalActions, 1)).toFixed(4)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {agents.sort((a, b) => b.costToday - a.costToday).map(a => (
              <div key={a.id} className="flex items-center gap-3 text-[11px]">
                <span className={a.color}>{a.icon}</span>
                <span className="w-28 font-medium">{a.name}</span>
                <div className="flex-1 bg-surface-light rounded-full h-2">
                  <div className="bg-gold rounded-full h-2 transition-all" style={{ width: `${(a.costToday / Math.max(totalCost, 0.01)) * 100}%` }} />
                </div>
                <span className="w-16 text-right font-mono text-cyan-400">${a.costToday.toFixed(2)}</span>
                <span className="w-16 text-right text-muted">{a.actionsToday} acts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COMPARISON TAB ═══ */}
      {activeTab === "Comparison" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Agent Comparison</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
              <div className="col-span-2">Agent</div>
              <div>Actions</div>
              <div>Success</div>
              <div>Cost</div>
              <div>Rate Limit</div>
              <div>Priority</div>
            </div>
            {agents.sort((a, b) => b.actionsToday - a.actionsToday).map(a => (
              <div key={a.id} className="grid grid-cols-7 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center">
                <div className="col-span-2 flex items-center gap-1.5">
                  <span className={a.color}>{a.icon}</span>
                  <span className="font-medium">{a.name}</span>
                  {!a.enabled && <span className="text-[7px] px-1 py-0.5 bg-red-500/10 text-red-400 rounded">OFF</span>}
                </div>
                <div className="font-mono">{a.actionsToday}</div>
                <div className={`font-mono ${a.successRate >= 95 ? "text-green-400" : a.successRate >= 80 ? "text-yellow-400" : "text-red-400"}`}>{a.successRate}%</div>
                <div className="font-mono text-cyan-400">${a.costToday.toFixed(2)}</div>
                <div className="font-mono">{a.rateLimit}/{a.ratePeriod[0]}</div>
                <div className={`capitalize text-[9px] ${
                  a.priority === "critical" ? "text-red-400" : a.priority === "high" ? "text-orange-400" : a.priority === "medium" ? "text-yellow-400" : "text-muted"
                }`}>{a.priority}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Save Bar */}
      <div className="sticky bottom-4 z-30">
        <button onClick={saveAll} disabled={saving}
          className="w-full px-4 py-3 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
          {saving ? <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : "Save All Agent Settings"}
        </button>
      </div>
    </div>
  );
}
