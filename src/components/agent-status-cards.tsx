"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Send, Film, Camera, Megaphone, Zap, Bot, Phone, Crown
} from "lucide-react";

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  status: "active" | "idle" | "error";
  lastAction: string;
  actionsToday: number;
}

const AGENT_CONFIGS = [
  { id: "lead_gen", name: "Scout", role: "Lead Finder", icon: <Search size={14} />, color: "#C9A84C" },
  { id: "outreach", name: "Echo", role: "Outreach", icon: <Send size={14} />, color: "#38bdf8" },
  { id: "content", name: "Pixel", role: "Content AI", icon: <Film size={14} />, color: "#f43f5e" },
  { id: "social", name: "Wave", role: "Social", icon: <Camera size={14} />, color: "#10b981" },
  { id: "ads", name: "Blaze", role: "Ads", icon: <Megaphone size={14} />, color: "#f59e0b" },
  { id: "automation", name: "Nexus", role: "Supervisor", icon: <Crown size={14} />, color: "#ec4899" },
  { id: "custom", name: "Trinity", role: "Assistant", icon: <Bot size={14} />, color: "#8b5cf6" },
  { id: "ai_receptionist", name: "Ring", role: "Caller", icon: <Phone size={14} />, color: "#14b8a6" },
];

export default function AgentStatusCards() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAgentStatus() {
    const today = new Date().toISOString().split("T")[0];
    const agentStatuses: AgentStatus[] = [];

    for (const config of AGENT_CONFIGS) {
      const [
        { data: lastAction },
        { count: todayCount },
      ] = await Promise.all([
        supabase.from("trinity_log").select("description, status").eq("action_type", config.id).order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("trinity_log").select("*", { count: "exact", head: true }).eq("action_type", config.id).gte("created_at", today),
      ]);

      agentStatuses.push({
        ...config,
        status: todayCount && todayCount > 0 ? "active" : "idle",
        lastAction: lastAction?.description || "No recent activity",
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
        <span className="text-[9px] text-muted">{activeCount}/{agents.length} active</span>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
        {agents.map(agent => (
          <div key={agent.id} className="relative group" title={`${agent.name}: ${agent.lastAction}`}>
            <div className={`flex flex-col items-center p-2 rounded-xl border transition-all duration-300 ${
              agent.status === "active"
                ? "border-border/30 bg-surface-light/30"
                : "border-border/10 bg-surface/50 opacity-60"
            } hover:border-gold/20 hover:opacity-100`}>
              {/* Avatar */}
              <div className="relative mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: agent.color + "15" }}>
                  <span style={{ color: agent.color }}>{agent.icon}</span>
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                  agent.status === "active" ? "bg-success" : agent.status === "error" ? "bg-danger" : "bg-muted/50"
                }`} />
              </div>
              <span className="text-[8px] font-semibold truncate w-full text-center">{agent.name}</span>
              <span className="text-[7px] text-muted truncate w-full text-center">{agent.actionsToday > 0 ? `${agent.actionsToday} today` : agent.role}</span>
            </div>

            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 w-40">
              <div className="bg-surface border border-border/30 rounded-lg p-2 shadow-lg text-center">
                <p className="text-[9px] font-semibold" style={{ color: agent.color }}>{agent.name} — {agent.role}</p>
                <p className="text-[8px] text-muted mt-0.5 truncate">{agent.lastAction}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
