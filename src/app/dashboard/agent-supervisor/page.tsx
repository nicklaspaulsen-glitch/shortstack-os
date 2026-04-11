"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Bot, Activity, CheckCircle, XCircle, Clock, RefreshCw,
  Zap, Heart, Shield,
  Search, Sparkles, Send, BarChart3, Star, Film, Eye,
  CreditCard, UserPlus, Globe, Megaphone, FileText,
  ChevronDown, ChevronRight, ArrowRight
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

const AGENTS_CONFIG: Omit<Agent, "status" | "lastAction" | "lastActionTime" | "actionsToday" | "successRate">[] = [
  { id: "lead-engine", name: "Lead Engine", role: "Scrapes & qualifies leads", endpoint: "/api/agents/lead-engine/health" },
  { id: "outreach", name: "Outreach", role: "Cold DMs, emails & follow-ups", endpoint: "/api/agents/outreach/health" },
  { id: "content", name: "Content", role: "Scripts, captions & scheduling", endpoint: "/api/agents/content/health" },
  { id: "ads", name: "Ads Manager", role: "Campaign creation & optimization", endpoint: "/api/agents/ads/health" },
  { id: "reviews", name: "Reviews", role: "Google review monitoring", endpoint: "/api/agents/reviews/health" },
  { id: "analytics", name: "Analytics", role: "KPIs & reporting", endpoint: "/api/agents/analytics/health" },
  { id: "trinity", name: "Trinity", role: "Central AI coordinator", endpoint: "/api/agents/trinity/health" },
  { id: "competitor", name: "Competitor", role: "Competitor monitoring", endpoint: "/api/agents/competitor/health" },
  { id: "invoice", name: "Invoice", role: "Billing & payment chase", endpoint: "/api/agents/invoice/health" },
  { id: "onboarding", name: "Onboarding", role: "Client setup automation", endpoint: "/api/agents/onboarding/health" },
  { id: "seo", name: "SEO", role: "Rankings & keyword tracking", endpoint: "/api/agents/seo/health" },
  { id: "reputation", name: "Reputation", role: "Brand mention monitoring", endpoint: "/api/agents/reputation/health" },
  { id: "retention", name: "Retention", role: "Churn prevention", endpoint: "/api/agents/retention/health" },
  { id: "proposal", name: "Proposal", role: "Auto-generates proposals", endpoint: "/api/agents/proposal/health" },
  { id: "scheduler", name: "Scheduler", role: "Meetings & reminders", endpoint: "/api/agents/scheduler/health" },
  { id: "social-media", name: "Social Media", role: "Auto-posting & engagement", endpoint: "/api/agents/social-media/health" },
  { id: "video", name: "Video", role: "Video rendering & editing", endpoint: "/api/agents/video/health" },
  { id: "design", name: "Design", role: "Graphics & brand assets", endpoint: "/api/agents/design/health" },
  { id: "website", name: "Website", role: "Uptime & page generation", endpoint: "/api/agents/website/health" },
  { id: "production", name: "Production", role: "Edit requests & deadlines", endpoint: "/api/agents/production/health" },
];

const AGENT_ICONS: Record<string, React.ReactNode> = {
  "lead-engine": <Search size={15} />,
  "outreach": <Send size={15} />,
  "content": <Sparkles size={15} />,
  "ads": <Film size={15} />,
  "reviews": <Star size={15} />,
  "analytics": <BarChart3 size={15} />,
  "trinity": <Shield size={15} />,
  "competitor": <Eye size={15} />,
  "invoice": <CreditCard size={15} />,
  "onboarding": <UserPlus size={15} />,
  "seo": <Globe size={15} />,
  "reputation": <Megaphone size={15} />,
  "retention": <Heart size={15} />,
  "proposal": <FileText size={15} />,
  "scheduler": <Clock size={15} />,
  "social-media": <Send size={15} />,
  "video": <Film size={15} />,
  "design": <Sparkles size={15} />,
  "website": <Globe size={15} />,
  "production": <Film size={15} />,
};

const AGENT_COLORS: Record<string, string> = {
  "lead-engine": "emerald", "outreach": "blue", "content": "purple", "ads": "orange",
  "reviews": "amber", "analytics": "cyan", "trinity": "gold", "competitor": "red",
  "invoice": "green", "onboarding": "sky", "seo": "lime", "reputation": "fuchsia",
  "retention": "rose", "proposal": "violet", "scheduler": "teal", "social-media": "pink",
  "video": "indigo", "design": "amber", "website": "emerald", "production": "slate",
};

const CHAINS = [
  { from: "Lead Engine", to: "Outreach", label: "New lead scraped", trigger: "Send DM" },
  { from: "Outreach", to: "Proposal", label: "Reply received", trigger: "Generate proposal" },
  { from: "Outreach", to: "Scheduler", label: "Call booked", trigger: "Schedule meeting" },
  { from: "Proposal", to: "Onboarding", label: "Deal won", trigger: "Start onboarding" },
  { from: "Onboarding", to: "Invoice", label: "Client onboarded", trigger: "Send first invoice" },
  { from: "Onboarding", to: "Content", label: "Client onboarded", trigger: "Generate content" },
  { from: "Analytics", to: "Retention", label: "Health drops", trigger: "Re-engage client" },
  { from: "Invoice", to: "Retention", label: "Invoice overdue", trigger: "Chase payment" },
  { from: "Content", to: "Social Media", label: "Content ready", trigger: "Schedule posts" },
  { from: "Reviews", to: "Reputation", label: "New review", trigger: "Auto-respond" },
  { from: "Competitor", to: "Content", label: "Viral detected", trigger: "Counter-content" },
  { from: "Competitor", to: "Ads", label: "Price change", trigger: "Adjust ads" },
];

export default function AgentSupervisorPage() {
  useAuth();
  const supabase = createClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showChains, setShowChains] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: logs } = await supabase
      .from("trinity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const logEntries = logs || [];

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
        lastAction: latestLog?.action || "No activity",
        lastActionTime: latestLog?.created_at || "",
        actionsToday: todayLogs.length,
        successRate: agentLogs.length > 0 ? Math.round((successLogs.length / agentLogs.length) * 100) : 100,
      };
    });

    setAgents(builtAgents);
    setTimeline(logEntries.slice(0, 15) as TimelineEntry[]);
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
        setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, status: "working" } : a));
      } else {
        toast.error(`${agent.name} returned an error`);
        setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, status: "error" } : a));
      }
    } catch {
      toast.error("Health check failed");
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
        toast.success(`${agent.name} repaired`);
        setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, status: "idle" } : a));
        await supabase.from("trinity_log").insert({
          agent: agentId, action: "auto_repair",
          details: { triggered_by: "supervisor" }, status: "success",
        });
        fetchData();
      } else {
        toast.error(`Repair failed`);
      }
    } catch { toast.dismiss(); toast.error("Repair failed"); }
    setRepairing(null);
  }

  const totalActionsToday = agents.reduce((sum, a) => sum + a.actionsToday, 0);
  const avgSuccessRate = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) : 0;
  const agentsWorking = agents.filter((a) => a.status === "working").length;
  const agentsError = agents.filter((a) => a.status === "error").length;

  function formatTime(ts: string) {
    if (!ts) return "--";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            Agent Control Center
          </h1>
          <p className="text-sm text-muted mt-0.5">{agents.length} agents &middot; {agentsWorking} active &middot; {agentsError > 0 ? <span className="text-red-400">{agentsError} errors</span> : <span className="text-emerald-400">no errors</span>}</p>
        </div>
        <button
          onClick={() => { toast.loading("Checking all..."); Promise.all(agents.map((a) => healthCheck(a.id))).then(() => toast.dismiss()); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/10 text-gold text-xs font-medium border border-gold/20 hover:bg-gold/20 transition-all"
        >
          <Heart size={14} /> Health Check All
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/20 bg-surface/40 p-4 text-center">
          <p className="text-[10px] text-muted uppercase tracking-wider">Active</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{agentsWorking}</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-surface/40 p-4 text-center">
          <p className="text-[10px] text-muted uppercase tracking-wider">Actions Today</p>
          <p className="text-2xl font-bold text-white mt-1">{totalActionsToday}</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-surface/40 p-4 text-center">
          <p className="text-[10px] text-muted uppercase tracking-wider">Success Rate</p>
          <p className={`text-2xl font-bold mt-1 ${avgSuccessRate >= 90 ? "text-emerald-400" : avgSuccessRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
            {avgSuccessRate}%
          </p>
        </div>
        <div className="rounded-xl border border-border/20 bg-surface/40 p-4 text-center">
          <p className="text-[10px] text-muted uppercase tracking-wider">Errors</p>
          <p className={`text-2xl font-bold mt-1 ${agentsError === 0 ? "text-emerald-400" : "text-red-400"}`}>
            {agentsError}
          </p>
        </div>
      </div>

      {/* Agent List — Clean table/row style */}
      <div className="rounded-xl border border-border/20 bg-surface/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bot size={15} /> All Agents
          </h2>
          <span className="text-[10px] text-muted">{agents.length} total</span>
        </div>

        {/* Header row */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2 border-b border-border/10 text-[10px] text-muted uppercase tracking-wider">
          <div className="col-span-3">Agent</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Last Action</div>
          <div className="col-span-1 text-center">Today</div>
          <div className="col-span-1 text-center">Rate</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {agents.map((agent) => {
          const color = AGENT_COLORS[agent.id] || "gold";
          const isExpanded = expandedAgent === agent.id;

          return (
            <div key={agent.id} className="border-b border-border/5 last:border-0">
              {/* Main row */}
              <div
                className="grid grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-surface-light/20 transition-colors cursor-pointer"
                onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
              >
                {/* Agent name + icon */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    agent.status === "error" ? "bg-red-500/10 text-red-400" :
                    agent.status === "working" ? `bg-${color}-500/10 text-${color}-400` :
                    "bg-surface-light text-muted"
                  }`} style={{
                    backgroundColor: agent.status === "error" ? "rgba(239,68,68,0.1)" :
                      agent.status === "working" ? undefined : "rgba(255,255,255,0.03)",
                  }}>
                    {AGENT_ICONS[agent.id] || <Bot size={15} />}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">{agent.name}</p>
                    <p className="text-[9px] text-muted hidden sm:block">{agent.role}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    agent.status === "working" ? "bg-emerald-500/10 text-emerald-400" :
                    agent.status === "error" ? "bg-red-500/10 text-red-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      agent.status === "working" ? "bg-emerald-400" :
                      agent.status === "error" ? "bg-red-400 animate-pulse" :
                      "bg-amber-400"
                    }`} />
                    {agent.status === "working" ? "Active" : agent.status === "error" ? "Error" : "Idle"}
                  </span>
                </div>

                {/* Last Action */}
                <div className="col-span-3 hidden md:flex items-center gap-2">
                  <span className="text-[11px] text-muted truncate">{agent.lastAction}</span>
                  <span className="text-[9px] text-muted/60 shrink-0">{formatTime(agent.lastActionTime)}</span>
                </div>

                {/* Actions Today */}
                <div className="col-span-1 text-center">
                  <span className="text-[11px] font-mono font-medium">{agent.actionsToday}</span>
                </div>

                {/* Success Rate */}
                <div className="col-span-1 text-center">
                  <span className={`text-[11px] font-mono font-medium ${
                    agent.successRate >= 90 ? "text-emerald-400" : agent.successRate >= 70 ? "text-amber-400" : "text-red-400"
                  }`}>{agent.successRate}%</span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); healthCheck(agent.id); }}
                    disabled={checkingHealth === agent.id}
                    className="text-[10px] px-2 py-1 rounded border border-border/20 text-muted hover:text-white hover:border-border/40 transition-all disabled:opacity-30"
                  >
                    {checkingHealth === agent.id ? <RefreshCw size={10} className="animate-spin" /> : "Check"}
                  </button>
                  {agent.status === "error" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); repairAgent(agent.id); }}
                      disabled={repairing === agent.id}
                      className="text-[10px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-30"
                    >
                      {repairing === agent.id ? <RefreshCw size={10} className="animate-spin" /> : "Repair"}
                    </button>
                  )}
                  {isExpanded ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-3 pl-16 border-t border-border/5">
                  <div className="grid grid-cols-3 gap-4 py-3 text-[10px]">
                    <div>
                      <span className="text-muted">Endpoint</span>
                      <p className="text-white/70 font-mono mt-0.5 text-[9px]">{agent.endpoint}</p>
                    </div>
                    <div>
                      <span className="text-muted">Success Rate</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 bg-surface-light rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${
                            agent.successRate >= 90 ? "bg-emerald-400" : agent.successRate >= 70 ? "bg-amber-400" : "bg-red-400"
                          }`} style={{ width: `${agent.successRate}%` }} />
                        </div>
                        <span className="font-mono">{agent.successRate}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted">Last Active</span>
                      <p className="text-white/70 mt-0.5">{formatTime(agent.lastActionTime)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agent Chains + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Chains */}
        <div className="rounded-xl border border-border/20 bg-surface/40">
          <button
            onClick={() => setShowChains(!showChains)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-light/10 transition-colors"
          >
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={15} className="text-gold" /> Agent Chains
              <span className="text-[9px] bg-gold/[0.06] text-gold px-2 py-0.5 rounded-full">{CHAINS.length} active</span>
            </h2>
            {showChains ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
          </button>
          {showChains && (
            <div className="px-5 pb-4 space-y-1.5">
              <p className="text-[10px] text-muted mb-2">Automated triggers between agents</p>
              {CHAINS.map((chain, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[10px]">
                  <span className="text-white/80 font-medium w-24 shrink-0">{chain.from}</span>
                  <ArrowRight size={10} className="text-gold shrink-0" />
                  <span className="text-gold font-medium w-24 shrink-0">{chain.to}</span>
                  <span className="text-muted truncate">{chain.label} &rarr; {chain.trigger}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-auto" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="rounded-xl border border-border/20 bg-surface/40 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Activity size={15} /> Recent Activity
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No recent activity</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/5 last:border-0">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    entry.status === "success" ? "bg-emerald-500/10" :
                    entry.status === "error" ? "bg-red-500/10" : "bg-amber-500/10"
                  }`}>
                    {entry.status === "success" ? <CheckCircle size={11} className="text-emerald-400" /> :
                     entry.status === "error" ? <XCircle size={11} className="text-red-400" /> :
                     <Clock size={11} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium capitalize">{entry.agent?.replace(/_/g, " ") || "System"}</span>
                      <span className="text-[9px] text-muted">{formatTime(entry.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-muted truncate">{entry.action}</p>
                  </div>
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
        method: "POST", headers: { "Content-Type": "application/json" },
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
    <div className="rounded-xl border border-gold/10 bg-surface/40 p-5">
      <div className="flex items-center gap-3 pb-3 border-b border-border/10 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
          <Shield size={16} className="text-gold" />
        </div>
        <div>
          <p className="text-sm font-semibold">Nexus</p>
          <p className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Chief Agent &middot; Online
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-[10px] text-muted mb-3">Ask about agent status, performance, or strategy</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["Agent status overview", "Performance report", "Any problems?", "What should we improve?"].map((s, i) => (
                <button key={i} onClick={() => setInput(s)}
                  className="text-[10px] bg-surface-light/30 px-2.5 py-1 rounded-lg text-muted hover:text-white border border-border/10 hover:border-border/30 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
              msg.role === "user" ? "bg-gold/[0.06] border border-gold/10" : "bg-surface-light/30 border border-border/10"
            }`}>
              {msg.role === "chief" && <p className="text-[8px] text-gold font-semibold mb-0.5 uppercase tracking-wider">Nexus</p>}
              <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-surface-light/30 border border-border/10 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
              <span className="text-[10px] text-muted">Analyzing...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Nexus anything..."
          className="input flex-1 text-[11px] py-2 rounded-lg bg-surface-light/20 border-border/20" disabled={thinking} />
        <button type="submit" disabled={!input.trim() || thinking}
          className="px-3 py-2 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-30">
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
