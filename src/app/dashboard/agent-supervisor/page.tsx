"use client";

import { useState } from "react";
import {
  Bot, Activity, CheckCircle, XCircle, Clock, RefreshCw,
  Shield, Search, Sparkles, Send, BarChart3, Star,
  Eye, CreditCard, UserPlus, Globe, Megaphone, FileText,
  ChevronDown, ChevronRight, ArrowRight, Plus, Cpu, Trash2,
  AlertTriangle, Settings, Play, Pause, GitBranch, DollarSign,
  TrendingUp, Layers, MessageSquare, History, Gauge,
  Crown
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import AgentAvatar, { pickFaceFromId } from "@/components/dashboard/agent-avatar";

/* ── Types ── */
interface Agent {
  id: string;
  name: string;
  role: string;
  status: "working" | "idle" | "error" | "paused";
  lastAction: string;
  lastActionTime: string;
  actionsToday: number;
  successRate: number;
  costToday: number;
  avgLatency: number;
  version: string;
}

interface ChainEntry {
  from: string;
  to: string;
  label: string;
  trigger: string;
  active: boolean;
}

interface TimelineEntry {
  id: string;
  agent: string;
  action: string;
  status: "success" | "error" | "pending";
  time: string;
  cost: number;
}

interface SpawnedAgent {
  id: string;
  name: string;
  role: string;
  runs: number;
  lastRun: string;
  capabilities: string[];
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  installs: number;
}

/* ── Mock Data ── */
const AGENT_ICONS: Record<string, React.ReactNode> = {
  "lead-engine": <Search size={15} />, "outreach": <Send size={15} />, "content": <Sparkles size={15} />,
  "ads": <Megaphone size={15} />, "reviews": <Star size={15} />, "analytics": <BarChart3 size={15} />,
  "trinity": <Shield size={15} />, "competitor": <Eye size={15} />, "invoice": <CreditCard size={15} />,
  "onboarding": <UserPlus size={15} />, "seo": <Globe size={15} />, "retention": <Sparkles size={15} />,
  "proposal": <FileText size={15} />, "scheduler": <Clock size={15} />,
};

const MOCK_AGENTS: Agent[] = [];

const MOCK_CHAINS: ChainEntry[] = [];

const MOCK_TIMELINE: TimelineEntry[] = [];

const MOCK_SPAWNED: SpawnedAgent[] = [];

const MOCK_TEMPLATES: AgentTemplate[] = [];

const MOCK_COMMS: { from: string; to: string; message: string; time: string; type: string }[] = [];

const TABS = ["Dashboard", "Agents", "Chains", "Timeline", "Spawned", "Marketplace", "Orchestration", "Costs", "Performance", "Failures", "Comms", "Builder"] as const;
type Tab = typeof TABS[number];

export default function AgentSupervisorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [chains, setChains] = useState<ChainEntry[]>(MOCK_CHAINS);
  const [spawned, setSpawned] = useState<SpawnedAgent[]>(MOCK_SPAWNED);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [spawnTask, setSpawnTask] = useState("");
  const [priorityQueue, setPriorityQueue] = useState<{ id: string; task: string; agent: string; priority: string; status: string; eta: string }[]>([]);
  const [builderName, setBuilderName] = useState("");
  const [builderRole, setBuilderRole] = useState("");
  const [builderTrigger, setBuilderTrigger] = useState("");
  const [builderCapabilities, setBuilderCapabilities] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "chief"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");

  const agentsWorking = agents.filter(a => a.status === "working").length;
  const agentsError = agents.filter(a => a.status === "error").length;
  const totalActionsToday = agents.reduce((sum, a) => sum + a.actionsToday, 0);
  const avgSuccessRate = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) : 0;
  const totalCostToday = agents.reduce((sum, a) => sum + a.costToday, 0);

  const filteredAgents = statusFilter === "all" ? agents : agents.filter(a => a.status === statusFilter);

  function toggleAgentStatus(id: string) {
    setAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      return { ...a, status: a.status === "paused" ? "idle" : "paused" };
    }));
  }

  function toggleChain(idx: number) {
    setChains(prev => prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c));
  }

  function spawnAgent() {
    if (!spawnTask.trim()) return;
    const newAgent: SpawnedAgent = {
      id: `s${spawned.length + 1}`,
      name: spawnTask.split(" ").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      role: spawnTask,
      runs: 0,
      lastRun: "Never",
      capabilities: ["custom task"],
    };
    setSpawned(prev => [newAgent, ...prev]);
    setSpawnTask("");
  }

  function removeSpawned(id: string) {
    setSpawned(prev => prev.filter(s => s.id !== id));
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: msg }]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "chief", content: `Analyzing "${msg}"... All ${agentsWorking} active agents performing within normal parameters. ${agentsError} agent(s) need attention. Total cost today: $${totalCostToday.toFixed(2)}.` }]);
    }, 500);
  }

  function removePriorityItem(id: string) {
    setPriorityQueue(prev => prev.filter(p => p.id !== id));
  }

  function addBuilderCapability(cap: string) {
    if (cap && !builderCapabilities.includes(cap)) {
      setBuilderCapabilities(prev => [...prev, cap]);
    }
  }

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Crown size={28} />}
        title="Agent Supervisor"
        subtitle={`${agents.length + spawned.length} agents · ${agentsWorking} active · ${agentsError > 0 ? `${agentsError} errors` : "no errors"}`}
        gradient="gold"
        actions={
          <button onClick={() => setAgents(prev => prev.map(a => ({ ...a, status: a.status === "error" ? "idle" : a.status })))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-medium hover:bg-white/25 transition-all">
            <RefreshCw size={14} /> Health Check All
          </button>
        }
      />

      {/* Stats Strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Active", value: agentsWorking, color: "text-green-400" },
          { label: "Actions Today", value: totalActionsToday, color: "text-foreground" },
          { label: "Success Rate", value: `${avgSuccessRate}%`, color: avgSuccessRate >= 90 ? "text-green-400" : "text-yellow-400" },
          { label: "Errors", value: agentsError, color: agentsError === 0 ? "text-green-400" : "text-red-400" },
          { label: "Spawned", value: spawned.length, color: "text-gold" },
          { label: "Cost Today", value: `$${totalCostToday.toFixed(2)}`, color: "text-cyan-400" },
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
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD TAB ═══ */}
      {activeTab === "Dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live Status Grid */}
          <div className="lg:col-span-2 card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity size={14} /> Live Agent Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {agents.slice(0, 8).map(a => {
                const mappedStatus: "idle" | "working" | "thinking" | "error" | "success" | "offline" =
                  a.status === "working" ? "working" :
                  a.status === "error" ? "error" :
                  a.status === "paused" ? "offline" :
                  "idle";
                return (
                  <div key={a.id} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    a.status === "working" ? "border-green-500/20 bg-green-500/5" :
                    a.status === "error" ? "border-red-500/20 bg-red-500/5" :
                    a.status === "paused" ? "border-yellow-500/20 bg-yellow-500/5" :
                    "border-border"
                  }`}>
                    <AgentAvatar
                      face={pickFaceFromId(a.id)}
                      status={mappedStatus}
                      size={72}
                    />
                    <div className="text-center">
                      <p className="text-[11px] font-semibold">{a.name}</p>
                      <p className="text-[9px] text-muted truncate max-w-[120px]">{a.lastAction}</p>
                      <div className="flex items-center justify-center gap-2 mt-1 text-[8px] text-muted">
                        <span>{a.actionsToday} actions</span>
                        <span>•</span>
                        <span>{a.successRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nexus Chat */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Nexus</h2>
              <span className="text-[8px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded-full">Online</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-[10px] text-muted mb-2">Ask about agent status or performance</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {["Agent status", "Performance report", "Any problems?"].map((s, i) => (
                      <button key={i} onClick={() => setChatInput(s)}
                        className="text-[9px] bg-surface-light px-2 py-1 rounded-lg text-muted hover:text-foreground border border-border transition-all">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[10px] ${
                    msg.role === "user" ? "bg-gold/10 border border-gold/10" : "bg-surface-light border border-border"
                  }`}>
                    {msg.role === "chief" && <p className="text-[8px] text-gold font-semibold mb-0.5">NEXUS</p>}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask Nexus..."
                className="input flex-1 text-[10px] py-1.5" />
              <button type="submit" className="px-2.5 py-1.5 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all">
                <Send size={11} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ AGENTS TAB ═══ */}
      {activeTab === "Agents" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2">
            {["all", "working", "idle", "error", "paused"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${
                  statusFilter === s ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                }`}>{s} {s !== "all" && `(${agents.filter(a => a.status === s).length})`}</button>
            ))}
          </div>

          {/* Agent Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
              <div className="col-span-3">Agent</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-3">Last Action</div>
              <div className="col-span-1 text-center">Actions</div>
              <div className="col-span-1 text-center">Rate</div>
              <div className="col-span-1 text-center">Cost</div>
              <div className="col-span-2 text-right">Controls</div>
            </div>
            {filteredAgents.map(agent => {
              const isExpanded = expandedAgent === agent.id;
              return (
                <div key={agent.id} className="border-b border-border last:border-0">
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-surface-light/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        agent.status === "error" ? "bg-red-500/10 text-red-400" :
                        agent.status === "working" ? "bg-green-500/10 text-green-400" :
                        agent.status === "paused" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-surface-light text-muted"
                      }`}>{AGENT_ICONS[agent.id] || <Bot size={15} />}</div>
                      <div>
                        <p className="text-[11px] font-medium">{agent.name}</p>
                        <p className="text-[9px] text-muted">{agent.role}</p>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        agent.status === "working" ? "bg-green-500/10 text-green-400" :
                        agent.status === "error" ? "bg-red-500/10 text-red-400" :
                        agent.status === "paused" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-gray-500/10 text-gray-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          agent.status === "working" ? "bg-green-400" : agent.status === "error" ? "bg-red-400 animate-pulse" :
                          agent.status === "paused" ? "bg-yellow-400" : "bg-gray-400"
                        }`} />
                        {agent.status}
                      </span>
                    </div>
                    <div className="col-span-3 hidden md:block">
                      <p className="text-[10px] text-muted truncate">{agent.lastAction}</p>
                      <p className="text-[8px] text-muted/60">{agent.lastActionTime}</p>
                    </div>
                    <div className="col-span-1 text-center text-[10px] font-mono">{agent.actionsToday}</div>
                    <div className="col-span-1 text-center">
                      <span className={`text-[10px] font-mono ${agent.successRate >= 90 ? "text-green-400" : agent.successRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>{agent.successRate}%</span>
                    </div>
                    <div className="col-span-1 text-center text-[10px] font-mono text-cyan-400">${agent.costToday.toFixed(2)}</div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); toggleAgentStatus(agent.id); }}
                        className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-foreground transition-all">
                        {agent.status === "paused" ? <Play size={10} /> : <Pause size={10} />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: "working" } : a)); }}
                        className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-foreground transition-all">
                        <RefreshCw size={10} />
                      </button>
                      {isExpanded ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-14 border-t border-border">
                      <div className="grid grid-cols-4 gap-4 py-3 text-[10px]">
                        <div><span className="text-muted">Avg Latency</span><p className="font-mono mt-0.5">{agent.avgLatency}ms</p></div>
                        <div><span className="text-muted">Version</span><p className="font-mono mt-0.5">{agent.version}</p></div>
                        <div>
                          <span className="text-muted">Success Rate</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 bg-surface-light rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${agent.successRate >= 90 ? "bg-green-400" : agent.successRate >= 70 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${agent.successRate}%` }} />
                            </div>
                            <span className="font-mono">{agent.successRate}%</span>
                          </div>
                        </div>
                        <div><span className="text-muted">Cost Today</span><p className="font-mono mt-0.5 text-cyan-400">${agent.costToday.toFixed(2)}</p></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ CHAINS TAB ═══ */}
      {activeTab === "Chains" && (
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Agent Chain Visualization</h2>
              <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full">{chains.filter(c => c.active).length} active</span>
            </div>
            <div className="space-y-1.5">
              {chains.map((chain, i) => (
                <div key={i} className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-all ${
                  chain.active ? "border-border" : "border-border/50 opacity-50"
                }`}>
                  <button onClick={() => toggleChain(i)}
                    className={`w-8 h-4 rounded-full transition-colors ${chain.active ? "bg-green-400" : "bg-surface-light"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mt-0.5 ${chain.active ? "ml-4" : "ml-0.5"}`} />
                  </button>
                  <span className="text-[11px] font-medium w-28 shrink-0">{chain.from}</span>
                  <ArrowRight size={12} className="text-gold shrink-0" />
                  <span className="text-[11px] font-medium text-gold w-28 shrink-0">{chain.to}</span>
                  <span className="text-[10px] text-muted flex-1 truncate">{chain.label} &rarr; {chain.trigger}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TIMELINE TAB ═══ */}
      {activeTab === "Timeline" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><History size={14} /> Activity Timeline</h2>
          <div className="space-y-2">
            {MOCK_TIMELINE.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  entry.status === "success" ? "bg-green-500/10" : entry.status === "error" ? "bg-red-500/10" : "bg-yellow-500/10"
                }`}>
                  {entry.status === "success" ? <CheckCircle size={12} className="text-green-400" /> :
                   entry.status === "error" ? <XCircle size={12} className="text-red-400" /> :
                   <Clock size={12} className="text-yellow-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium">{entry.agent}</span>
                    <span className="text-[9px] text-muted">{entry.time}</span>
                    {entry.cost > 0 && <span className="text-[9px] text-cyan-400">${entry.cost.toFixed(2)}</span>}
                  </div>
                  <p className="text-[10px] text-muted">{entry.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SPAWNED TAB ═══ */}
      {activeTab === "Spawned" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Spawned Sub-Agents</h2>
            </div>
            <p className="text-[10px] text-muted mb-3">Create specialist agents for tasks that don&apos;t fit existing agents.</p>
            <div className="flex gap-2 mb-4">
              <input value={spawnTask} onChange={e => setSpawnTask(e.target.value)} onKeyDown={e => e.key === "Enter" && spawnAgent()}
                className="input flex-1 text-xs" placeholder="Describe a task to spawn an agent for..." />
              <button onClick={spawnAgent} disabled={!spawnTask.trim()}
                className="px-4 py-2 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                <Plus size={12} /> Spawn
              </button>
            </div>
            {spawned.length > 0 ? (
              <div className="space-y-2">
                {spawned.map(agent => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-gold/20 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Cpu size={14} className="text-gold" /></div>
                      <div>
                        <p className="text-xs font-semibold">{agent.name}</p>
                        <p className="text-[9px] text-muted">{agent.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">{agent.capabilities.map((c, i) => (
                        <span key={i} className="text-[8px] bg-surface-light px-1.5 py-0.5 rounded-full text-muted border border-border">{c}</span>
                      ))}</div>
                      <div className="text-right"><p className="text-[10px] font-mono">{agent.runs}x</p><p className="text-[8px] text-muted">{agent.lastRun}</p></div>
                      <button onClick={() => removeSpawned(agent.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/5 hover:text-red-400 transition-all"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8"><Cpu size={24} className="mx-auto mb-2 text-muted/20" /><p className="text-[10px] text-muted">No sub-agents spawned yet</p></div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MARKETPLACE TAB ═══ */}
      {activeTab === "Marketplace" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-gold" /> Agent Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {MOCK_TEMPLATES.map(t => (
                <div key={t.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">{t.name}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-surface-light rounded-full text-muted">{t.category}</span>
                  </div>
                  <p className="text-[10px] text-muted mb-2">{t.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted">{t.installs} installs</span>
                    <button className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all">Install</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ORCHESTRATION TAB ═══ */}
      {activeTab === "Orchestration" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Settings size={14} className="text-gold" /> Priority Queue</h2>
            <div className="space-y-2">
              {priorityQueue.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    item.priority === "high" ? "bg-red-500/10 text-red-400" :
                    item.priority === "medium" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-blue-500/10 text-blue-400"
                  }`}>{item.priority}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{item.task}</p>
                    <p className="text-[9px] text-muted">{item.agent} &middot; ETA {item.eta}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                    item.status === "running" ? "bg-green-500/10 text-green-400" : "bg-surface-light text-muted"
                  }`}>{item.status}</span>
                  <button onClick={() => removePriorityItem(item.id)} className="text-muted hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ COSTS TAB ═══ */}
      {activeTab === "Costs" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Cost-Per-Task Tracking</h2>
            </div>
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg border border-border">
              <div><p className="text-[9px] text-muted uppercase">Today</p><p className="text-lg font-bold text-gold">${totalCostToday.toFixed(2)}</p></div>
              <div><p className="text-[9px] text-muted uppercase">This Week</p><p className="text-lg font-bold text-foreground">${(totalCostToday * 5.2).toFixed(2)}</p></div>
              <div><p className="text-[9px] text-muted uppercase">This Month</p><p className="text-lg font-bold text-foreground">${(totalCostToday * 22.5).toFixed(2)}</p></div>
              <div><p className="text-[9px] text-muted uppercase">Avg/Task</p><p className="text-lg font-bold text-cyan-400">${(totalCostToday / Math.max(totalActionsToday, 1)).toFixed(4)}</p></div>
            </div>
            <div className="space-y-2">
              {agents.sort((a, b) => b.costToday - a.costToday).map(a => (
                <div key={a.id} className="flex items-center gap-3 text-[11px]">
                  <span className="w-24 font-medium">{a.name}</span>
                  <div className="flex-1 bg-surface-light rounded-full h-2">
                    <div className="bg-gold rounded-full h-2 transition-all" style={{ width: `${(a.costToday / Math.max(totalCostToday, 0.01)) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right font-mono text-cyan-400">${a.costToday.toFixed(2)}</span>
                  <span className="w-16 text-right text-muted">{a.actionsToday} tasks</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PERFORMANCE TAB ═══ */}
      {activeTab === "Performance" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Agent Performance Comparison</h2>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
                <div className="col-span-2">Agent</div>
                <div>Actions</div>
                <div>Success</div>
                <div>Latency</div>
                <div>Cost</div>
                <div>Efficiency</div>
              </div>
              {agents.sort((a, b) => b.actionsToday - a.actionsToday).map(a => {
                const efficiency = Math.round((a.successRate * a.actionsToday) / Math.max(a.costToday * 100, 1));
                return (
                  <div key={a.id} className="grid grid-cols-7 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center">
                    <div className="col-span-2 font-medium flex items-center gap-1.5">{AGENT_ICONS[a.id] || <Bot size={12} />} {a.name}</div>
                    <div className="font-mono">{a.actionsToday}</div>
                    <div className={`font-mono ${a.successRate >= 90 ? "text-green-400" : a.successRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>{a.successRate}%</div>
                    <div className="font-mono">{a.avgLatency}ms</div>
                    <div className="font-mono text-cyan-400">${a.costToday.toFixed(2)}</div>
                    <div>
                      <div className="w-full bg-surface-light rounded-full h-1.5">
                        <div className="bg-gold rounded-full h-1.5" style={{ width: `${Math.min(efficiency * 10, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAILURES TAB ═══ */}
      {activeTab === "Failures" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="text-sm font-semibold">Failure Analysis</h2>
            </div>
            {agents.filter(a => a.status === "error" || a.successRate < 80).length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
                <p className="text-xs text-muted">No failures detected. All agents healthy.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.filter(a => a.status === "error" || a.successRate < 80).map(a => (
                  <div key={a.id} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-red-400" />
                        <span className="text-xs font-semibold">{a.name}</span>
                        <span className="text-[9px] text-red-400">{a.status === "error" ? "Active Error" : `Low Success (${a.successRate}%)`}</span>
                      </div>
                      <button onClick={() => setAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, status: "idle", successRate: 95 } : ag))}
                        className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all">Repair</button>
                    </div>
                    <p className="text-[10px] text-muted">{a.lastAction}</p>
                    <div className="mt-2 text-[9px] text-muted">Recommended: Check API credentials, verify endpoint accessibility, review rate limits</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ COMMS TAB ═══ */}
      {activeTab === "Comms" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare size={14} className="text-gold" /> Inter-Agent Communication Log</h2>
          <div className="space-y-2">
            {MOCK_COMMS.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                msg.type === "error" ? "border-red-500/20 bg-red-500/5" : "border-border"
              }`}>
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${
                  msg.type === "command" ? "bg-blue-500/10 text-blue-400" :
                  msg.type === "error" ? "bg-red-500/10 text-red-400" :
                  "bg-green-500/10 text-green-400"
                }`}>{msg.type === "command" ? "CMD" : msg.type === "error" ? "ERR" : "RES"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-medium">{msg.from}</span>
                    <ArrowRight size={10} className="text-muted" />
                    <span className="font-medium text-gold">{msg.to}</span>
                    <span className="text-muted ml-auto">{msg.time}</span>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BUILDER TAB ═══ */}
      {activeTab === "Builder" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-gold" /> Custom Agent Builder</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Agent Name</label>
                <input value={builderName} onChange={e => setBuilderName(e.target.value)} className="input w-full text-xs" placeholder="e.g. Email Validator" />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Role Description</label>
                <input value={builderRole} onChange={e => setBuilderRole(e.target.value)} className="input w-full text-xs" placeholder="e.g. Validates email deliverability" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Trigger Condition</label>
              <input value={builderTrigger} onChange={e => setBuilderTrigger(e.target.value)} className="input w-full text-xs" placeholder="e.g. When new lead is scraped" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Capabilities</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {builderCapabilities.map((c, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded-full border border-gold/20 flex items-center gap-1">
                    {c} <button onClick={() => setBuilderCapabilities(prev => prev.filter((_, j) => j !== i))} className="text-gold/50 hover:text-gold">x</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input id="cap-input" className="input flex-1 text-xs" placeholder="Add capability..."
                  onKeyDown={e => { if (e.key === "Enter") { addBuilderCapability((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
              </div>
            </div>
            <button disabled={!builderName.trim()} onClick={() => {
              setSpawned(prev => [...prev, { id: `s${prev.length + 1}`, name: builderName, role: builderRole, runs: 0, lastRun: "Never", capabilities: builderCapabilities }]);
              setBuilderName(""); setBuilderRole(""); setBuilderTrigger(""); setBuilderCapabilities([]);
            }} className="px-4 py-2 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
              <Plus size={12} /> Create Agent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
