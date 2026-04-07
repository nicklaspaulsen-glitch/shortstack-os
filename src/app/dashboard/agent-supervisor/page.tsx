"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Bot, Activity, CheckCircle, XCircle, Clock, RefreshCw,
  Zap, MessageSquare, Heart, Shield, Wrench,
  Search, Sparkles, Send, BarChart3, Star, Film, Eye
} from "lucide-react";
import toast from "react-hot-toast";

interface Agent {
  id: string;
  name: string;
  role: string;
  endpoint: string;
  status: "working" | "idle" | "error";
  lastAction: string;
  lastActionTime: string;
  uptime: string;
  actionsToday: number;
  successRate: number;
}

interface TimelineEntry {
  id: string;
  agent: string;
  action: string;
  details: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  timestamp: string;
}

const AGENTS_CONFIG: Omit<Agent, "status" | "lastAction" | "lastActionTime" | "uptime" | "actionsToday" | "successRate">[] = [
  { id: "lead-engine", name: "Lead Engine", role: "Scrapes & qualifies leads from social platforms", endpoint: "/api/agents/lead-engine/health" },
  { id: "outreach", name: "Outreach Agent", role: "Sends cold DMs, emails, and follow-ups", endpoint: "/api/agents/outreach/health" },
  { id: "content", name: "Content Agent", role: "Generates scripts, captions, and schedules posts", endpoint: "/api/agents/content/health" },
  { id: "ads", name: "Ads Manager", role: "Creates and optimizes ad campaigns", endpoint: "/api/agents/ads/health" },
  { id: "reviews", name: "Review Agent", role: "Monitors and responds to Google reviews", endpoint: "/api/agents/reviews/health" },
  { id: "analytics", name: "Analytics Agent", role: "Tracks KPIs and generates reports", endpoint: "/api/agents/analytics/health" },
  { id: "trinity", name: "Trinity", role: "Central AI coordinator & task executor", endpoint: "/api/agents/trinity/health" },
  { id: "competitor", name: "Competitor Agent", role: "Monitors competitor activity and pricing", endpoint: "/api/agents/competitor/health" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  working: { color: "text-green-400", icon: <Activity size={14} className="text-green-400" />, label: "Working" },
  idle: { color: "text-yellow-400", icon: <Clock size={14} className="text-yellow-400" />, label: "Idle" },
  error: { color: "text-red-400", icon: <XCircle size={14} className="text-red-400" />, label: "Error" },
};

const AGENT_VISUALS: Record<string, { icon: React.ReactNode; gradient: string; glow: string; ring: string }> = {
  "lead-engine": { icon: <Search size={18} />, gradient: "from-emerald-500 to-green-600", glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]", ring: "border-emerald-400/30" },
  "outreach": { icon: <Send size={18} />, gradient: "from-blue-500 to-cyan-500", glow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]", ring: "border-blue-400/30" },
  "content": { icon: <Sparkles size={18} />, gradient: "from-purple-500 to-pink-500", glow: "shadow-[0_0_20px_rgba(168,85,247,0.4)]", ring: "border-purple-400/30" },
  "ads": { icon: <Film size={18} />, gradient: "from-orange-500 to-amber-500", glow: "shadow-[0_0_20px_rgba(249,115,22,0.4)]", ring: "border-orange-400/30" },
  "reviews": { icon: <Star size={18} />, gradient: "from-yellow-400 to-amber-500", glow: "shadow-[0_0_20px_rgba(250,204,21,0.4)]", ring: "border-yellow-400/30" },
  "analytics": { icon: <BarChart3 size={18} />, gradient: "from-cyan-500 to-blue-600", glow: "shadow-[0_0_20px_rgba(6,182,212,0.4)]", ring: "border-cyan-400/30" },
  "trinity": { icon: <Shield size={18} />, gradient: "from-gold to-amber-600", glow: "shadow-[0_0_25px_rgba(201,168,76,0.5)]", ring: "border-gold/40" },
  "competitor": { icon: <Eye size={18} />, gradient: "from-red-500 to-rose-600", glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]", ring: "border-red-400/30" },
};

function AgentHead({ agentId, status, size = 48 }: { agentId: string; status: string; size?: number }) {
  const visual = AGENT_VISUALS[agentId] || AGENT_VISUALS["trinity"];
  const isActive = status === "working";
  const isError = status === "error";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer pulse ring */}
      {isActive && (
        <div className={`absolute inset-[-4px] rounded-full border ${visual.ring} animate-ping opacity-20`} />
      )}
      {/* Glow ring */}
      <div className={`absolute inset-[-3px] rounded-full border-2 transition-all duration-500 ${
        isError ? "border-red-500/40" : isActive ? visual.ring : "border-border/20"
      }`} />
      {/* 3D sphere body */}
      <div className={`relative w-full h-full rounded-full bg-gradient-to-br ${
        isError ? "from-red-600 to-red-800" : visual.gradient
      } flex items-center justify-center transition-all duration-300 ${
        isActive ? visual.glow : isError ? "shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "opacity-60"
      }`}
        style={{
          transform: "perspective(200px) rotateX(5deg)",
          boxShadow: isActive
            ? undefined
            : "inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)",
        }}
      >
        {/* Inner highlight for 3D effect */}
        <div className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, transparent 60%)",
          }} />
        {/* Icon */}
        <span className="relative text-white drop-shadow-lg">{visual.icon}</span>
      </div>
      {/* Status dot */}
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
        isActive ? "bg-green-400 animate-pulse" : isError ? "bg-red-400 animate-pulse" : "bg-yellow-400"
      }`} />
    </div>
  );
}

export default function AgentSupervisorPage() {
  useAuth();
  const supabase = createClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: logs } = await supabase
      .from("trinity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const logEntries = logs || [];

    // Build agent states from log data
    const builtAgents: Agent[] = AGENTS_CONFIG.map((cfg) => {
      const agentLogs = logEntries.filter((l: TimelineEntry) => l.agent === cfg.id || l.agent === cfg.name.toLowerCase().replace(/ /g, "_"));
      const todayLogs = agentLogs.filter((l: TimelineEntry) => l.created_at >= today);
      const successLogs = agentLogs.filter((l: TimelineEntry) => l.status === "success");
      const latestLog = agentLogs[0];
      const hasError = agentLogs.slice(0, 3).some((l: TimelineEntry) => l.status === "error");
      const hasRecent = latestLog && (Date.now() - new Date(latestLog.created_at).getTime()) < 3600000;

      return {
        ...cfg,
        status: hasError ? "error" : hasRecent ? "working" : "idle",
        lastAction: latestLog?.action || "No activity recorded",
        lastActionTime: latestLog?.created_at || "",
        uptime: hasError ? "Degraded" : "99.9%",
        actionsToday: todayLogs.length,
        successRate: agentLogs.length > 0 ? Math.round((successLogs.length / agentLogs.length) * 100) : 100,
      };
    });

    setAgents(builtAgents);
    setTimeline(logEntries.slice(0, 20) as TimelineEntry[]);

    // Build simulated inter-agent messages from logs
    const agentMessages: AgentMessage[] = logEntries
      .filter((l: TimelineEntry) => l.details && typeof l.details === "object")
      .slice(0, 10)
      .map((l: TimelineEntry) => ({
        id: l.id,
        from_agent: l.agent || "system",
        to_agent: (l.details as Record<string, string>).target_agent || "trinity",
        message: l.action,
        timestamp: l.created_at,
      }));

    setMessages(agentMessages);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function healthCheck(agentId: string) {
    setCheckingHealth(agentId);
    try {
      const agent = AGENTS_CONFIG.find((a) => a.id === agentId);
      if (!agent) return;

      const res = await fetch(agent.endpoint);
      if (res.ok) {
        toast.success(`${agent.name} is healthy`);
        setAgents((prev) =>
          prev.map((a) => a.id === agentId ? { ...a, status: "working" } : a)
        );
      } else {
        toast.error(`${agent.name} returned an error`);
        setAgents((prev) =>
          prev.map((a) => a.id === agentId ? { ...a, status: "error" } : a)
        );
      }
    } catch {
      toast.error("Health check failed — endpoint unreachable");
    }
    setCheckingHealth(null);
  }

  async function repairAgent(agentId: string) {
    setRepairing(agentId);
    const agent = AGENTS_CONFIG.find((a) => a.id === agentId);
    if (!agent) return;

    toast.loading(`Repairing ${agent.name}...`);
    try {
      const res = await fetch(`/api/agents/${agentId}/repair`, { method: "POST" });
      toast.dismiss();
      if (res.ok) {
        toast.success(`${agent.name} repaired successfully`);
        setAgents((prev) =>
          prev.map((a) => a.id === agentId ? { ...a, status: "idle" } : a)
        );
        await supabase.from("trinity_log").insert({
          agent: agentId,
          action: "auto_repair",
          details: { triggered_by: "supervisor" },
          status: "success",
        });
        fetchData();
      } else {
        toast.error(`Failed to repair ${agent.name}`);
      }
    } catch {
      toast.dismiss();
      toast.error("Repair request failed");
    }
    setRepairing(null);
  }

  const totalActionsToday = agents.reduce((sum, a) => sum + a.actionsToday, 0);
  const avgSuccessRate = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length)
    : 0;
  const agentsOnline = agents.filter((a) => a.status !== "error").length;

  function formatTime(ts: string) {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-gold" />
            </div>
            AI Agent Supervisor
          </h1>
          <p className="text-muted text-sm mt-1">Monitor, manage, and repair all 8 AI agents</p>
        </div>
        <button
          onClick={() => { toast.loading("Running health checks..."); Promise.all(agents.map((a) => healthCheck(a.id))).then(() => toast.dismiss()); }}
          className="btn-primary flex items-center gap-2 rounded-lg"
        >
          <Heart size={16} /> Health Check All
        </button>
      </div>

      {/* Agent Heads Row */}
      <div className="card p-4 flex items-center justify-center gap-5 flex-wrap">
        {agents.map((agent) => (
          <div key={agent.id} className="flex flex-col items-center gap-1.5 group cursor-pointer" onClick={() => healthCheck(agent.id)}>
            <AgentHead agentId={agent.id} status={agent.status} size={40} />
            <span className="text-[9px] text-muted group-hover:text-white transition-colors font-medium">{agent.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card rounded-xl text-center">
          <p className="text-[10px] text-muted uppercase tracking-wide">Actions Today</p>
          <p className="text-2xl font-bold text-white mt-1">{totalActionsToday}</p>
        </div>
        <div className="card rounded-xl text-center">
          <p className="text-[10px] text-muted uppercase tracking-wide">Success Rate</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{avgSuccessRate}%</p>
        </div>
        <div className="card rounded-xl text-center">
          <p className="text-[10px] text-muted uppercase tracking-wide">Agents Online</p>
          <p className="text-2xl font-bold text-gold mt-1">{agentsOnline} / {agents.length}</p>
        </div>
      </div>

      {/* Agent Cards */}
      <div>
        <h2 className="section-header flex items-center gap-2 mb-4">
          <Bot size={18} /> Agent Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="card card-hover rounded-xl relative overflow-hidden">
              {/* Background gradient based on agent */}
              <div className={`absolute inset-0 opacity-[0.03] bg-gradient-to-br ${AGENT_VISUALS[agent.id]?.gradient || "from-gold to-amber-600"}`} />
              <div className="relative">
                {/* Agent Head + Name */}
                <div className="flex flex-col items-center text-center mb-3 pt-1">
                  <AgentHead agentId={agent.id} status={agent.status} size={52} />
                  <h3 className="font-semibold text-sm mt-2.5">{agent.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    {STATUS_CONFIG[agent.status].icon}
                    <span className={`text-[10px] ${STATUS_CONFIG[agent.status].color}`}>
                      {STATUS_CONFIG[agent.status].label}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-muted text-center mb-3">{agent.role}</p>

                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted">Last Action</span>
                    <span className="text-white/80 truncate ml-2 max-w-[120px]">{agent.lastAction}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted">Time</span>
                    <span className="text-white/80">{formatTime(agent.lastActionTime)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted">Today</span>
                    <span className="text-white/80">{agent.actionsToday} actions</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted">Success</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 bg-surface-light rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${agent.successRate >= 90 ? "bg-green-400" : agent.successRate >= 70 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${agent.successRate}%` }} />
                      </div>
                      <span className={agent.successRate >= 90 ? "text-green-400" : "text-yellow-400"}>
                        {agent.successRate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => healthCheck(agent.id)}
                    disabled={checkingHealth === agent.id}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-lg"
                  >
                    <Heart size={10} /> {checkingHealth === agent.id ? "..." : "Health"}
                  </button>
                  {agent.status === "error" && (
                    <button
                      onClick={() => repairAgent(agent.id)}
                      disabled={repairing === agent.id}
                      className="btn-primary flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-lg"
                    >
                      <Wrench size={10} /> {repairing === agent.id ? "..." : "Repair"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Timeline & Agent Communication */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="card rounded-xl">
          <h2 className="section-header flex items-center gap-2 mb-4">
            <Activity size={18} /> Activity Timeline
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No recent activity</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    entry.status === "success" ? "bg-green-400/10" : entry.status === "error" ? "bg-red-400/10" : "bg-yellow-400/10"
                  }`}>
                    {entry.status === "success"
                      ? <CheckCircle size={12} className="text-green-400" />
                      : entry.status === "error"
                      ? <XCircle size={12} className="text-red-400" />
                      : <Clock size={12} className="text-yellow-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium capitalize">{entry.agent?.replace(/_/g, " ") || "System"}</span>
                      <span className="text-[10px] text-muted">{formatTime(entry.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-muted truncate">{entry.action}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Communication */}
        <div className="card rounded-xl">
          <h2 className="section-header flex items-center gap-2 mb-4">
            <MessageSquare size={18} /> Agent Communication
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No inter-agent messages</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="card-hover rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-gold/10 text-gold text-[10px] px-2 py-0.5 rounded capitalize">
                      {msg.from_agent?.replace(/_/g, " ")}
                    </span>
                    <Zap size={10} className="text-muted" />
                    <span className="badge bg-surface-light text-[10px] px-2 py-0.5 rounded capitalize">
                      {msg.to_agent?.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-muted ml-auto">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-xs text-white/80">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Chief Agent Chat */}
      <ChiefChat />
    </div>
  );
}

function ChiefChat() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "chief"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  async function sendMessage() {
    if (!input.trim() || thinking) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setThinking(true);

    try {
      const res = await fetch("/api/agents/chief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages.slice(-10) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "chief", content: data.reply || "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "chief", content: "Connection error." }]);
    }
    setThinking(false);
  }

  return (
    <div className="card border-gold/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-20" />
      <div className="relative">
        <div className="flex items-center gap-3 pb-3 border-b border-border/20 mb-3">
          <AgentHead agentId="trinity" status="working" size={38} />
          <div>
            <p className="text-xs font-semibold">Nexus — Chief Agent</p>
            <p className="text-[9px] text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> Online — overseeing all agents
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[250px] overflow-y-auto mb-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <Shield size={20} className="mx-auto mb-2 text-gold/30" />
              <p className="text-[10px] text-muted mb-2">Talk to Nexus about agent status, system health, and strategy</p>
              <div className="flex flex-wrap justify-center gap-1">
                {["What's the status of all agents?", "Any problems I should know about?", "What should we improve?", "Give me a performance report"].map((s, i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className="text-[9px] bg-surface-light/50 px-2 py-1 rounded text-muted hover:text-white border border-border/20 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.role === "user" ? "bg-gold/10 border border-gold/15" : "bg-surface-light/50 border border-border/20"
              }`}>
                {msg.role === "chief" && <p className="text-[8px] text-gold font-bold mb-0.5">NEXUS</p>}
                <p className="text-[10px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-surface-light/50 border border-border/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                  <span className="text-[9px] text-muted">Nexus analyzing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nexus anything about agent status, performance, or strategy..."
            className="input flex-1 text-[10px]" disabled={thinking} />
          <button type="submit" disabled={!input.trim() || thinking} className="btn-primary text-[10px] px-3 disabled:opacity-30">
            <MessageSquare size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}
