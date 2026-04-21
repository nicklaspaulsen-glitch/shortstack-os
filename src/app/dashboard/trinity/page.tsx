"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, History, CheckCircle, XCircle,
  BarChart3, Shield, ArrowRight,
  Layers, Star, Eye
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AgentStatus {
  name: string;
  status: "active" | "idle" | "error";
  lastAction: string;
  actionsToday: number;
  successRate: number;
}

// TODO: Load live agent status / outputs / history from the Trinity orchestrator
// API once endpoints are wired. Until then the UI shows empty states.
const INITIAL_AGENTS: AgentStatus[] = [];

const INITIAL_OUTPUTS: Array<{ id: string; agent: string; type: string; preview: string; quality: number; time: string }> = [];

const INITIAL_HISTORY: Array<{ id: string; action: string; status: string; agent: string; time: string }> = [];

const TABS = ["Chat", "Dashboard", "Agents", "Outputs", "Queue", "Cost", "Quality", "Fallback", "History", "Analytics"] as const;
type Tab = typeof TABS[number];

const FALLBACK_CHAIN = [
  { primary: "Claude 3.5 Sonnet", fallback: "GPT-4o", trigger: "Rate limit or timeout" },
  { primary: "ElevenLabs", fallback: "Google TTS", trigger: "API down or quota exceeded" },
  { primary: "Supabase", fallback: "Local cache", trigger: "Connection timeout" },
];

// TODO: Load queued Trinity tasks from /api/trinity/queue once available.
const INITIAL_QUEUE: Array<{ id: string; task: string; priority: string; agent: string; eta: string }> = [];

export default function TrinityPage() {
  const [tab, setTab] = useState<Tab>("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey, I am Trinity -- your AI operating system. I can build websites, set up AI receptionists, create chatbots, manage automations, set up Discord servers, and much more. What do you need?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentWeights, setAgentWeights] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "I processed that command. Check the action log for details.",
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error("Trinity chat failed:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error processing that.",
        timestamp: new Date(),
      }]);
    }
    setSending(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Bot size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Trinity AI</h1>
            <p className="text-muted text-xs">Trinity autonomous AI agent -- chat, orchestrate, and monitor</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ CHAT TAB ═══ */}
      {tab === "Chat" && (
        <div className="card p-0 flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === "user" ? "bg-gold text-black rounded-br-sm" : "bg-surface-light text-foreground rounded-bl-sm"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-black/50" : "text-muted"}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-surface-light rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-border p-4">
            <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-3">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Tell Trinity what to do..." className="input flex-1" disabled={sending} />
              <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
                <Send size={18} />
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Build a website", "Set up AI receptionist", "Create Discord server", "Run email campaign", "Generate leads"].map(cmd => (
                <button key={cmd} onClick={() => setInput(cmd)}
                  className="text-xs bg-surface-light px-3 py-1.5 rounded-full text-muted hover:text-foreground hover:bg-border transition-all">{cmd}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DASHBOARD TAB ═══ */}
      {tab === "Dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[9px] text-muted uppercase">Total Agents</p>
              <p className="text-xl font-bold text-gold">{INITIAL_AGENTS.length}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[9px] text-muted uppercase">Active Now</p>
              <p className="text-xl font-bold text-emerald-400">{INITIAL_AGENTS.filter(a => a.status === "active").length}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[9px] text-muted uppercase">Actions Today</p>
              <p className="text-xl font-bold text-foreground">{INITIAL_AGENTS.reduce((s, a) => s + a.actionsToday, 0)}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[9px] text-muted uppercase">Errors</p>
              <p className={`text-xl font-bold ${INITIAL_AGENTS.filter(a => a.status === "error").length > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {INITIAL_AGENTS.filter(a => a.status === "error").length}
              </p>
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Response Time Comparison (ms)</h3>
            <div className="flex items-end gap-2 h-28">
              {[
                { name: "Claude", ms: 0, color: "bg-gold/60" },
                { name: "GPT-4o", ms: 0, color: "bg-blue-400/60" },
                { name: "Gemini", ms: 0, color: "bg-purple-400/60" },
              ].map(m => (
                <div key={m.name} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono">{m.ms}ms</span>
                  <div className={`w-full rounded-t ${m.color}`} style={{ height: `${m.ms > 0 ? (m.ms / 600) * 100 : 0}%` }} />
                  <span className="text-[8px] text-muted">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AGENTS TAB ═══ */}
      {tab === "Agents" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Shield size={14} className="text-gold" /> Agent Status Grid</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {INITIAL_AGENTS.map(a => (
              <div key={a.name} className={`p-3 rounded-xl border ${
                a.status === "error" ? "border-red-500/15 bg-red-500/5" : a.status === "active" ? "border-emerald-500/10 bg-emerald-500/5" : "border-border bg-surface-light"
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-2 h-2 rounded-full ${a.status === "active" ? "bg-emerald-400" : a.status === "error" ? "bg-red-400 animate-pulse" : "bg-amber-400"}`} />
                  <p className="text-xs font-semibold">{a.name}</p>
                </div>
                <p className="text-[9px] text-muted mb-1">{a.lastAction}</p>
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted">{a.actionsToday} today</span>
                  <span className={a.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{a.successRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ OUTPUTS TAB ═══ */}
      {tab === "Outputs" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Eye size={14} className="text-gold" /> Combined Output Viewer</h2>
          <div className="space-y-2">
            {INITIAL_OUTPUTS.map(o => (
              <div key={o.id} className="p-3 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-gold">{o.agent}</span>
                  <span className="text-[9px] bg-surface px-1.5 py-0.5 rounded text-muted">{o.type}</span>
                  <span className="text-[9px] text-muted ml-auto">{o.time}</span>
                </div>
                <p className="text-xs text-muted">{o.preview}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] text-muted">Quality:</span>
                  <div className="w-20 h-1.5 rounded-full bg-surface">
                    <div className={`h-1.5 rounded-full ${o.quality >= 90 ? "bg-emerald-400" : o.quality >= 80 ? "bg-gold" : "bg-amber-400"}`}
                      style={{ width: `${o.quality}%` }} />
                  </div>
                  <span className="text-[9px] font-mono">{o.quality}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ QUEUE TAB ═══ */}
      {tab === "Queue" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Layers size={14} className="text-gold" /> Unified Task Queue</h2>
          <div className="space-y-2">
            {INITIAL_QUEUE.map(q => (
              <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  q.priority === "high" ? "bg-red-500/10 text-red-400" : q.priority === "medium" ? "bg-gold/10 text-gold" : "bg-blue-500/10 text-blue-400"
                }`}>{q.priority}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{q.task}</p>
                  <p className="text-[9px] text-muted">{q.agent} &middot; ETA: {q.eta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COST TAB ═══ */}
      {tab === "Cost" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center"><p className="text-[9px] text-muted uppercase">Today</p><p className="text-xl font-bold text-gold">$0.00</p></div>
            <div className="card p-3 text-center"><p className="text-[9px] text-muted uppercase">This Week</p><p className="text-xl font-bold text-foreground">$0.00</p></div>
            <div className="card p-3 text-center"><p className="text-[9px] text-muted uppercase">This Month</p><p className="text-xl font-bold text-foreground">$0.00</p></div>
            <div className="card p-3 text-center"><p className="text-[9px] text-muted uppercase">Per Task Avg</p><p className="text-xl font-bold text-foreground">$0.00</p></div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Cost by Agent</h3>
            <div className="space-y-2">
              {INITIAL_AGENTS.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">No agent cost data yet.</p>
              ) : (
                INITIAL_AGENTS.slice(0, 5).map(a => (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="text-[10px] w-28 shrink-0">{a.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light">
                      {/* TODO: Wire to real per-agent cost once /api/trinity/cost exists. */}
                      <div className="h-2 rounded-full bg-gold" style={{ width: "0%" }} />
                    </div>
                    <span className="text-[10px] font-mono text-gold w-12 text-right">$0.00</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ QUALITY TAB ═══ */}
      {tab === "Quality" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Star size={14} className="text-gold" /> Quality Comparison</h2>
          <div className="space-y-2">
            {INITIAL_AGENTS.map(a => (
              <div key={a.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                <span className="text-[10px] w-28 shrink-0 font-medium">{a.name}</span>
                <div className="flex-1 h-2 rounded-full bg-surface">
                  <div className={`h-2 rounded-full ${a.successRate >= 95 ? "bg-emerald-400" : a.successRate >= 80 ? "bg-gold" : "bg-red-400"}`}
                    style={{ width: `${a.successRate}%` }} />
                </div>
                <span className={`text-[10px] font-mono w-10 text-right ${a.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}`}>{a.successRate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ FALLBACK TAB ═══ */}
      {tab === "Fallback" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Shield size={14} className="text-gold" /> Fallback Chain Editor</h2>
          <div className="space-y-2">
            {FALLBACK_CHAIN.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <div className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[10px] font-medium">{f.primary}</div>
                <ArrowRight size={12} className="text-muted" />
                <div className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-[10px] font-medium">{f.fallback}</div>
                <span className="text-[9px] text-muted ml-auto">{f.trigger}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted mt-3">Trinity automatically falls back to secondary providers when primary services are unavailable.</p>
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === "History" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><History size={14} className="text-gold" /> Action History</h2>
          <div className="space-y-1.5">
            {INITIAL_HISTORY.map(h => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                {h.status === "success" ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs">{h.action}</p>
                  <p className="text-[9px] text-muted">{h.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === "Analytics" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 size={14} className="text-gold" /> Trinity Analytics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gold">0</p>
                <p className="text-[9px] text-muted">Tasks This Month</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-400">0%</p>
                <p className="text-[9px] text-muted">Success Rate</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-400">0s</p>
                <p className="text-[9px] text-muted">Avg Response</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">$0</p>
                <p className="text-[9px] text-muted">Monthly Cost</p>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Agent Weighting Controls</h3>
            <p className="text-[10px] text-muted mb-3">Adjust priority weighting for each agent in the Trinity orchestration layer.</p>
            <div className="space-y-2">
              {Object.keys(agentWeights).length === 0 && (
                <p className="text-xs text-muted text-center py-4">No agents configured yet.</p>
              )}
              {Object.entries(agentWeights).map(([name, weight]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-[10px] w-28 shrink-0">{name}</span>
                  <input type="range" min={0} max={100} value={weight}
                    onChange={e => setAgentWeights(prev => ({ ...prev, [name]: Number(e.target.value) }))}
                    className="flex-1 accent-gold" />
                  <span className="text-[10px] font-mono w-8 text-right">{weight}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
