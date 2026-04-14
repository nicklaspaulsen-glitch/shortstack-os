"use client";

import { useState } from "react";
import {
  Phone, PhoneCall, Plus, RefreshCw, Play, Pause,
  Clock,
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
const MOCK_AGENTS: VoiceAgent[] = [
  { id: "a1", name: "ShortStack Cold Caller", voice: "Alex - Professional Male", language: "English", status: "active", callsToday: 47, successRate: 34, avgDuration: 142 },
  { id: "a2", name: "Appointment Setter", voice: "Sarah - Warm Female", language: "English", status: "active", callsToday: 23, successRate: 52, avgDuration: 98 },
  { id: "a3", name: "Follow-Up Agent", voice: "Marcus - Casual Male", language: "English", status: "inactive", callsToday: 0, successRate: 41, avgDuration: 67 },
  { id: "a4", name: "Spanish Outreach", voice: "Maria - Professional Female", language: "Spanish", status: "active", callsToday: 15, successRate: 29, avgDuration: 156 },
];

const MOCK_CALLS: CallRecord[] = [
  { id: "c1", agent: "ShortStack Cold Caller", contactName: "Dr. James Wilson", phone: "+1 (305) 555-0142", duration: 187, outcome: "qualified", sentiment: "positive", startTime: "10:23 AM", cost: 0.14, hasTranscript: true },
  { id: "c2", agent: "ShortStack Cold Caller", contactName: "Lisa Chen", phone: "+1 (415) 555-0198", duration: 45, outcome: "not_interested", sentiment: "negative", startTime: "10:15 AM", cost: 0.04, hasTranscript: true },
  { id: "c3", agent: "Appointment Setter", contactName: "Mike Rodriguez", phone: "+1 (786) 555-0234", duration: 210, outcome: "callback", sentiment: "neutral", startTime: "10:08 AM", cost: 0.16, hasTranscript: true },
  { id: "c4", agent: "ShortStack Cold Caller", contactName: "Jennifer Park", phone: "+1 (212) 555-0167", duration: 0, outcome: "no_answer", sentiment: "neutral", startTime: "10:01 AM", cost: 0.01, hasTranscript: false },
  { id: "c5", agent: "Appointment Setter", contactName: "Robert Davis", phone: "+1 (323) 555-0289", duration: 156, outcome: "qualified", sentiment: "positive", startTime: "9:54 AM", cost: 0.12, hasTranscript: true },
  { id: "c6", agent: "ShortStack Cold Caller", contactName: "Amanda Foster", phone: "+1 (555) 555-0345", duration: 32, outcome: "voicemail", sentiment: "neutral", startTime: "9:48 AM", cost: 0.03, hasTranscript: true },
  { id: "c7", agent: "Spanish Outreach", contactName: "Carlos Mendez", phone: "+1 (305) 555-0456", duration: 198, outcome: "qualified", sentiment: "positive", startTime: "9:40 AM", cost: 0.15, hasTranscript: true },
  { id: "c8", agent: "ShortStack Cold Caller", contactName: "Susan Thompson", phone: "+1 (404) 555-0567", duration: 78, outcome: "callback", sentiment: "neutral", startTime: "9:32 AM", cost: 0.06, hasTranscript: true },
];

const MOCK_TRANSCRIPT: TranscriptEntry[] = [
  { speaker: "ai", text: "Hi, is this Dr. Wilson? This is Alex from ShortStack Digital. How are you doing today?", timestamp: "0:00", sentiment: "neutral" },
  { speaker: "human", text: "Yes, this is Dr. Wilson. What's this about?", timestamp: "0:05", sentiment: "neutral" },
  { speaker: "ai", text: "Great to connect with you, Dr. Wilson! I noticed your practice in Miami and wanted to share how we've helped dental practices like yours get 30-40% more new patients through AI-powered marketing.", timestamp: "0:08", sentiment: "positive" },
  { speaker: "human", text: "Hmm, that sounds interesting. We've been trying to grow our patient base actually.", timestamp: "0:22", sentiment: "positive" },
  { speaker: "ai", text: "Perfect! We specifically work with dental practices and use AI to handle your social media, run targeted ads, and even automate follow-ups with leads. Would you be open to a quick 15-minute demo?", timestamp: "0:28", sentiment: "positive" },
  { speaker: "human", text: "Sure, I could do that. When are you available?", timestamp: "0:42", sentiment: "positive" },
  { speaker: "ai", text: "Wonderful! I have availability tomorrow at 2 PM or Thursday at 10 AM. Which works better for you?", timestamp: "0:46", sentiment: "positive" },
  { speaker: "human", text: "Thursday at 10 works. Send me the details.", timestamp: "0:52", sentiment: "positive" },
];

const MOCK_VOICES: VoiceClone[] = [
  { id: "v1", name: "Alex - Professional Male", gender: "Male", accent: "American", sampleCount: 12, status: "ready" },
  { id: "v2", name: "Sarah - Warm Female", gender: "Female", accent: "American", sampleCount: 8, status: "ready" },
  { id: "v3", name: "Marcus - Casual Male", gender: "Male", accent: "American", sampleCount: 15, status: "ready" },
  { id: "v4", name: "Maria - Professional Female", gender: "Female", accent: "Spanish", sampleCount: 10, status: "ready" },
  { id: "v5", name: "Custom Brand Voice", gender: "Male", accent: "British", sampleCount: 3, status: "training" },
];

const MOCK_SCRIPTS: ScriptTemplate[] = [
  { id: "s1", name: "Cold Intro - Dental", category: "cold-call", variables: ["business_name", "industry", "pain_point"], openRate: 72, conversionRate: 18 },
  { id: "s2", name: "Cold Intro - Legal", category: "cold-call", variables: ["business_name", "specialty", "location"], openRate: 65, conversionRate: 14 },
  { id: "s3", name: "Follow-Up After Demo", category: "follow-up", variables: ["contact_name", "demo_date", "proposal_link"], openRate: 89, conversionRate: 34 },
  { id: "s4", name: "Appointment Reminder", category: "reminder", variables: ["contact_name", "date", "time"], openRate: 95, conversionRate: 82 },
  { id: "s5", name: "Reactivation - Dormant Lead", category: "reactivation", variables: ["contact_name", "last_contact", "new_offer"], openRate: 58, conversionRate: 12 },
  { id: "s6", name: "Review Request", category: "retention", variables: ["contact_name", "service_date", "review_link"], openRate: 78, conversionRate: 45 },
];

const MOCK_CONTACTS = [
  { id: "ct1", name: "Acme Dental List", count: 450, lastCalled: "2h ago", status: "active" },
  { id: "ct2", name: "Miami Lawyers", count: 230, lastCalled: "1d ago", status: "paused" },
  { id: "ct3", name: "Gym Owners - Texas", count: 180, lastCalled: "3d ago", status: "completed" },
  { id: "ct4", name: "Warm Leads Q1", count: 67, lastCalled: "4h ago", status: "active" },
  { id: "ct5", name: "Reactivation List", count: 320, lastCalled: "Never", status: "new" },
];

const TABS = ["Dashboard", "Calls", "Transcripts", "Sentiment", "Voices", "Scripts", "A/B Tests", "Scheduling", "Contacts", "Analytics", "Compliance", "Transfer Rules"] as const;
type Tab = typeof TABS[number];

export default function ElevenAgentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [callFilter, setCallFilter] = useState<string>("all");
  const [scriptFilter, setScriptFilter] = useState<string>("all");
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
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-all">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Calls Today", value: totalCallsToday, color: "text-gold" },
          { label: "Qualified", value: qualifiedCalls, color: "text-green-400" },
          { label: "Success Rate", value: `${avgSuccessRate}%`, color: avgSuccessRate >= 30 ? "text-green-400" : "text-yellow-400" },
          { label: "Active Agents", value: agents.filter(a => a.status === "active").length, color: "text-purple-400" },
          { label: "Avg Duration", value: `${Math.round(agents.reduce((s, a) => s + a.avgDuration, 0) / agents.length)}s`, color: "text-foreground" },
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
          {/* Agents Grid */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Phone size={14} /> Your Agents</h2>
              <button className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1"><Plus size={10} /> New Agent</button>
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

          {/* Recent Calls Preview */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Calls</h2>
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
            </div>
          </div>
        </div>
      )}

      {/* ═══ CALLS TAB ═══ */}
      {activeTab === "Calls" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {["all", "qualified", "callback", "not_interested", "voicemail", "no_answer"].map(f => (
              <button key={f} onClick={() => setCallFilter(f)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${
                  callFilter === f ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                }`}>{f.replace("_", " ")}</button>
            ))}
          </div>
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
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mic size={14} className="text-gold" /> Voice Clone Manager</h2>
          <div className="space-y-2">
            {MOCK_VOICES.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Volume2 size={16} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium">{v.name}</p>
                  <p className="text-[9px] text-muted">{v.gender} &middot; {v.accent} &middot; {v.sampleCount} samples</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  v.status === "ready" ? "bg-green-500/10 text-green-400" :
                  v.status === "training" ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-surface-light text-muted"
                }`}>{v.status}</span>
                <button onClick={() => setPlayingVoice(playingVoice === v.id ? null : v.id)}
                  className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-foreground transition-all flex items-center gap-1">
                  {playingVoice === v.id ? <Pause size={10} /> : <Play size={10} />}
                  {playingVoice === v.id ? "Stop" : "Preview"}
                </button>
              </div>
            ))}
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
