"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneCall, Plus, RefreshCw,
  Clock, Trash2, X, Loader2, Check,
  BarChart3, FileText, Mic, Users, AlertTriangle, Volume2,
  TrendingUp, Calendar, Shield, ArrowRight, Copy
} from "lucide-react";
import { motion } from "framer-motion";
import PageHero from "@/components/ui/page-hero";

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


const TABS = ["Dashboard", "Calls", "Transcripts", "Sentiment", "Voices", "Scripts", "A/B Tests", "Scheduling", "Contacts", "Analytics", "Compliance", "Transfer Rules"] as const;
type Tab = typeof TABS[number];

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

export default function ElevenAgentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [callFilter, setCallFilter] = useState<string>("all");
  const [scriptFilter, setScriptFilter] = useState<string>("all");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [abTestName, setAbTestName] = useState("");
  const [abScriptA, setAbScriptA] = useState("");
  const [abScriptB, setAbScriptB] = useState("");
  const [abTests, setAbTests] = useState<{ id: string; name: string; scriptA: string; scriptB: string; callsA: number; callsB: number; convA: number; convB: number; status: "running" | "completed" }[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<{ id: string; list: string; agent: string; time: string; count: number; status: "scheduled" }[]>([]);
  const [complianceEnabled, setComplianceEnabled] = useState(true);
  const [recordingNotice, setRecordingNotice] = useState(true);
  const [dncCheck, setDncCheck] = useState(true);
  const [transferRules, setTransferRules] = useState<{ id: string; trigger: string; action: string; number: string; active: boolean }[]>([]);

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
  const totalCost = 0;
  const qualifiedCalls = 0;

  const filteredCalls: CallRecord[] = [];
  const filteredScripts: ScriptTemplate[] = [];

  const outcomeColors: Record<string, string> = {
    qualified: "bg-green-50 text-green-700",
    callback: "bg-blue-50 text-blue-700",
    not_interested: "bg-red-50 text-red-700",
    voicemail: "bg-amber-50 text-amber-700",
    no_answer: "bg-gray-100 text-gray-600",
  };

  const sentimentColors: Record<string, string> = {
    positive: "text-green-700",
    neutral: "text-amber-700",
    negative: "text-red-700",
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
      <PageHero
        eyebrow="VOICE AGENTS"
        icon={<Phone size={28} />}
        title="ElevenAgents"
        subtitle="AI voice agents for cold calls & inbound."
        gradient="gold"
        actions={
          <button onClick={() => { loadAgents(); loadVoices(); }} disabled={apiLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-medium hover:bg-white/25 transition-all disabled:opacity-50">
            <RefreshCw size={12} className={apiLoading ? "animate-spin" : ""} /> {apiLoading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {/* Stats Strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Calls Today", value: totalCallsToday, color: "text-[#2563EB]" },
          { label: "Qualified", value: qualifiedCalls, color: "text-green-700" },
          { label: "Success Rate", value: `${avgSuccessRate}%`, color: avgSuccessRate >= 30 ? "text-green-700" : "text-amber-700" },
          { label: "Active Agents", value: agents.filter(a => a.status === "active").length, color: "text-[#374151]" },
          { label: "Avg Duration", value: agents.length ? `${Math.round(agents.reduce((s, a) => s + a.avgDuration, 0) / agents.length)}s` : "---", color: "text-[#374151]" },
          { label: "Cost Today", value: `$${totalCost.toFixed(2)}`, color: "text-[#2563EB]" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }} className="glass rounded-xl overflow-hidden text-center">
            <div style={{ height: 3, background: "linear-gradient(90deg, #2563EB, #8b5cf6, #ec4899, #f97316, #2563EB)" }} />
            <div className="p-3">
              <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-[rgba(0,0,0,0.08)] overflow-x-auto pb-px">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
              activeTab === t ? "text-[#2563EB] border-b-2 border-[#2563EB]" : "text-[#6B7280] hover:text-[#374151]"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ DASHBOARD TAB ═══ */}
      {activeTab === "Dashboard" && (
        <div className="space-y-4">
          {/* Error / Success Banners */}
          {apiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11px]">
              <AlertTriangle size={14} />
              <span className="flex-1">{apiError}</span>
              <button onClick={() => setApiError("")} className="hover:text-red-900"><X size={12} /></button>
            </div>
          )}
          {apiSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-[11px]">
              <Check size={14} />
              <span className="flex-1">{apiSuccess}</span>
              <button onClick={() => setApiSuccess("")} className="hover:text-green-900"><X size={12} /></button>
            </div>
          )}

          {/* ── Live Agents from ElevenLabs API ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Phone size={14} /> Your Agents
                {apiLoading && <Loader2 size={12} className="animate-spin text-muted" />}
                <span className="text-[9px] text-muted font-normal">({liveAgents.length} from ElevenLabs)</span>
              </h2>
              <button onClick={() => { setShowCreateForm(!showCreateForm); if (!showCreateForm) handleLoadDefaults(); }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-[rgba(37,99,235,0.08)] text-[#2563EB] border border-[rgba(37,99,235,0.25)] hover:bg-[rgba(37,99,235,0.14)] transition-all flex items-center gap-1">
                {showCreateForm ? <><X size={10} /> Cancel</> : <><Plus size={10} /> New Agent</>}
              </button>
            </div>

            {/* ── Create Agent Form ── */}
            {showCreateForm && (
              <div className="mb-4 p-4 rounded-lg border border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] space-y-3">
                <h3 className="text-xs font-semibold text-[#2563EB]">Create New ElevenLabs Agent</h3>
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
                    className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-all disabled:opacity-50 flex items-center gap-2">
                    {createLoading ? <><Loader2 size={12} className="animate-spin" /> Creating...</> : <><Plus size={12} /> Create Agent</>}
                  </button>
                  <button onClick={handleLoadDefaults} className="px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] text-xs text-[#6B7280] hover:text-[#374151] transition-all">
                    Load Default Script
                  </button>
                </div>
              </div>
            )}

            {/* ── Live Agent Cards ── */}
            {liveAgents.length > 0 ? (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveAgents.map((agent: Record<string, unknown>) => {
                  const agentId = (agent.agent_id || agent.id || "") as string;
                  const name = (agent.name || "Unnamed Agent") as string;
                  const convConfig = agent.conversation_config as Record<string, unknown> | undefined;
                  const agentConfig = convConfig?.agent as Record<string, unknown> | undefined;
                  const ttsConfig = convConfig?.tts as Record<string, unknown> | undefined;
                  const language = (agentConfig?.language || "en") as string;
                  const voiceId = (ttsConfig?.voice_id || "default") as string;
                  return (
                    <motion.div key={agentId} variants={itemVariants} className="p-3 rounded-lg border border-[rgba(37,99,235,0.14)] bg-[rgba(37,99,235,0.04)] transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
                            <Phone size={14} className="text-[#2563EB]" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold">{name}</p>
                            <p className="text-[9px] text-muted font-mono">{agentId.slice(0, 16)}...</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteAgent(agentId)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[9px] text-[#6B7280]">
                        <div><span className="block text-[8px] uppercase">Language</span><span className="text-[#111827] font-mono">{language}</span></div>
                        <div><span className="block text-[8px] uppercase">Voice</span><span className="text-[#111827] font-mono">{voiceId.slice(0, 10)}</span></div>
                        <div><span className="block text-[8px] uppercase">Status</span><span className="text-green-700 font-mono">Live</span></div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : !apiLoading ? (
              <div className="p-6 text-center border border-dashed border-[rgba(0,0,0,0.12)] rounded-lg">
                <Phone size={24} className="text-[#9CA3AF] mx-auto mb-2" />
                <p className="text-xs text-[#6B7280] mb-2">No agents found on ElevenLabs</p>
                <button onClick={() => { setShowCreateForm(true); handleLoadDefaults(); }}
                  className="text-[10px] px-3 py-1.5 bg-[rgba(37,99,235,0.08)] text-[#2563EB] rounded-lg border border-[rgba(37,99,235,0.25)] hover:bg-[rgba(37,99,235,0.14)] transition-all">
                  Create Your First Agent
                </button>
              </div>
            ) : null}
          </motion.div>

          {/* ── Demo Agents (local state) ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Phone size={14} /> Quick Agent Profiles <span className="text-[9px] text-muted font-normal">(local config)</span></h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map(agent => (
                <div key={agent.id} className={`p-3 rounded-lg border transition-all ${
                  agent.status === "active" ? "border-[rgba(37,99,235,0.14)] bg-[rgba(37,99,235,0.04)]" : "border-[rgba(0,0,0,0.08)]"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
                        <Phone size={14} className="text-[#2563EB]" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold">{agent.name}</p>
                        <p className="text-[9px] text-muted">{agent.voice}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleAgent(agent.id)}
                      className={`w-9 h-5 rounded-full transition-colors ${agent.status === "active" ? "bg-green-600" : "bg-[rgba(0,0,0,0.12)]"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${agent.status === "active" ? "ml-4" : "ml-0.5"}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px] text-[#6B7280]">
                    <div><span className="block text-[8px] uppercase">Calls</span><span className="text-[#111827] font-mono">{agent.callsToday}</span></div>
                    <div><span className="block text-[8px] uppercase">Success</span><span className={`font-mono ${agent.successRate >= 30 ? "text-green-700" : "text-amber-700"}`}>{agent.successRate}%</span></div>
                    <div><span className="block text-[8px] uppercase">Avg Time</span><span className="text-[#111827] font-mono">{formatDuration(agent.avgDuration)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Recent Conversations from API ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Conversations {liveConversations.length > 0 && <span className="text-[9px] text-muted font-normal">({liveConversations.length} from API)</span>}</h2>
            {liveConversations.length > 0 ? (
              <div className="space-y-1.5">
                {liveConversations.slice(0, 10).map((convo: Record<string, unknown>, i: number) => {
                  const convId = (convo.conversation_id || convo.id || "") as string;
                  const status = (convo.status || "unknown") as string;
                  const agentId = (convo.agent_id || "") as string;
                  return (
                    <div key={convId || i} className="flex items-center gap-3 p-2 rounded-lg border border-[rgba(0,0,0,0.08)] text-[10px]">
                      <span className={`w-2 h-2 rounded-full ${status === "done" ? "bg-green-600" : status === "failed" ? "bg-red-600" : "bg-amber-500"}`} />
                      <span className="font-mono text-[#6B7280] w-40 truncate">{convId}</span>
                      <span className="text-[#6B7280] w-24 truncate">Agent: {agentId.slice(0, 8)}...</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                        status === "done" ? "bg-green-50 text-green-700" : status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>{status}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PhoneCall size={20} className="text-[#9CA3AF] mb-2" />
                <p className="text-xs text-[#6B7280]">No conversations yet.</p>
                <p className="text-[10px] text-[#9CA3AF] mt-1">Create an agent and make calls to see live data here.</p>
              </div>
            )}
          </motion.div>
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
                  className="text-[10px] px-3 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:text-[#374151] transition-all disabled:opacity-50 flex items-center gap-1">
                  <RefreshCw size={10} className={apiLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
              <div className="rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
                <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-[rgba(0,0,0,0.08)] text-[9px] text-[#6B7280] uppercase tracking-wider bg-[rgba(0,0,0,0.03)]">
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
                    <div key={convId || i} className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] last:border-0 text-[10px] items-center hover:bg-[rgba(0,0,0,0.02)]">
                      <div className="font-mono text-[#6B7280] truncate">{convId}</div>
                      <div className="text-[#6B7280] truncate">{agentId ? `${agentId.slice(0, 12)}...` : "---"}</div>
                      <div>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                          status === "done" ? "bg-green-50 text-green-700" : status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}>{status}</span>
                      </div>
                      <div className="font-mono text-[#374151]">{callDuration > 0 ? formatDuration(callDuration) : "---"}</div>
                      <div className="text-[#6B7280]">{startTime}</div>
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
                      callFilter === f ? "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#2563EB]" : "border-[rgba(0,0,0,0.08)] text-[#6B7280]"
                    }`}>{f.replace("_", " ")}</button>
                ))}
              </div>
              {filteredCalls.length > 0 ? (
                <div className="rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
                  <div className="grid grid-cols-8 gap-2 px-4 py-2 border-b border-[rgba(0,0,0,0.08)] text-[9px] text-[#6B7280] uppercase tracking-wider bg-[rgba(0,0,0,0.03)]">
                    <div className="col-span-2">Contact</div>
                    <div>Agent</div>
                    <div>Duration</div>
                    <div>Outcome</div>
                    <div>Sentiment</div>
                    <div>Cost</div>
                    <div>Time</div>
                  </div>
                  {filteredCalls.map(call => (
                    <div key={call.id} className="grid grid-cols-8 gap-2 px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] last:border-0 text-[10px] items-center hover:bg-[rgba(0,0,0,0.02)] cursor-pointer"
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
                <div className="p-6 text-center border border-dashed border-[rgba(0,0,0,0.12)] rounded-lg">
                  <PhoneCall size={24} className="text-[#9CA3AF] mx-auto mb-2" />
                  <p className="text-xs text-[#6B7280]">No call history yet</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-1">Create an agent and make calls to see live data here</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TRANSCRIPTS TAB ═══ */}
      {activeTab === "Transcripts" && (
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-[#2563EB]" />
              <h2 className="text-sm font-semibold text-[#111827]">Call Transcript Viewer</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText size={24} className="text-[#9CA3AF] mb-2" />
              <p className="text-xs text-[#6B7280]">No transcripts available yet.</p>
              <p className="text-[10px] text-[#9CA3AF] mt-1">Make calls with an agent to see transcripts here.</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ SENTIMENT TAB ═══ */}
      {activeTab === "Sentiment" && (
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><TrendingUp size={14} className="text-[#2563EB]" /> Sentiment Analysis</h2>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp size={24} className="text-[#9CA3AF] mb-2" />
              <p className="text-xs text-[#6B7280]">No sentiment data yet.</p>
              <p className="text-[10px] text-[#9CA3AF] mt-1">Sentiment is tracked automatically as calls complete.</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ VOICES TAB ═══ */}
      {activeTab === "Voices" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-[#111827]">
              <Mic size={14} className="text-[#2563EB]" /> ElevenLabs Voices
              {voicesLoading && <Loader2 size={12} className="animate-spin text-[#6B7280]" />}
              <span className="text-[9px] text-[#6B7280] font-normal">({liveVoices.length} available)</span>
            </h2>
            <button onClick={() => loadVoices()} disabled={voicesLoading}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:text-[#374151] transition-all disabled:opacity-50 flex items-center gap-1">
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
                <div key={voiceId} className="flex items-center gap-3 p-3 rounded-lg border border-[rgba(0,0,0,0.08)]">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
                    <Volume2 size={16} className="text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#111827]">{name}</p>
                    <p className="text-[9px] text-[#6B7280] truncate">
                      {[gender, accent, useCase, category].filter(Boolean).join(" \u00b7 ")}
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">ready</span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(voiceId);
                    setApiSuccess(`Copied voice ID: ${voiceId}`);
                    setTimeout(() => setApiSuccess(""), 2000);
                  }}
                    className="text-[9px] px-2 py-1 rounded border border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:text-[#374151] transition-all flex items-center gap-1">
                    <Copy size={10} /> Copy ID
                  </button>
                </div>
              );
            }) : !voicesLoading ? (
              <div className="p-6 text-center border border-dashed border-[rgba(0,0,0,0.12)] rounded-lg">
                <Volume2 size={24} className="text-[#9CA3AF] mx-auto mb-2" />
                <p className="text-xs text-[#6B7280]">No voices loaded</p>
                <button onClick={() => loadVoices()}
                  className="mt-2 text-[10px] px-3 py-1.5 bg-[rgba(37,99,235,0.08)] text-[#2563EB] rounded-lg border border-[rgba(37,99,235,0.25)] hover:bg-[rgba(37,99,235,0.14)] transition-all">
                  Load Voices
                </button>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* ═══ SCRIPTS TAB ═══ */}
      {activeTab === "Scripts" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {["all", "cold-call", "follow-up", "reminder", "reactivation", "retention"].map(f => (
              <button key={f} onClick={() => setScriptFilter(f)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${
                  scriptFilter === f ? "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#2563EB]" : "border-[rgba(0,0,0,0.08)] text-[#6B7280]"
                }`}>{f.replace("-", " ")}</button>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={24} className="text-[#9CA3AF] mb-2" />
            <p className="text-xs text-[#6B7280]">No scripts yet.</p>
            <p className="text-[10px] text-[#9CA3AF] mt-1">Scripts will appear here once created.</p>
          </div>
        </div>
      )}

      {/* ═══ A/B TESTS TAB ═══ */}
      {activeTab === "A/B Tests" && (
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">A/B Script Testing</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <input value={abTestName} onChange={e => setAbTestName(e.target.value)} className="input text-xs" placeholder="Test name" />
              <input value={abScriptA} onChange={e => setAbScriptA(e.target.value)} className="input text-xs" placeholder="Script A description" />
              <div className="flex gap-2">
                <input value={abScriptB} onChange={e => setAbScriptB(e.target.value)} className="input flex-1 text-xs" placeholder="Script B" />
                <button onClick={createAbTest} disabled={!abTestName.trim()} className="px-3 py-1.5 bg-[rgba(37,99,235,0.08)] text-[#2563EB] text-xs rounded-lg border border-[rgba(37,99,235,0.25)] hover:bg-[rgba(37,99,235,0.14)] transition-all disabled:opacity-50">Create</button>
              </div>
            </div>
            <div className="space-y-3">
              {abTests.map(test => {
                const totalA = test.callsA > 0 ? Math.round((test.convA / test.callsA) * 100) : 0;
                const totalB = test.callsB > 0 ? Math.round((test.convB / test.callsB) * 100) : 0;
                const winner = totalA > totalB ? "A" : totalB > totalA ? "B" : "tie";
                return (
                  <div key={test.id} className="p-3 rounded-lg border border-[rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#111827]">{test.name}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                        test.status === "running" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
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
          </motion.div>
        </div>
      )}

      {/* ═══ SCHEDULING TAB ═══ */}
      {activeTab === "Scheduling" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><Calendar size={14} className="text-[#2563EB]" /> Call Scheduling</h2>
          <div className="space-y-2">
            {scheduledCalls.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)]">
                <Clock size={14} className="text-[#2563EB] shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-[#111827]">{s.list}</p>
                  <p className="text-[9px] text-[#6B7280]">{s.agent} &middot; {s.count} calls &middot; {s.time}</p>
                </div>
                <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{s.status}</span>
                <button onClick={() => cancelScheduled(s.id)} className="text-[9px] px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 transition-all">Cancel</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ CONTACTS TAB ═══ */}
      {activeTab === "Contacts" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><Users size={14} className="text-[#2563EB]" /> Contact Lists</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users size={24} className="text-[#9CA3AF] mb-2" />
            <p className="text-xs text-[#6B7280]">No contact lists yet.</p>
            <p className="text-[10px] text-[#9CA3AF] mt-1">Upload a contact list to start calling.</p>
          </div>
        </motion.div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><BarChart3 size={14} className="text-[#2563EB]" /> Call Analytics</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-[#6B7280] uppercase mb-2">Outcome Distribution</p>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-xs text-[#6B7280]">No call data yet.</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-[#6B7280] uppercase mb-2">Agent Performance</p>
                {agents.map(a => (
                  <div key={a.id} className="flex items-center gap-2 mb-1.5 text-[10px]">
                    <span className="w-36 font-medium text-[#374151]">{a.name}</span>
                    <div className="flex-1 bg-[rgba(0,0,0,0.06)] rounded-full h-2.5">
                      <div className="bg-[#3B82F6] h-2.5 rounded-full" style={{ width: `${(a.callsToday / Math.max(...agents.map(x => x.callsToday), 1)) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono text-[#374151]">{a.callsToday}</span>
                    <span className="w-12 text-right text-green-700 font-mono">{a.successRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ COMPLIANCE TAB ═══ */}
      {activeTab === "Compliance" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><Shield size={14} className="text-[#2563EB]" /> Compliance Settings</h2>
          <div className="space-y-3">
            {[
              { label: "Recording Notice", desc: "Play 'this call may be recorded' at start", state: recordingNotice, toggle: () => setRecordingNotice(!recordingNotice) },
              { label: "DNC List Check", desc: "Check against Do Not Call registry before dialing", state: dncCheck, toggle: () => setDncCheck(!dncCheck) },
              { label: "TCPA Compliance", desc: "Ensure all calls comply with TCPA regulations", state: complianceEnabled, toggle: () => setComplianceEnabled(!complianceEnabled) },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[rgba(0,0,0,0.08)]">
                <div>
                  <p className="text-[11px] font-medium text-[#111827]">{item.label}</p>
                  <p className="text-[9px] text-[#6B7280]">{item.desc}</p>
                </div>
                <button onClick={item.toggle}
                  className={`w-10 h-5 rounded-full transition-colors ${item.state ? "bg-green-600" : "bg-[rgba(0,0,0,0.12)]"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${item.state ? "ml-5" : "ml-0.5"}`} />
                </button>
              </div>
            ))}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} className="text-amber-700" />
                <span className="text-[10px] font-semibold text-amber-700">Important</span>
              </div>
              <p className="text-[10px] text-[#6B7280]">Ensure all AI voice agents comply with local and federal regulations. Always disclose that the call is from an AI system when required by law.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ TRANSFER RULES TAB ═══ */}
      {activeTab === "Transfer Rules" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#111827]"><ArrowRight size={14} className="text-[#2563EB]" /> Call Transfer Rules</h2>
          <div className="space-y-2">
            {transferRules.map(rule => (
              <div key={rule.id} className={`p-3 rounded-lg border transition-all ${rule.active ? "border-[rgba(0,0,0,0.08)]" : "border-[rgba(0,0,0,0.04)] opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleTransferRule(rule.id)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${rule.active ? "bg-green-600" : "bg-[rgba(0,0,0,0.12)]"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                  </button>
                  <div className="flex-1">
                    <p className="text-[10px] font-medium text-[#111827]">{rule.trigger}</p>
                    <p className="text-[9px] text-[#6B7280]">{rule.action} {rule.number && `(${rule.number})`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
