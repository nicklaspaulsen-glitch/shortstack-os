"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bot, Send, History, CheckCircle, XCircle,
  BarChart3, Shield, ArrowRight,
  Layers, Star, Eye
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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

interface QueueEntry {
  id: string;
  agent: string;
  action_type: string;
  description: string;
  status: string;
  priority: string;
  started_at: string | null;
  created_at: string | null;
}

interface CostAgent { name: string; amount: number; events: number }

interface HistoryEntry {
  id: string;
  action_type: string;
  description: string;
  status: string;
  agent: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

const TABS = ["Chat", "Dashboard", "Agents", "Outputs", "Queue", "Cost", "Quality", "Fallback", "History", "Analytics"] as const;
type Tab = typeof TABS[number];

const FALLBACK_CHAIN = [
  { primary: "Claude 3.5 Sonnet", fallback: "GPT-4o", trigger: "Rate limit or timeout" },
  { primary: "ElevenLabs", fallback: "Google TTS", trigger: "API down or quota exceeded" },
  { primary: "Supabase", fallback: "Local cache", trigger: "Connection timeout" },
];

export default function TrinityPage() {
  const [tab, setTab] = useState<Tab>("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey, I am Trinity -- your AI operating system. I can build websites, set up AI receptionists, create chatbots, manage automations, set up Discord servers, and much more. What do you need?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentWeights, setAgentWeights] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live backend state
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [costByAgent, setCostByAgent] = useState<CostAgent[]>([]);
  const [costTotal, setCostTotal] = useState(0);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Fetch live data from Trinity backends
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qRes, cRes, hRes] = await Promise.all([
          fetch("/api/trinity/queue").then(r => r.ok ? r.json() : { queue: [], agents: [] }),
          fetch("/api/trinity/cost").then(r => r.ok ? r.json() : { by_agent: [], total_amount: 0 }),
          fetch("/api/trinity/history?limit=50").then(r => r.ok ? r.json() : { history: [] }),
        ]);
        if (cancelled) return;

        const queueList: QueueEntry[] = qRes.queue ?? [];
        const historyList: HistoryEntry[] = hRes.history ?? [];
        const byAgentList: CostAgent[] = cRes.by_agent ?? [];

        setQueue(queueList);
        setHistory(historyList);
        setCostByAgent(byAgentList);
        setCostTotal(Number(cRes.total_amount ?? 0));

        // Synthesize AgentStatus from queue + history so the Agents/Quality
        // tabs have something real to render.
        const names = new Set<string>();
        (qRes.agents ?? []).forEach((a: { name: string }) => names.add(a.name));
        byAgentList.forEach(a => names.add(a.name));
        historyList.forEach(h => { if (h.agent) names.add(h.agent); });

        const nowMs = Date.now();
        const dayMs = 86_400_000;
        const derived: AgentStatus[] = Array.from(names).filter(Boolean).map(name => {
          const agentHistory = historyList.filter(h => h.agent === name);
          const today = agentHistory.filter(h => h.created_at && nowMs - new Date(h.created_at).getTime() < dayMs);
          const failures = agentHistory.filter(h => h.status === "failed" || h.status === "error").length;
          const successRate = agentHistory.length > 0
            ? Math.round(((agentHistory.length - failures) / agentHistory.length) * 100)
            : 100;
          const queueForAgent = queueList.filter(q => q.agent === name);
          const running = queueForAgent.filter(q => q.status === "running").length;
          const status: "active" | "idle" | "error" =
            failures > 0 && agentHistory.length > 0 && agentHistory[0].status === "failed" ? "error"
            : running > 0 ? "active"
            : "idle";
          const last = agentHistory[0];
          return {
            name,
            status,
            lastAction: last?.description ?? "No activity",
            actionsToday: today.length,
            successRate,
          };
        });
        setAgents(derived);
      } catch (err) {
        console.error("Trinity data load failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const totalActionsToday = agents.reduce((s, a) => s + a.actionsToday, 0);
  const activeAgentCount = agents.filter(a => a.status === "active").length;
  const errorAgentCount = agents.filter(a => a.status === "error").length;
  const perTaskAvg = history.length > 0 ? costTotal / history.length : 0;
  const successRateAvg = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.successRate, 0) / agents.length)
    : 0;

  return (
    <MotionPage className="fade-in space-y-5">{/* -- Trinity AI command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">TRINITY AI</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Trinity AI</h1>
      </div>
    </div>{/* Tabs */}<div className="overflow-x-auto pb-1">
              <div className="tab-pill-strip">
                {TABS.map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`tab-pill${tab === t ? " active" : ""}`}>{t}</button>
                ))}
              </div>
            </div>{/* ═══ CHAT TAB ═══ */}{tab === "Chat" && (
              <div className="glass rounded-xl p-0 flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%]  px-4 py-3 ${
                        msg.role === "user" ? "bg-brand-accent text-white rounded-br-sm" : "bg-surface-light text-foreground rounded-bl-sm"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-muted" : "text-muted"}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-surface-light  rounded-bl-sm px-4 py-3 flex gap-1">
                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
            )}{/* ═══ DASHBOARD TAB ═══ */}{tab === "Dashboard" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                  <motion.div
                    className="col-span-2 lg:col-span-1 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Agents</p>
                      <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{agents.length}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">in workspace</p>
                    </div>
                  </motion.div>
                  <motion.div
                    className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Active Now</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-700 tabular-nums">{activeAgentCount}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">running</p>
                  </motion.div>
                  <motion.div
                    className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Actions Today</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{totalActionsToday}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">completed</p>
                  </motion.div>
                  <motion.div
                    className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Errors</p>
                    <p className={`font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${errorAgentCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>{errorAgentCount}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">agent errors</p>
                  </motion.div>
                </div>
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-bold mb-3">Response Time Comparison (ms)</h3>
                  <div className="flex items-end gap-2 h-28">
                    {[
                      { name: "Claude", ms: 0, color: "bg-[rgba(37,99,235,0.6)]" },
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
            )}{/* ═══ AGENTS TAB ═══ */}{tab === "Agents" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Shield size={14} className="text-brand-accent" /> Agent Status Grid</h2>
                {agents.length === 0 ? (
                  <p className="text-xs text-muted text-center py-8">No agents have run yet. Trigger a command in the Chat tab to populate agent activity.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {agents.map(a => (
                      <div key={a.name} className={`p-3 rounded-xl border ${
                        a.status === "error" ? "border-red-500/15 bg-red-500/5" : a.status === "active" ? "border-emerald-500/10 bg-emerald-500/5" : "border-border bg-surface-light"
                      }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className={`w-2 h-2 rounded-full ${a.status === "active" ? "bg-emerald-400" : a.status === "error" ? "bg-red-400 animate-pulse" : "bg-amber-400"}`} />
                          <p className="text-xs font-semibold">{a.name}</p>
                        </div>
                        <p className="text-[9px] text-muted mb-1 truncate">{a.lastAction}</p>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted">{a.actionsToday} today</span>
                          <span className={a.successRate >= 90 ? "text-emerald-400" : "text-brand-accent"}>{a.successRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}{/* ═══ OUTPUTS TAB ═══ */}{tab === "Outputs" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Eye size={14} className="text-brand-accent" /> Combined Output Viewer</h2>
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted text-center py-8">No Trinity outputs yet. Run a command in the Chat tab to see results here.</p>
                  ) : (
                    history.slice(0, 20).map(h => (
                      <div key={h.id} className="p-3 rounded-xl bg-surface-light border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-brand-accent">{h.agent}</span>
                          <span className="text-[9px] bg-surface px-1.5 py-0.5 rounded text-muted">{h.action_type}</span>
                          <span className="text-[9px] text-muted ml-auto">{h.created_at ? new Date(h.created_at).toLocaleString() : ""}</span>
                        </div>
                        <p className="text-xs text-muted">{h.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}{/* ═══ QUEUE TAB ═══ */}{tab === "Queue" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Layers size={14} className="text-brand-accent" /> Unified Task Queue</h2>
                <div className="space-y-2">
                  {queue.length === 0 ? (
                    <p className="text-xs text-muted text-center py-8">Queue is empty. No Trinity actions are currently queued or running.</p>
                  ) : (
                    queue.map(q => (
                      <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          q.priority === "high" ? "bg-red-500/10 text-red-400" : q.priority === "medium" ? "bg-[rgba(37,99,235,0.08)] text-brand-accent" : "bg-[rgba(37,99,235,0.08)] text-brand-accent"
                        }`}>{q.priority}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                          q.status === "running" ? "bg-emerald-500/10 text-emerald-400" : "bg-[rgba(37,99,235,0.08)] text-brand-accent"
                        }`}>{q.status}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{q.description}</p>
                          <p className="text-[9px] text-muted">{q.agent} &middot; {q.action_type}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}{/* ═══ COST TAB ═══ */}{tab === "Cost" && (() => {
              const maxAgentAmount = costByAgent.reduce((m, a) => Math.max(m, a.amount), 0);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                    <motion.div
                      className="col-span-2 lg:col-span-1 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">This Month</p>
                        <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{`$${costTotal.toFixed(2)}`}</p>
                        <p className="text-[11px] text-text-muted mt-1.5">AI spend</p>
                      </div>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Events</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-brand-accent tabular-nums">{history.length}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">this month</p>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Agents</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{costByAgent.length}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">with spend</p>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Per Task</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{`$${perTaskAvg.toFixed(2)}`}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">average</p>
                    </motion.div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-bold mb-3">Cost by Agent</h3>
                    <div className="space-y-2">
                      {costByAgent.length === 0 ? (
                        <p className="text-xs text-muted text-center py-4">No agent cost data yet this month.</p>
                      ) : (
                        costByAgent.slice(0, 8).map(a => {
                          const pct = maxAgentAmount > 0 ? (a.amount / maxAgentAmount) * 100 : 0;
                          return (
                            <div key={a.name} className="flex items-center gap-3">
                              <span className="text-[10px] w-28 shrink-0 truncate">{a.name}</span>
                              <div className="flex-1 h-2 rounded-full bg-surface-light">
                                <div className="h-2 rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-brand-accent w-16 text-right">${a.amount.toFixed(2)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}{/* ═══ QUALITY TAB ═══ */}{tab === "Quality" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Star size={14} className="text-brand-accent" /> Quality Comparison</h2>
                {agents.length === 0 ? (
                  <p className="text-xs text-muted text-center py-8">No agent quality data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {agents.map(a => (
                      <div key={a.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                        <span className="text-[10px] w-28 shrink-0 font-medium truncate">{a.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface">
                          <div className={`h-2 rounded-full ${a.successRate >= 95 ? "bg-emerald-400" : a.successRate >= 80 ? "bg-brand-accent" : "bg-red-400"}`}
                            style={{ width: `${a.successRate}%` }} />
                        </div>
                        <span className={`text-[10px] font-mono w-10 text-right ${a.successRate >= 90 ? "text-emerald-400" : "text-brand-accent"}`}>{a.successRate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}{/* ═══ FALLBACK TAB ═══ */}{tab === "Fallback" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Shield size={14} className="text-brand-accent" /> Fallback Chain Editor</h2>
                <div className="space-y-2">
                  {FALLBACK_CHAIN.map((f, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                      <div className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[10px] font-medium">{f.primary}</div>
                      <ArrowRight size={12} className="text-muted" />
                      <div className="bg-[rgba(37,99,235,0.08)] text-brand-accent px-2 py-1 rounded text-[10px] font-medium">{f.fallback}</div>
                      <span className="text-[9px] text-muted ml-auto">{f.trigger}</span>
                    </motion.div>
                  ))}
                </div>
                <p className="text-[9px] text-muted mt-3">Trinity automatically falls back to secondary providers when primary services are unavailable.</p>
              </div>
            )}{/* ═══ HISTORY TAB ═══ */}{tab === "History" && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><History size={14} className="text-brand-accent" /> Action History</h2>
                <div className="space-y-1.5">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted text-center py-8">No actions recorded yet.</p>
                  ) : (
                    history.map((h, idx) => {
                      const ok = h.status === "completed" || h.status === "success";
                      return (
                        <motion.div key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                          {ok ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-red-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{h.description}</p>
                            <p className="text-[9px] text-muted">
                              {h.agent} &middot; {h.action_type}
                              {h.created_at ? ` \u00B7 ${new Date(h.created_at).toLocaleString()}` : ""}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            )}{/* ═══ ANALYTICS TAB ═══ */}{tab === "Analytics" && (
              <div className="space-y-4">
                <div className="glass rounded-xl p-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 size={14} className="text-brand-accent" /> Trinity Analytics</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                    <motion.div
                      className="col-span-2 lg:col-span-1 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Tasks This Month</p>
                        <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{history.length}</p>
                        <p className="text-[11px] text-text-muted mt-1.5">completed</p>
                      </div>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Success Rate</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-700 tabular-nums">{successRateAvg}%</p>
                      <p className="text-[11px] text-text-muted mt-1.5">this month</p>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">In Queue</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-brand-accent tabular-nums">{queue.length}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">pending</p>
                    </motion.div>
                    <motion.div
                      className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Monthly Cost</p>
                      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{`$${costTotal.toFixed(2)}`}</p>
                      <p className="text-[11px] text-text-muted mt-1.5">AI spend</p>
                    </motion.div>
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
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
                          className="flex-1 accent-[#2563EB]" />
                        <span className="text-[10px] font-mono w-8 text-right">{weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}</MotionPage>
  );
}
