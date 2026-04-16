"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneCall, Plus, RefreshCw,
  Clock, Trash2, X, Loader2, Check,
  BarChart3, FileText, Mic, Users, AlertTriangle, Volume2,
  TrendingUp, Calendar, Shield, ArrowRight, Copy
} from "lucide-react";

/* ── Types ── */
interface VoiceAgent {
  id: string;
  name: string;
  voice: string;
  language: string;
  status: "active" | "inactive";
  callsToday: number;
  successRate: number;
  avgDuration: number;
}

interface CallRecord {
  id: string;
  agent: string;
  contactName: string;
  phone: string;
  duration: number;
  outcome: "qualified" | "callback" | "not_interested" | "voicemail" | "no_answer";
  sentiment: "positive" | "neutral" | "negative";
  startTime: string;
  cost: number;
  hasTranscript: boolean;
}

interface TranscriptEntry {
  speaker: "ai" | "human";
  text: string;
  timestamp: string;
  sentiment?: "positive" | "neutral" | "negative";
}

interface VoiceClone {
  id: string;
  name: string;
  gender: string;
  accent: string;
  sampleCount: number;
  status: "ready" | "training" | "draft";
}

interface ScriptTemplate {
  id: string;
  name: string;
  category: string;
  variables: string[];
  openRate: number;
  conversionRate: number;
}

/* ── Mock Data ── */
const MOCK_AGENTS: VoiceAgent[] = [];

const MOCK_CALLS: CallRecord[] = [];

const MOCK_TRANSCRIPT: TranscriptEntry[] = [];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MOCK_VOICES: VoiceClone[] = [];

const MOCK_SCRIPTS: ScriptTemplate[] = [];

const MOCK_CONTACTS: { id: string; name: string; count: number; lastCalled: string; status: string }[] = [];

const TABS = ["Dashboard", "Calls", "Transcripts", "Sentiment", "Voices", "Scripts", "A/B Tests", "Scheduling", "Contacts", "Analytics", "Compliance", "Transfer Rules"] as const;
type Tab = typeof TABS[number];

export default function ElevenAgentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [callFilter, setCallFilter] = useState<string>("all");
  const [scriptFilter, setScriptFilter] = useState<string>("all");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [abTestName, setAbTestName] = useState("");
  const [abScriptA, setAbScriptA] = useState("");
  const [abScriptB, setAbScriptB] = useState("");
  const [abTests, setAbTests] = useState([
    { id: "ab1", name: "Intro Hook Test", scriptA: "Direct value prop", scriptB: "Question-based hook", callsA: 50, callsB: 50, convA: 22, convB: 31, status: "running" as const },
    { id: "ab2", name: "CTA Comparison", scriptA: "Book a demo", scriptB: "Free consultation", callsA: 75, callsB: 75, convA: 28, convB: 35, status: "completed" as const },
  ]);
  const [scheduledCalls, setScheduledCalls] = useState([
    { id: "sc1", list: "Acme Dental List", agent: "ShortStack Cold Caller", time: "Tomorrow 9:00 AM", count: 25, status: "scheduled" as const },
    { id: "sc2", list: "Warm Leads Q1", agent: "Appointment Setter", time: "Tomorrow 2:00 PM", count: 15, status: "scheduled" as const },
    { id: "sc3", list: "Miami Lawyers", agent: "ShortStack Cold Caller", time: "Thu 10:00 AM", count: 30, status: "scheduled" as const },
  ]);
  const [complianceEnabled, setComplianceEnabled] = useState(true);
  const [recordingNotice, setRecordingNotice] = useState(true);
  const [dncCheck, setDncCheck] = useState(true);
  const [transferRules, setTransferRules] = useState([
    { id: "tr1", trigger: "Lead says 'speak to a person'", action: "Transfer to live agent", number: "+1 (305) 555-1000", active: true },
    { id: "tr2", trigger: "Call sentiment turns very negative", action: "Graceful exit + flag for review", number: "", active: true },
    { id: "tr3", trigger: "Lead asks about pricing", action: "Transfer to sales team", number: "+1 (305) 555-2000", active: true },
    { id: "tr4", trigger: "Lead wants to book appointment", action: "Transfer to scheduling", number: "+1 (305) 555-3000", active: false },
  ]);

  // ── Live API State ──
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [liveAgents, setLiveAgents] = useState<any[]>([]);
  const [liveConversations, setLiveConversations] = useState<any[]>([]);
  const [liveVoices, setLiveVoices] = useState<any[]>([]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [apiLoading, setApiLoading] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", firstMessage: "", systemPrompt: "", voiceId: "", maxDuration: 300 });
  const [createLoading, setCreateLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  const loadAgents = useCallback(async () => {
    setApiLoading(true);
    setApiError("");
    try {
      const [agentsRes, convosRes] = await Promise.all([
        fetch("/api/eleven-agents"),
        fetch("/api/eleven-agents/calls"),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setLiveAgents(data.agents || []);
      } else {
        const err = await agentsRes.json().catch(() => ({}));
        if (agentsRes.status !== 401 && agentsRes.status !== 403) setApiError(err.error || "Failed to load agents");
      }
      if (convosRes.ok) {
        const data = await convosRes.json();
        setLiveConversations(data.conversations || []);
      }
    } catch (err) {
      setApiError(String(err));
    }
    setApiLoading(false);
  }, []);

  const loadVoices = useCallback(async () => {
    setVoicesLoading(true);
    try {
      const res = await fetch("/api/eleven-agents/voices");
      if (res.ok) {
        const data = await res.json();
        setLiveVoices(data.voices || []);
      }
    } catch {
      // silent — voices are supplementary
    }
    setVoicesLoading(false);
  }, []);

  useEffect(() => { loadAgents(); loadVoices(); }, [loadAgents, loadVoices]);

  async function handleCreateAgent() {
    if (!createForm.name.trim()) { setApiError("Agent name is required"); return; }
    setCreateLoading(true);
    setApiError("");
    setApiSuccess("");
    try {
      const res = await fetch("/api/eleven-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_agent",
          name: createForm.name,
          firstMessage: createForm.firstMessage || undefined,
          systemPrompt: createForm.systemPrompt || undefined,
          voiceId: createForm.voiceId || undefined,
          maxDuration: createForm.maxDuration || 300,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setApiError(data.error);
      } else {
        setApiSuccess(`Agent created! ID: ${data.agentId}`);
        setShowCreateForm(false);
        setCreateForm({ name: "", firstMessage: "", systemPrompt: "", voiceId: "", maxDuration: 300 });
        loadAgents();
      }
    } catch (err) {
      setApiError(String(err));
    }
    setCreateLoading(false);
  }

  async function handleDeleteAgent(agentId: string) {
    if (!confirm("Delete this agent permanently from ElevenLabs?")) return;
    setApiError("");
    try {
      const res = await fetch("/api/eleven-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_agent", agentId }),
      });
      const data = await res.json();
      if (data.success) {
        setApiSuccess("Agent deleted");
        loadAgents();
      } else {
        setApiError("Failed to delete agent");
      }
    } catch (err) {
      setApiError(String(err));
    }
  }

  async function handleLoadDefaults() {
    setCreateForm(prev => ({
      ...prev,
      firstMessage: prev.firstMessage || "Hi! This is Alex from ShortStack. We help businesses automate their outreach. Do you have a moment to chat?",
      systemPrompt: prev.systemPrompt || "You are Alex, a friendly and professional sales representative for ShortStack. Your goal is to qualify leads and book demo appointments. Be concise, listen actively, and handle objections gracefully.",
    }));
  }

  const totalCallsToday = agents.reduce((sum, a) => sum + a.callsToday, 0);
  const avgSuccessRate = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) : 0;
  const totalCost = MOCK_CALLS.reduce((sum, c) => sum + c.cost, 0);
  const qualifiedCalls = MOCK_CALLS.filter(c => c.outcome === "qualified").length;

  const filteredCalls = callFilter === "all" ? MOCK_CALLS : MOCK_CALLS.filter(c => c.outcome === callFilter);
  const filteredScripts = scriptFilter === "all" ? MOCK_SCRIPTS : MOCK_SCRIPTS.filter(s => s.category === scriptFilter);

  const outcomeColors: Record<string, string> = {
    qualified: "bg-green-500/10 text-green-400",
    callback: "bg-blue-500/10 text-blue-400",
    not_interested: "bg-red-500/10 text-red-400",
    voicemail: "bg-yellow-500/10 text-yellow-400",
    no_answer: "bg-gray-500/10 text-gray-400",
  };

  const sentimentColors: Record<string, string> = {
    positive: "text-green-400",
    neutral: "text-yellow-400",
    negative: "text-red-400",
  };

  function toggleAgent(id: string) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: a.status === "active" ? "inactive" : "active" } : a));
  }

  function formatDuration(secs: number): string {
    if (secs === 0) return "--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function createAbTest() {
    if (!abTestName.trim()) return;
    setAbTests(prev => [...prev, {
      id: `ab${prev.length + 1}`, name: abTestName, scriptA: abScriptA || "Variant A", scriptB: abScriptB || "Variant B",
      callsA: 0, callsB: 0, convA: 0, convB: 0, status: "running" as const,
    }]);
    setAbTestName(""); setAbScriptA(""); setAbScriptB("");
  }

  function cancelScheduled(id: string) {
    setScheduledCalls(prev => prev.filter(s => s.id !== id));
  }

  function toggleTransferRule(id: string) {
    setTransferRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <PhoneCall size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ElevenAgents</h1>
            <p className="text-xs text-muted">AI voice agents for outbound cold calling &amp; inbound handling</p>
          </div>
        </div>
        <button onClick={() => { loadAgents(); loadVoices(); }} disabled={apiLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-all disabled:opacity-50">
          <RefreshCw size={12} className={apiLoading ? "animate-spin" : ""} /> {apiLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Calls Today", value: totalCallsToday, color: "text-gold" },
          { label: "Qualified", value: qualifiedCalls, color: "text-green-400" },
          { label: "Success Rate", value: `${avgSuccessRate}%`, color: avgSuccessRate >= 30 ? "text-green-400" : "text-yellow-400" },
          { label: "Active Agents", value: agents.filter(a => a.status === "active").length, color: "text-purple-400" },
          { label: "Avg Duration", value: agents.length ? `${Math.round(agents.reduce((s, a) => s + a.avgDuration, 0) / agents.length)}s` : "—", color: "text-foreground" },
          { label: "Cost Today", value: `$${totalCost.toFixed(2)}`, color: "text-cyan-400" },
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

      {/* ═══ DASHBOARD TAB ═══ */}
      {activeTab === "Dashboard" && (
        <div className="space-y-4">
          {/* Error / Success Banners */}
          {apiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-[11px]">
              <AlertTriangle size={14} />
              <span className="flex-1">{apiError}</span>
              <button onClick={() => setApiError("")} className="hover:text-red-300"><X size={12} /></button>
            </div>
          )}
          {apiSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 text-[11px]">
              <Check size={14} />
              <span className="flex-1">{apiSuccess}</span>
              <button onClick={() => setApiSuccess("")} className="hover:text-green-300"><X size={12} /></button>
            </div>
          )}

          {/* ── Live Agents from ElevenLabs API ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Phone size={14} /> Your Agents
                {apiLoading && <Loader2 size={12} className="animate-spin text-muted" />}
                <span className="text-[9px] text-muted font-normal">({liveAgents.length} from ElevenLabs)</span>
              </h2>
              <button onClick={() => { setShowCreateForm(!showCreateForm); if (!showCreateForm) handleLoadDefaults(); }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                {showCreateForm ? <><X size={10} /> Cancel</> : <><Plus size={10} /> New Agent</>}
              </button>
            </div>

            {/* ── Create Agent Form ── */}
            {showCreateForm && (
              <div className="mb-4 p-4 rounded-lg border border-gold/20 bg-gold/5 space-y-3">
                <h3 className="text-xs font-semibold text-gold">Create New ElevenLabs Agent</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-muted uppercase block mb-1">Agent Name *</label>
                    <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      className="input text-xs w-full" placeholder="e.g. ShortStack Cold Caller" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted uppercase block mb-1">Max Call Duration (seconds)</label>
                    <input type="number" value={createForm.maxDuration} onChange={e => setCreateForm(f => ({ ...f, maxDuration: parseInt(e.target.value) || 300 }))}
                      className="input text-xs w-full" placeholder="300" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase block mb-1">First Message</label>
                  <input value={createForm.firstMessage} onChange={e => setCreateForm(f => ({ ...f, firstMessage: e.target.value }))}
                    className="input text-xs w-full" placeholder="Hi! This is Alex from ShortStack..." />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase block mb-1">System Prompt (AI Personality &amp; Script)</label>
                  <textarea value={createForm.systemPrompt} onChange={e => setCreateForm(f => ({ ...f, systemPrompt: e.target.value }))}
                    className="input text-xs w-full h-32 resize-y" placeholder="You are Alex, a friendly sales rep..." />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase block mb-1">Voice ID (optional — defaults to Rachel)</label>
                  <input value={createForm.voiceId} onChange={e => setCreateForm(f => ({ ...f, voiceId: e.target.value }))}
                    className="input text-xs w-full" placeholder="21m00Tcm4TlvDq8ikWAM" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCreateAgent} disabled={createLoading || !createForm.name.trim()}
                    className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center gap-2">
                    {createLoading ? <><Loader2 size={12} className="animate-spin" /> Creating...</> : <><Plus size={12} /> Create Agent</>}
                  </button>
                  <button onClick={handleLoadDefaults} className="px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-all">
                    Load Default Script
                  </button>
                </div>
              </div>
            )}

            {/* ── Live Agent Cards ── */}
            {liveAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveAgents.map((agent: Record<string, unknown>) => {
                  const agentId = (agent.agent_id || agent.id || "") as string;
                  const name = (agent.name || "Unnamed Agent") as string;
                  const convConfig = agent.conversation_config as Record<string, unknown> | undefined;
                  const agentConfig = convConfig?.agent as Record<string, unknown> | undefined;
                  const ttsConfig = convConfig?.tts as Record<string, unknown> | undefined;
                  const language = (agentConfig?.language || "en") as string;
                  const voiceId = (ttsConfig?.voice_id || "default") as string;
                  return (
                    <div key={agentId} className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Phone size={14} className="text-purple-400" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold">{name}</p>
                            <p className="text-[9px] text-muted font-mono">{agentId.slice(0, 16)}...</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteAgent(agentId)}
                          className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[9px] text-muted">
                        <div><span className="block text-[8px] uppercase">Language</span><span className="text-foreground font-mono">{language}</span></div>
                        <div><span className="block text-[8px] uppercase">Voice</span><span className="text-foreground font-mono">{voiceId.slice(0, 10)}</span></div>
                        <div><span className="block text-[8px] uppercase">Status</span><span className="text-green-400 font-mono">Live</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !apiLoading ? (
              <div className="p-6 text-center border border-dashed border-border rounded-lg">
                <Phone size={24} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted mb-2">No agents found on ElevenLabs</p>
                <button onClick={() => { setShowCreateForm(true); handleLoadDefaults(); }}
                  className="text-[10px] px-3 py-1.5 bg-gold/10 text-gold rounded-lg border border-gold/20 hover:bg-gold/20 transition-all">
                  Create Your First Agent
                </button>
              </div>
            ) : null}
          </div>

          {/* ── Demo Agents (local state) ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Phone size={14} /> Quick Agent Profiles <span className="text-[9px] text-muted font-normal">(local config)</span></h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map(agent => (
                <div key={agent.id} className={`p-3 rounded-lg border transition-all ${
                  agent.status === "active" ? "border-purple-500/20 bg-purple-500/5" : "border-border"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Phone size={14} className="text-purple-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold">{agent.name}</p>
                        <p className="text-[9px] text-muted">{agent.voice}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleAgent(agent.id)}
                      className={`w-9 h-5 rounded-full transition-colors ${agent.status === "active" ? "bg-green-400" : "bg-surface-light"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${agent.status === "active" ? "ml-4" : "ml-0.5"}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px] text-muted">
                    <div><span className="block text-[8px] uppercase">Calls</span><span className="text-foreground font-mono">{agent.callsToday}</span></div>
                    <div><span className="block text-[8px] uppercase">Success</span><span className={`font-mono ${agent.successRate >= 30 ? "text-green-400" : "text-yellow-400"}`}>{agent.successRate}%</span></div>
                    <div><span className="block text-[8px] uppercase">Avg Time</span><span className="text-foreground font-mono">{formatDuration(agent.avgDuration)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Conversations from API ── */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Conversations {liveConversations.length > 0 && <span className="text-[9px] text-muted font-normal">({liveConversations.length} from API)</span>}</h2>
            {liveConversations.length > 0 ? (
              <div className="space-y-1.5">
                {liveConversations.slice(0, 10).map((convo: Record<string, unknown>, i: number) => {
                  const convId = (convo.conversation_id || convo.id || "") as string;
                  const status = (convo.status || "unknown") as string;
                  const agentId = (convo.agent_id || "") as string;
                  return (
                    <div key={convId || i} className="flex items-center gap-3 p-2 rounded-lg border border-border text-[10px]">
                      <span className={`w-2 h-2 rounded-full ${status === "done" ? "bg-green-400" : status === "failed" ? "bg-red-400" : "bg-yellow-400"}`} />
                      <span className="font-mono text-muted w-40 truncate">{convId}</span>
                      <span className="text-muted w-24 truncate">Agent: {agentId.slice(0, 8)}...</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                        status === "done" ? "bg-green-500/10 text-green-400" : status === "failed" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                      }`}>{status}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {MOCK_CALLS.slice(0, 5).map(call => (
                  <div key={call.id} className="flex items-center gap-3 p-2 rounded-lg border border-border text-[10px]">
                    <span className={`w-2 h-2 rounded-full ${call.sentiment === "positive" ? "bg-green-400" : call.sentiment === "negative" ? "bg-red-400" : "bg-yellow-400"}`} />
                    <span className="font-medium w-32">{call.contactName}</span>
                    <span className="text-muted font-mono w-28">{call.phone}</span>
                    <span className="text-muted w-12">{formatDuration(call.duration)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] ${outcomeColors[call.outcome]}`}>{call.outcome.replace("_", " ")}</span>
                    <span className="text-muted ml-auto">{call.startTime}</span>
                  </div>
                ))}
                <p className="text-[9px] text-muted text-center mt-2">Showing demo data — create an agent and make calls to see live data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CALLS TAB ═══ */}
      {activeTab === "Calls" && (
        <div className="space-y-3">
          {liveConversations.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <PhoneCall size={14} /> Call History
                  <span className="text-[9px] text-muted font-normal">({liveConversations.length} conversations)</span>
                </h2>
                <button onClick={() => loadAgents()} disabled={apiLoading}
                  className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all disabled:opacity-50 flex items-center gap-1">
                  <RefreshCw size={10} className={apiLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
                  <div>Conversation ID</div>
                  <div>Agent</div>
                  <div>Status</div>
                  <div>Duration</div>
                  <div>Started</div>
                </div>
                {liveConversations.map((convo: Record<string, unknown>, i: number) => {
                  const convId = (convo.conversation_id || convo.id || "") as string;
                  const status = (convo.status || "unknown") as string;
                  const agentId = (convo.agent_id || "") as string;
                  const startTime = convo.start_time_unix_secs
                    ? new Date((convo.start_time_unix_secs as number) * 1000).toLocaleString()
                    : (convo.created_at as string) || "";
                  const callDuration = (convo.call_duration_secs as number) || 0;
                  return (
                    <div key={convId || i} className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center hover:bg-surface-light/50">
                      <div className="font-mono text-muted truncate">{convId}</div>
                      <div className="text-muted truncate">{agentId ? `${agentId.slice(0, 12)}...` : "---"}</div>
                      <div>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                          status === "done" ? "bg-green-500/10 text-green-400" : status === "failed" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                        }`}>{status}</span>
                      </div>
                      <div className="font-mono">{callDuration > 0 ? formatDuration(callDuration) : "---"}</div>
                      <div className="text-muted">{startTime}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {["all", "qualified", "callback", "not_interested", "voicemail", "no_answer"].map(f => (
                  <button key={f} onClick={() => setCallFilter(f)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${
                      callFilter === f ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                    }`}>{f.replace("_", " ")}</button>
                ))}
              </div>
              {filteredCalls.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-8 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
                    <div className="col-span-2">Contact</div>
                    <div>Agent</div>
                    <div>Duration</div>
                    <div>Outcome</div>
                    <div>Sentiment</div>
                    <div>Cost</div>
                    <div>Time</div>
                  </div>
                  {filteredCalls.map(call => (
                    <div key={call.id} className="grid grid-cols-8 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center hover:bg-surface-light/50 cursor-pointer"
                      onClick={() => setSelectedCall(selectedCall === call.id ? null : call.id)}>
                      <div className="col-span-2">
                        <p className="font-medium">{call.contactName}</p>
                        <p className="text-[9px] text-muted font-mono">{call.phone}</p>
                      </div>
                      <div className="text-muted truncate">{call.agent}</div>
                      <div className="font-mono">{formatDuration(call.duration)}</div>
                      <div><span className={`px-1.5 py-0.5 rounded text-[8px] ${outcomeColors[call.outcome]}`}>{call.outcome.replace("_", " ")}</span></div>
                      <div className={sentimentColors[call.sentiment]}>{call.sentiment}</div>
                      <div className="font-mono text-cyan-400">${call.cost.toFixed(2)}</div>
                      <div className="text-muted">{call.startTime}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-border rounded-lg">
                  <PhoneCall size={24} className="text-muted mx-auto mb-2" />
                  <p className="text-xs text-muted">No call history yet</p>
                  <p className="text-[10px] text-muted mt-1">Create an agent and make calls to see live data here</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TRANSCRIPTS TAB ═══ */}
      {activeTab === "Transcripts" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Call Transcript Viewer</h2>
            </div>
            <div className="flex gap-2 mb-4">
              <select className="input text-xs w-64">
                {MOCK_CALLS.filter(c => c.hasTranscript).map(c => (
                  <option key={c.id}>{c.contactName} - {c.startTime}</option>
                ))}
              </select>
              <button className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all flex items-center gap-1">
                <Copy size={10} /> Copy
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {MOCK_TRANSCRIPT.map((entry, i) => (
                <div key={i} className={`flex gap-3 ${entry.speaker === "ai" ? "" : "flex-row-reverse"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    entry.speaker === "ai" ? "bg-purple-500/10" : "bg-blue-500/10"
                  }`}>
                    {entry.speaker === "ai" ? <Phone size={12} className="text-purple-400" /> : <Users size={12} className="text-blue-400" />}
                  </div>
                  <div className={`max-w-[70%] p-3 rounded-lg ${
                    entry.speaker === "ai" ? "bg-purple-500/5 border border-purple-500/10" : "bg-blue-500/5 border border-blue-500/10"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-bold uppercase text-muted">{entry.speaker === "ai" ? "AI Agent" : "Lead"}</span>
                      <span className="text-[8px] text-muted font-mono">{entry.timestamp}</span>
                      {entry.sentiment && <span className={`text-[8px] ${sentimentColors[entry.sentiment]}`}>{entry.sentiment}</span>}
                    </div>
                    <p className="text-[10px] leading-relaxed">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SENTIMENT TAB ═══ */}
      {activeTab === "Sentiment" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-gold" /> Sentiment Analysis</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: "Positive", count: MOCK_CALLS.filter(c => c.sentiment === "positive").length, color: "text-green-400", bg: "bg-green-500/10" },
                { label: "Neutral", count: MOCK_CALLS.filter(c => c.sentiment === "neutral").length, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                { label: "Negative", count: MOCK_CALLS.filter(c => c.sentiment === "negative").length, color: "text-red-400", bg: "bg-red-500/10" },
              ].map((s, i) => (
                <div key={i} className={`p-4 rounded-lg border border-border ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-muted mt-1">{s.label} calls</p>
                  <div className="w-full bg-surface-light rounded-full h-2 mt-2">
                    <div className={`h-2 rounded-full ${s.color.replace("text-", "bg-")}`} style={{ width: `${(s.count / MOCK_CALLS.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {MOCK_CALLS.map(call => (
                <div key={call.id} className="flex items-center gap-3 p-2 rounded-lg border border-border text-[10px]">
                  <span className={`w-3 h-3 rounded-full ${
                    call.sentiment === "positive" ? "bg-green-400" : call.sentiment === "negative" ? "bg-red-400" : "bg-yellow-400"
                  }`} />
                  <span className="font-medium w-32">{call.contactName}</span>
                  <span className={sentimentColors[call.sentiment]}>{call.sentiment}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] ${outcomeColors[call.outcome]}`}>{call.outcome.replace("_", " ")}</span>
                  <span className="text-muted ml-auto">{formatDuration(call.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ VOICES TAB ═══ */}
      {activeTab === "Voices" && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Mic size={14} className="text-gold" /> ElevenLabs Voices
              {voicesLoading && <Loader2 size={12} className="animate-spin text-muted" />}
              <span className="text-[9px] text-muted font-normal">({liveVoices.length} available)</span>
            </h2>
            <button onClick={() => loadVoices()} disabled={voicesLoading}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all disabled:opacity-50 flex items-center gap-1">
              <RefreshCw size={10} className={voicesLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          <div className="space-y-2">
            {liveVoices.length > 0 ? liveVoices.map((v: Record<string, unknown>) => {
              const voiceId = (v.voice_id || v.id || "") as string;
              const name = (v.name || "Unnamed") as string;
              const labels = v.labels as Record<string, string> | undefined;
              const category = (v.category || "") as string;
              const gender = labels?.gender || labels?.Gender || "";
              const accent = labels?.accent || labels?.Accent || "";
              const useCase = labels?.use_case || labels?.["use case"] || "";
              return (
                <div key={voiceId} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Volume2 size={16} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium">{name}</p>
                    <p className="text-[9px] text-muted truncate">
                      {[gender, accent, useCase, category].filter(Boolean).join(" \u00b7 ")}
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">ready</span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(voiceId);
                    setApiSuccess(`Copied voice ID: ${voiceId}`);
                    setTimeout(() => setApiSuccess(""), 2000);
                  }}
                    className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-foreground transition-all flex items-center gap-1">
                    <Copy size={10} /> Copy ID
                  </button>
                </div>
              );
            }) : !voicesLoading ? (
              <div className="p-6 text-center border border-dashed border-border rounded-lg">
                <Volume2 size={24} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">No voices loaded</p>
                <button onClick={() => loadVoices()}
                  className="mt-2 text-[10px] px-3 py-1.5 bg-gold/10 text-gold rounded-lg border border-gold/20 hover:bg-gold/20 transition-all">
                  Load Voices
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ═══ SCRIPTS TAB ═══ */}
      {activeTab === "Scripts" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {["all", "cold-call", "follow-up", "reminder", "reactivation", "retention"].map(f => (
              <button key={f} onClick={() => setScriptFilter(f)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${
                  scriptFilter === f ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                }`}>{f.replace("-", " ")}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredScripts.map(s => (
              <div key={s.id} className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{s.name}</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-surface-light rounded-full text-muted">{s.category}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {s.variables.map((v, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 bg-gold/10 text-gold rounded font-mono">{`{${v}}`}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[9px] text-muted">
                  <span>Open: <span className="text-green-400">{s.openRate}%</span></span>
                  <span>Convert: <span className="text-gold">{s.conversionRate}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ A/B TESTS TAB ═══ */}
      {activeTab === "A/B Tests" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">A/B Script Testing</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <input value={abTestName} onChange={e => setAbTestName(e.target.value)} className="input text-xs" placeholder="Test name" />
              <input value={abScriptA} onChange={e => setAbScriptA(e.target.value)} className="input text-xs" placeholder="Script A description" />
              <div className="flex gap-2">
                <input value={abScriptB} onChange={e => setAbScriptB(e.target.value)} className="input flex-1 text-xs" placeholder="Script B" />
                <button onClick={createAbTest} disabled={!abTestName.trim()} className="px-3 py-1.5 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50">Create</button>
              </div>
            </div>
            <div className="space-y-3">
              {abTests.map(test => {
                const totalA = test.callsA > 0 ? Math.round((test.convA / test.callsA) * 100) : 0;
                const totalB = test.callsB > 0 ? Math.round((test.convB / test.callsB) * 100) : 0;
                const winner = totalA > totalB ? "A" : totalB > totalA ? "B" : "tie";
                return (
                  <div key={test.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{test.name}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                        test.status === "running" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                      }`}>{test.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-2 rounded border ${winner === "A" ? "border-green-500/20 bg-green-500/5" : "border-border"}`}>
                        <p className="text-[9px] font-bold text-muted">Script A: {test.scriptA}</p>
                        <p className="text-sm font-bold mt-1">{totalA}% <span className="text-[9px] text-muted font-normal">({test.convA}/{test.callsA})</span></p>
                      </div>
                      <div className={`p-2 rounded border ${winner === "B" ? "border-green-500/20 bg-green-500/5" : "border-border"}`}>
                        <p className="text-[9px] font-bold text-muted">Script B: {test.scriptB}</p>
                        <p className="text-sm font-bold mt-1">{totalB}% <span className="text-[9px] text-muted font-normal">({test.convB}/{test.callsB})</span></p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCHEDULING TAB ═══ */}
      {activeTab === "Scheduling" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar size={14} className="text-gold" /> Call Scheduling</h2>
          <div className="space-y-2">
            {scheduledCalls.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Clock size={14} className="text-gold shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-medium">{s.list}</p>
                  <p className="text-[9px] text-muted">{s.agent} &middot; {s.count} calls &middot; {s.time}</p>
                </div>
                <span className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{s.status}</span>
                <button onClick={() => cancelScheduled(s.id)} className="text-[9px] px-2 py-1 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CONTACTS TAB ═══ */}
      {activeTab === "Contacts" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} className="text-gold" /> Contact Lists</h2>
          <div className="space-y-2">
            {MOCK_CONTACTS.map(list => (
              <div key={list.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1">
                  <p className="text-[11px] font-medium">{list.name}</p>
                  <p className="text-[9px] text-muted">{list.count} contacts &middot; Last called: {list.lastCalled}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  list.status === "active" ? "bg-green-500/10 text-green-400" :
                  list.status === "completed" ? "bg-blue-500/10 text-blue-400" :
                  list.status === "new" ? "bg-gold/10 text-gold" :
                  "bg-surface-light text-muted"
                }`}>{list.status}</span>
                <button className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                  <PhoneCall size={9} /> Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Call Analytics</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-muted uppercase mb-2">Outcome Distribution</p>
                {["qualified", "callback", "not_interested", "voicemail", "no_answer"].map(outcome => {
                  const count = MOCK_CALLS.filter(c => c.outcome === outcome).length;
                  return (
                    <div key={outcome} className="flex items-center gap-2 mb-1.5 text-[10px]">
                      <span className="w-28 capitalize">{outcome.replace("_", " ")}</span>
                      <div className="flex-1 bg-surface-light rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${
                          outcome === "qualified" ? "bg-green-400" : outcome === "callback" ? "bg-blue-400" :
                          outcome === "not_interested" ? "bg-red-400" : outcome === "voicemail" ? "bg-yellow-400" : "bg-gray-400"
                        }`} style={{ width: `${(count / MOCK_CALLS.length) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>

              <div>
                <p className="text-[9px] text-muted uppercase mb-2">Agent Performance</p>
                {agents.map(a => (
                  <div key={a.id} className="flex items-center gap-2 mb-1.5 text-[10px]">
                    <span className="w-36 font-medium">{a.name}</span>
                    <div className="flex-1 bg-surface-light rounded-full h-2.5">
                      <div className="bg-purple-400 h-2.5 rounded-full" style={{ width: `${(a.callsToday / Math.max(...agents.map(x => x.callsToday), 1)) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono">{a.callsToday}</span>
                    <span className="w-12 text-right text-green-400 font-mono">{a.successRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ COMPLIANCE TAB ═══ */}
      {activeTab === "Compliance" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield size={14} className="text-gold" /> Compliance Settings</h2>
          <div className="space-y-3">
            {[
              { label: "Recording Notice", desc: "Play 'this call may be recorded' at start", state: recordingNotice, toggle: () => setRecordingNotice(!recordingNotice) },
              { label: "DNC List Check", desc: "Check against Do Not Call registry before dialing", state: dncCheck, toggle: () => setDncCheck(!dncCheck) },
              { label: "TCPA Compliance", desc: "Ensure all calls comply with TCPA regulations", state: complianceEnabled, toggle: () => setComplianceEnabled(!complianceEnabled) },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-[11px] font-medium">{item.label}</p>
                  <p className="text-[9px] text-muted">{item.desc}</p>
                </div>
                <button onClick={item.toggle}
                  className={`w-10 h-5 rounded-full transition-colors ${item.state ? "bg-green-400" : "bg-surface-light"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${item.state ? "ml-5" : "ml-0.5"}`} />
                </button>
              </div>
            ))}
            <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} className="text-yellow-400" />
                <span className="text-[10px] font-semibold text-yellow-400">Important</span>
              </div>
              <p className="text-[10px] text-muted">Ensure all AI voice agents comply with local and federal regulations. Always disclose that the call is from an AI system when required by law.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRANSFER RULES TAB ═══ */}
      {activeTab === "Transfer Rules" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowRight size={14} className="text-gold" /> Call Transfer Rules</h2>
          <div className="space-y-2">
            {transferRules.map(rule => (
              <div key={rule.id} className={`p-3 rounded-lg border transition-all ${rule.active ? "border-border" : "border-border/50 opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleTransferRule(rule.id)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${rule.active ? "bg-green-400" : "bg-surface-light"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                  </button>
                  <div className="flex-1">
                    <p className="text-[10px] font-medium">{rule.trigger}</p>
                    <p className="text-[9px] text-muted">{rule.action} {rule.number && `(${rule.number})`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
