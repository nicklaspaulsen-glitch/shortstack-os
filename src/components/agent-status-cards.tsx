"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Send, Sparkles, Film, Megaphone, Star, Eye, BarChart3,
  CreditCard, UserPlus, Globe, Heart, FileText, Clock, Shield
} from "lucide-react";
import Link from "next/link";

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  status: "active" | "idle" | "error";
  lastAction: string;
  actionsToday: number;
}

const AGENT_CONFIGS = [
  { id: "lead_gen", name: "Scout", role: "Lead Finder", icon: <Search size={14} />, gradient: "from-emerald-500 to-green-600", glow: "rgba(16,185,129,0.4)" },
  { id: "outreach", name: "Echo", role: "Outreach", icon: <Send size={14} />, gradient: "from-blue-500 to-cyan-500", glow: "rgba(59,130,246,0.4)" },
  { id: "content", name: "Pixel", role: "Content", icon: <Sparkles size={14} />, gradient: "from-purple-500 to-pink-500", glow: "rgba(168,85,247,0.4)" },
  { id: "ads", name: "Blaze", role: "Ads", icon: <Film size={14} />, gradient: "from-orange-500 to-amber-500", glow: "rgba(249,115,22,0.4)" },
  { id: "reviews", name: "Star", role: "Reviews", icon: <Star size={14} />, gradient: "from-yellow-400 to-amber-500", glow: "rgba(250,204,21,0.4)" },
  { id: "analytics", name: "Lens", role: "Analytics", icon: <BarChart3 size={14} />, gradient: "from-cyan-500 to-blue-600", glow: "rgba(6,182,212,0.4)" },
  { id: "custom", name: "Trinity", role: "Coordinator", icon: <Shield size={14} />, gradient: "from-amber-500 to-yellow-600", glow: "rgba(201,168,76,0.5)" },
  { id: "competitor", name: "Spy", role: "Competitor", icon: <Eye size={14} />, gradient: "from-red-500 to-rose-600", glow: "rgba(239,68,68,0.4)" },
  { id: "invoice", name: "Ledger", role: "Invoice", icon: <CreditCard size={14} />, gradient: "from-green-500 to-emerald-600", glow: "rgba(34,197,94,0.4)" },
  { id: "onboarding", name: "Welcome", role: "Onboarding", icon: <UserPlus size={14} />, gradient: "from-sky-500 to-indigo-500", glow: "rgba(14,165,233,0.4)" },
  { id: "seo", name: "Rank", role: "SEO", icon: <Globe size={14} />, gradient: "from-lime-500 to-green-500", glow: "rgba(132,204,22,0.4)" },
  { id: "reputation", name: "Shield", role: "Reputation", icon: <Megaphone size={14} />, gradient: "from-fuchsia-500 to-pink-600", glow: "rgba(217,70,239,0.4)" },
  { id: "retention", name: "Keep", role: "Retention", icon: <Heart size={14} />, gradient: "from-rose-500 to-red-500", glow: "rgba(244,63,94,0.4)" },
  { id: "proposal", name: "Pitch", role: "Proposal", icon: <FileText size={14} />, gradient: "from-violet-500 to-purple-600", glow: "rgba(139,92,246,0.4)" },
  { id: "scheduler", name: "Clock", role: "Scheduler", icon: <Clock size={14} />, gradient: "from-teal-500 to-cyan-600", glow: "rgba(20,184,166,0.4)" },
];

export default function AgentStatusCards() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAgentStatus() {
    const today = new Date().toISOString().split("T")[0];
    const agentStatuses: AgentStatus[] = [];

    for (const config of AGENT_CONFIGS) {
      const [
        { data: lastAction },
        { count: todayCount },
      ] = await Promise.all([
        supabase.from("trinity_log").select("description, status").or(`action_type.eq.${config.id},agent.eq.${config.id}`).order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("trinity_log").select("*", { count: "exact", head: true }).or(`action_type.eq.${config.id},agent.eq.${config.id}`).gte("created_at", today),
      ]);

      const hasError = lastAction?.status === "error";

      agentStatuses.push({
        ...config,
        status: hasError ? "error" : (todayCount && todayCount > 0) ? "active" : "idle",
        lastAction: lastAction?.description || "Standing by",
        actionsToday: todayCount || 0,
      });
    }

    setAgents(agentStatuses);
  }

  const activeCount = agents.filter(a => a.status === "active").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">AI Agents</span>
        </div>
        <Link href="/dashboard/agent-supervisor" className="text-[9px] text-gold hover:text-gold-light">
          {activeCount}/{agents.length} active — View All
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {agents.map(agent => (
          <div key={agent.id} className="relative group shrink-0" title={`${agent.name}: ${agent.lastAction}`}>
            <div className={`flex flex-col items-center p-2 rounded-xl border transition-all duration-300 w-[60px] ${
              agent.status === "active"
                ? "border-border/30 bg-surface-light/30"
                : agent.status === "error"
                ? "border-red-500/20 bg-red-500/5"
                : "border-border/10 bg-surface/50 opacity-50"
            } hover:border-gold/20 hover:opacity-100`}>
              {/* 3D Agent Head */}
              <div className="relative mb-1">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agent.gradient} flex items-center justify-center transition-all duration-300`}
                  style={{
                    boxShadow: agent.status === "active"
                      ? `0 0 12px ${agent.glow}`
                      : "inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 2px 3px rgba(255,255,255,0.15)",
                    transform: "perspective(150px) rotateX(5deg)",
                  }}>
                  {/* Inner highlight */}
                  <div className="absolute inset-0 rounded-full" style={{
                    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, transparent 55%)",
                  }} />
                  <span className="relative text-white drop-shadow-lg">{agent.icon}</span>
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                  agent.status === "active" ? "bg-success animate-pulse" : agent.status === "error" ? "bg-danger animate-pulse" : "bg-muted/50"
                }`} />
              </div>
              <span className="text-[7px] font-bold truncate w-full text-center">{agent.name}</span>
              <span className="text-[6px] text-muted truncate w-full text-center">
                {agent.actionsToday > 0 ? `${agent.actionsToday} today` : agent.role}
              </span>
            </div>

            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 w-36">
              <div className="bg-surface border border-border/30 rounded-lg p-2 shadow-lg text-center">
                <p className="text-[9px] font-semibold text-foreground">{agent.name} — {agent.role}</p>
                <p className="text-[8px] text-muted mt-0.5 line-clamp-2">{agent.lastAction}</p>
                {agent.actionsToday > 0 && (
                  <p className="text-[8px] text-success mt-0.5">{agent.actionsToday} actions today</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
